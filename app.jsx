/* global React, ReactDOM, SAMPLE, FloorplanCanvas, ToolPalette, findConflicts, snap,
   HeroDashboard, ProjectPickerSidebar, DashAside, Inspector, CreatorModal, ExportView,
   useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSlider, TweakSelect, TweakButton */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "gridStyle": "lines",
  "pathStyle": "orthogonal",
  "pathGap": 0.1,
  "lineWidth": 1,
  "rectStyle": "filled",
  "sidebarLayout": "left",
  "showMinimap": true
}/*EDITMODE-END*/;

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState('dashboard'); // dashboard | editor | export
  const [activeProjectId, setActiveProjectId] = useState('galeria-moderna');
  const [activeAdaptId, setActiveAdaptId] = useState('venue-soho');
  const [query, setQuery] = useState('');

  // Editor state
  const [plan, setPlan] = useState(() => JSON.parse(JSON.stringify(SAMPLE.FLOORPLAN)));
  const [tool, setTool] = useState('select');
  const [grid, setGrid] = useState(0.5);
  const [selected, setSelected] = useState('s04');
  const [selectedConn, setSelectedConn] = useState(null);
  const [layers, setLayers] = useState({ grid: true, rects: true, paths: true, labels: true, minimap: true });
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [toast, setToast] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playStep, setPlayStep] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [playMode, setPlayMode] = useState(false);

  const dwgInputRef = useRef(null);
  const dwgApiRef = useRef(null);
  const dwgLoaderRef = useRef(null);

  const rotatePlan90 = useCallback((clockwise = true) => {
    setPlanWithHistory(prev => {
      const oldW = prev.bounds.w;
      const oldH = prev.bounds.h;
      const rotatePoint = (pt) => clockwise
        ? ({ x: oldH - pt.y, y: pt.x })
        : ({ x: pt.y, y: oldW - pt.x });
      const rotateRect = (r) => {
        const corners = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ].map(rotatePoint);
        const xs = corners.map(c => c.x);
        const ys = corners.map(c => c.y);
        return {
          ...r,
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
          pods: Array.isArray(r.pods)
            ? r.pods.map(pod => clockwise
              ? ({ ...pod, x: r.h - pod.y, y: pod.x })
              : ({ ...pod, x: pod.y, y: r.w - pod.x }))
            : r.pods,
        };
      };
      return {
        ...prev,
        bounds: { w: oldH, h: oldW },
        rects: prev.rects.map(rotateRect),
        connections: prev.connections.map(c => ({
          ...c,
          customMiddleNodes: c.customMiddleNodes?.map(rotatePoint) || null,
        })),
      };
    });
  }, []);

  const rotateRect90 = useCallback((id, clockwise = true) => {
    setPlanWithHistory(prev => ({
      ...prev,
      rects: prev.rects.map(r => {
        if (r.id !== id) return r;
        const centerX = r.x + r.w / 2;
        const centerY = r.y + r.h / 2;
        const nextW = r.h;
        const nextH = r.w;
        return {
          ...r,
          x: Math.max(0, Math.min(prev.bounds.w - nextW, snap(centerX - nextW / 2, grid))),
          y: Math.max(0, Math.min(prev.bounds.h - nextH, snap(centerY - nextH / 2, grid))),
          w: nextW,
          h: nextH,
          pods: Array.isArray(r.pods)
            ? r.pods.map(pod => clockwise
              ? ({ ...pod, x: r.h - pod.y, y: pod.x })
              : ({ ...pod, x: pod.y, y: r.w - pod.x }))
            : r.pods,
        };
      }),
    }));
  }, [grid]);

  const processDwgFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dwg')) {
      showToast('Invalid file · choose a .dwg');
      return;
    }
    const loadDwg = async () => {
      try {
        if (!dwgApiRef.current){
          if (!dwgLoaderRef.current){
            dwgLoaderRef.current = new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.0/dist/libredwg-web.js';
              script.async = true;
              script.onload = () => {
                const direct = window.libredwgWeb || window.libredwgweb || window.LibreDwgWeb;
                if (direct?.LibreDwg && direct?.Dwg_File_Type) return resolve(direct);
                const maybe = Object.values(window).find(v => v && typeof v === 'object' && v.LibreDwg && v.Dwg_File_Type);
                if (maybe) return resolve(maybe);
                reject(new Error('Could not initialize libredwg runtime from CDN script'));
              };
              script.onerror = () => reject(new Error('Failed to load libredwg runtime script'));
              document.head.appendChild(script);
            });
          }
          const dwgPkg = await dwgLoaderRef.current;
          const lib = await dwgPkg.LibreDwg.create('https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.0/wasm/');
          dwgApiRef.current = {
            lib,
            Dwg_File_Type: dwgPkg.Dwg_File_Type,
          };
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { lib, Dwg_File_Type } = dwgApiRef.current;
        const dwgData = lib.dwg_read_data(bytes, Dwg_File_Type.DWG);
        const db = lib.convert(dwgData);
        const svgRaw = lib.dwg_to_svg(db);
        if (!svgRaw || !svgRaw.includes('<svg')) throw new Error('DWG→SVG conversion returned empty content');
        lib.dwg_free(dwgData);
        const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRaw)}`;

        setPlanWithHistory(prev => {
          const baseW = Math.max(4, +(prev.bounds.w * 0.9).toFixed(2));
          const baseH = Math.max(4, +(prev.bounds.h * 0.9).toFixed(2));
          return {
            ...prev,
            sourceFile: file.name,
            dwgRef: {
              x: +(prev.bounds.w / 2).toFixed(2),
              y: +(prev.bounds.h / 2).toFixed(2),
              w: baseW,
              h: baseH,
              baseW,
              baseH,
              visible: true,
              svgDataUri,
            },
          };
        });
        showToast(`DWG loaded: ${file.name}`);
      } catch (err){
        console.error(err);
        showToast(`Failed to import DWG${err?.message ? `: ${err.message}` : ''}`);
      }
    };
    loadDwg();
  }, []);

  const onPickDwg = useCallback(async () => {
    let shouldFallbackToInput = true;
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'DWG files', accept: { 'application/acad': ['.dwg'] } }],
        });
        const file = await handle.getFile();
        processDwgFile(file);
        shouldFallbackToInput = false;
        return;
      }
    } catch (err){
      if (err?.name === 'AbortError') return;
      console.warn('showOpenFilePicker failed, using input fallback', err);
    }
    if (!shouldFallbackToInput) return;
    if (!dwgInputRef.current) {
      showToast('Could not open file picker');
      return;
    }
    dwgInputRef.current.value = '';
    dwgInputRef.current.click();
  }, [processDwgFile]);

  const onDwgSelected = useCallback((e) => {
    const file = e.target.files?.[0];
    processDwgFile(file);
    e.target.value = '';
  }, [processDwgFile]);

  const updateDwgRef = useCallback((patch) => {
    setPlanWithHistory(prev => {
      if (!prev.dwgRef) return prev;
      return { ...prev, dwgRef: { ...prev.dwgRef, ...patch } };
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = t.dark ? 'dark' : 'light'; }, [t.dark]);
  useEffect(() => {
    setLayers(L => ({ ...L, minimap: t.showMinimap }));
  }, [t.showMinimap]);
  useEffect(() => {
    if (typeof PathUtil?.setLaneGap === 'function') {
      PathUtil.setLaneGap(t.pathGap);
    } else {
      console.warn('PathUtil.setLaneGap is not available; using default spacing.');
    }
  }, [t.pathGap]);

  const conflicts = useMemo(() => findConflicts(plan.rects), [plan.rects]);

  const project = SAMPLE.PROJECTS.find(p => p.id === activeProjectId) || SAMPLE.PROJECTS[0];
  const adaptations = SAMPLE.ADAPTATIONS_BY_PROJECT[activeProjectId] || [];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const setPlanWithHistory = useCallback((updater) => {
    setPlan(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setHistory(h => [...h.slice(-30), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = () => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => [plan, ...f]);
      setPlan(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setHistory(h => [...h, plan]);
      setPlan(next);
      return f.slice(1);
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (route !== 'editor') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'v') setTool('select');
      else if (k === 'r') setTool('rect');
      else if (k === 'c') setTool('connect');
      else if (k === 'e') setTool('edit');
      else if (k === 'h') setTool('pan');
      else if (k === 'a') setTool('auto');
      else if ((e.metaKey || e.ctrlKey) && k === 'z' && !e.shiftKey){ e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (k === 'y' || (k === 'z' && e.shiftKey))){ e.preventDefault(); redo(); }
      else if (k === 'backspace' || k === 'delete'){
        if (selected){ setPlanWithHistory(p => ({...p, rects: p.rects.filter(r => r.id !== selected), connections: p.connections.filter(c => c.from !== selected && c.to !== selected)})); setSelected(null); showToast('Rect deleted'); }
        else if (selectedConn){ setPlanWithHistory(p => ({...p, connections: p.connections.filter(c => c.id !== selectedConn)})); setSelectedConn(null); showToast('Connection deleted'); }
      }
      else if (k === ' '){ e.preventDefault(); setPlayMode(true); setIsPlaying(true); }
      else if (k === 'escape'){ setPlayMode(false); setIsPlaying(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, selected, selectedConn, plan, setPlanWithHistory]);

  // Listen for select-scene event from inspector
  useEffect(() => {
    const h = (e) => setSelected(e.detail);
    window.addEventListener('select-scene', h);
    return () => window.removeEventListener('select-scene', h);
  }, []);

  const onAutoRoute = () => {
    showToast('Auto-routed all paths · 0/45/90°');
  };

  const onDeleteRect = (id) => {
    setPlanWithHistory(p => ({...p, rects: p.rects.filter(r => r.id !== id), connections: p.connections.filter(c => c.from !== id && c.to !== id)}));
    setSelected(null);
    showToast('Rect deleted');
  };

  // Play mode tick
  useEffect(() => {
    if (!isPlaying) return;
    const dur = 1800 / playSpeed;
    const tm = setTimeout(() => {
      setPlayStep(s => {
        if (s + 1 >= plan.tourOrder.length){ setIsPlaying(false); return s; }
        const next = s + 1;
        const r = plan.rects.find(rc => rc.id === plan.tourOrder[next]);
        if (r) setSelected(r.id);
        return next;
      });
    }, dur);
    return () => clearTimeout(tm);
  }, [isPlaying, playStep, playSpeed, plan.tourOrder]);

  // ── Topbar ──
  const Topbar = (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">WEFKG·NLOVE</div>
          <div className="brand-sub">FLOORPLAN EDITOR · v0.4.2</div>
        </div>
      </div>
      <div className="topnav">
        <a className={route === 'dashboard' ? 'active' : ''} onClick={() => setRoute('dashboard')}>Projects</a>
        <a className={route === 'editor' ? 'active' : ''} onClick={() => setRoute('editor')}>Editor</a>
        <a className={route === 'export' ? 'active' : ''} onClick={() => setRoute('export')}>Build · Export</a>
        <a onClick={() => showToast('Settings coming soon')}>Settings</a>
      </div>
      <div className="row gap-12">
        <span className="pixel-tag ghost">UNITY · CONNECTED</span>
        <span className="pixel-tag ghost">JR</span>
      </div>
    </div>
  );

  // ── Statusbar ──
  const Statusbar = (
    <div className="statusbar">
      <span><span className="status-dot"/> AUTOSAVED · 4s ago</span>
      <span>SCENES {plan.rects.length}</span>
      <span>PATHS {plan.connections.length}</span>
      <span>GRID {grid}m</span>
      <span style={{color: conflicts.size ? 'var(--danger)' : 'inherit'}}>
        {conflicts.size ? `⚠ ${conflicts.size} CONFLICT${conflicts.size>1?'S':''}` : 'NO CONFLICTS'}
      </span>
      <span style={{flex:1}} />
      <span>{activeAdaptId.toUpperCase()}</span>
      <span>· UNITY BATCH READY</span>
    </div>
  );

  return (
    <div className="app">
      {Topbar}

      {route === 'dashboard' && (
        <div className="dash">
          <ProjectPickerSidebar
             projects={SAMPLE.PROJECTS}
             activeId={activeProjectId}
             onPick={setActiveProjectId}
             query={query}
             setQuery={setQuery} />
          <div className="dash-main scroll-y">
            <HeroDashboard project={project}
                           adaptations={adaptations}
                           onOpenAdapt={(id) => { setActiveAdaptId(id); setRoute('editor'); }}
                           onNewAdapt={() => showToast('New adaptation flow')}
                           onCreateRect={() => { setRoute('editor'); setShowCreator(true); }}/>
          </div>
          <DashAside activity={SAMPLE.ACTIVITY} builds={SAMPLE.RECENT_BUILDS} />
        </div>
      )}

      {route === 'editor' && (
        <div className="editor" data-layout={t.sidebarLayout}>
          {/* Tools sidebar */}
          <div className="tools">
            {/* Topbar layout: shows action buttons inline */}
            {t.sidebarLayout === 'topbar' && (
              <div className="row gap-12" style={{padding:'0 8px'}}>
                <button className="pixel-btn sm" onClick={undo}><ToolIconStub kind="undo"/> UNDO</button>
                <button className="pixel-btn sm" onClick={redo}>REDO</button>
                <span className="vdivider" />
              </div>
            )}
            <ToolPalette tool={tool} setTool={setTool} />

            {t.sidebarLayout !== 'topbar' && (
              <>
                <div className="tool-group">
                  <h4>Grid · meters</h4>
                  <div className="row gap-12">
                    {[1, 0.5, 0.1].map(g => (
                      <button key={g} className="pixel-btn sm"
                              data-pressed={grid === g}
                              onClick={() => setGrid(g)}
                              style={{flex:1, justifyContent:'center', background: grid === g ? 'var(--amber)' : 'var(--panel-2)', color: grid === g ? '#1a0e00' : 'var(--ink)'}}>
                        {g}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tool-group">
                  <h4>Plan source</h4>
                  <button className="pixel-btn sm" style={{width:'100%', justifyContent:'center'}} onClick={onPickDwg}>↥ IMPORT .DWG</button>
                  <input ref={dwgInputRef} id="dwg-input" type="file" accept=".dwg" onChange={onDwgSelected}
                         style={{position:'absolute', left:'-99999px', width:1, height:1, opacity:0, pointerEvents:'none'}} />
                  {plan.sourceFile && plan.dwgRef && (
                    <div className="pixel-inset" style={{marginTop:6, padding:6, display:'flex', flexDirection:'column', gap:6}}>
                      <div className="tiny" style={{wordBreak:'break-word'}}>REF: {plan.sourceFile}</div>
                      <label className="tiny" style={{display:'flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={plan.dwgRef.visible !== false}
                               onChange={(e) => updateDwgRef({ visible: e.target.checked })}/>
                        Show in viewport
                      </label>
                      <div className="tiny">Scale</div>
                      <input type="range" min="0.25" max="2" step="0.05"
                             value={(plan.dwgRef.w / (plan.dwgRef.baseW || plan.dwgRef.w)).toFixed(2)}
                             onChange={(e) => {
                               const f = +e.target.value;
                               const bw = plan.dwgRef.baseW || plan.dwgRef.w;
                               const bh = plan.dwgRef.baseH || plan.dwgRef.h;
                               updateDwgRef({ w: +(bw * f).toFixed(2), h: +(bh * f).toFixed(2) });
                             }} />
                      <button className="pixel-btn sm ghost" style={{justifyContent:'center'}}
                              onClick={() => updateDwgRef({ x: +(plan.bounds.w / 2).toFixed(2), y: +(plan.bounds.h / 2).toFixed(2) })}>
                        CENTER REF
                      </button>
                    </div>
                  )}
                  <button className="pixel-btn sm ghost" style={{width:'100%', justifyContent:'center', marginTop:6}} onClick={() => showToast('Loaded template')}>≡ LOAD TEMPLATE</button>
                </div>

                <div className="tool-group">
                  <h4>Edit</h4>
                  <div className="row gap-12">
                    <button className="pixel-btn icon sm" onClick={undo} title="Undo (⌘Z)" disabled={!history.length}>↶</button>
                    <button className="pixel-btn icon sm" onClick={redo} title="Redo (⌘⇧Z)" disabled={!future.length}>↷</button>
                    <button className="pixel-btn sm" onClick={() => setShowCreator(true)} style={{flex:1, justifyContent:'center'}}>+ SCENE</button>
                  </div>
                </div>

                <div className="tool-group">
                  <h4>Auto-route</h4>
                  <button className="pixel-btn sm" style={{width:'100%', justifyContent:'center'}} onClick={onAutoRoute}>⟷ ROUTE ALL PATHS</button>
                  <div className="tiny muted" style={{marginTop:4}}>0° / 45° / 90° · min crossings</div>
                </div>

                <div className="scene-list-wrap" style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
                  <div className="tool-group" style={{borderBottom:0, paddingBottom:0}}>
                    <h4>Scenes · {plan.rects.length}</h4>
                  </div>
                  <SceneListInline plan={plan} selected={selected} setSelected={(id)=>{ setSelected(id); setSelectedConn(null); }} conflicts={conflicts}/>
                </div>

                <div className="tool-group" style={{borderBottom:0}}>
                  <button className="pixel-btn primary" style={{width:'100%', justifyContent:'center'}} onClick={() => { setPlayMode(true); setIsPlaying(true); setPlayStep(0); }}>
                    ▶ PLAY JOURNEY
                  </button>
                  <button className="pixel-btn sm" style={{width:'100%', justifyContent:'center', marginTop:6}} onClick={() => setRoute('export')}>⇪ EXPORT BUILD</button>
                </div>
              </>
            )}
          </div>

          {/* Canvas */}
          <div className="canvas-wrap">
            <div className="canvas-toolbar">
              <span className="label">VENUE · {activeAdaptId.replace('venue-','').toUpperCase()}</span>
              <span className="muted tiny">·</span>
              <span className="tiny">{plan.bounds.w} × {plan.bounds.h} m</span>
              <span className="grow" />
              <div className="row gap-12">
                <button className="pixel-btn sm ghost" onClick={() => setPlanWithHistory(JSON.parse(JSON.stringify(SAMPLE.FLOORPLAN)))}>RESET</button>
                <button className="pixel-btn sm ghost" onClick={() => showToast('Saved as template')}>SAVE TEMPLATE</button>
                <button className="pixel-btn sm" onClick={() => { setPlayMode(true); setIsPlaying(true); setPlayStep(0); }}>▶ PLAY</button>
                <button className="pixel-btn sm primary" onClick={() => setRoute('export')}>EXPORT →</button>
              </div>
            </div>

            <FloorplanCanvas
              plan={plan} setPlan={setPlanWithHistory}
              selected={selected} setSelected={setSelected}
              tool={tool} setTool={setTool}
              grid={grid}
              pathWidth={t.lineWidth}
              gridStyle={t.gridStyle} pathStyle={t.pathStyle} rectStyle={t.rectStyle}
              layers={layers} setLayers={setLayers}
              conflicts={conflicts}
              selectedConn={selectedConn} setSelectedConn={setSelectedConn}
              isPlaying={false}
              playStep={null}
            />
          </div>

          {/* Inspector */}
          <Inspector plan={plan} setPlan={setPlanWithHistory}
                     selected={selected}
                     selectedConn={selectedConn} setSelectedConn={setSelectedConn}
                     onAutoRoute={onAutoRoute}
                     onDelete={onDeleteRect}
                     onRotateRectCW={() => selected && rotateRect90(selected, true)}
                     onRotateRectCCW={() => selected && rotateRect90(selected, false)}
                     onRotatePlanCW={() => rotatePlan90(true)}
                     onRotatePlanCCW={() => rotatePlan90(false)}
                     conflicts={conflicts}/>
        </div>
      )}

      {route === 'export' && (
        <ExportView project={project} plan={plan} onClose={() => setRoute('editor')} />
      )}

      {Statusbar}

      {showCreator && (
        <CreatorModal plan={plan} onClose={() => setShowCreator(false)}
                      onCreate={(form) => {
                        const id = `s${Math.floor(Math.random()*9000)+100}`;
                        // Place free spot
                        let x = 1, y = 1;
                        outer: for (y = 1; y <= plan.bounds.h - form.h; y += 0.5){
                          for (x = 1; x <= plan.bounds.w - form.w; x += 0.5){
                            const test = { x, y, w: form.w, h: form.h };
                            if (!plan.rects.some(r => !(r.x + r.w <= test.x || test.x + test.w <= r.x || r.y + r.h <= test.y || test.y + test.h <= r.y))){
                              break outer;
                            }
                          }
                        }
                        setPlanWithHistory(p => ({
                          ...p,
                          rects: [...p.rects, { id, name: form.name, x, y, w: form.w, h: form.h, kind: form.kind, gameObject: form.gameObject, ...(form.kind === 'pod-room' ? { pods: form.pods } : {}) }],
                          connections: [
                            ...p.connections,
                            ...form.connectsTo.map(targetId => ({
                              id: 'c' + Math.floor(Math.random()*9000+100),
                              from: id, to: targetId,
                              mode: form.kind === 'pod-room' ? 'individual' : 'unified',
                            }))
                          ]
                        }));
                        setSelected(id);
                        setShowCreator(false);
                        showToast(`Added ${form.name}`);
                      }}/>
      )}

      {playMode && (
        <PlayMode plan={plan} step={playStep} setStep={setPlayStep}
                  isPlaying={isPlaying} setIsPlaying={setIsPlaying}
                  speed={playSpeed} setSpeed={setPlaySpeed}
                  pathStyle={t.pathStyle} rectStyle={t.rectStyle} gridStyle={t.gridStyle}
                  onClose={() => { setPlayMode(false); setIsPlaying(false); }}/>
      )}

      {toast && <div className="toast">{toast}</div>}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakToggle label="Dark canvas" value={t.dark} onChange={v => setTweak('dark', v)} />
        <TweakSection label="Canvas" />
        <TweakRadio label="Grid style" value={t.gridStyle}
                    options={['lines','dots','blueprint']}
                    onChange={v => setTweak('gridStyle', v)} />
        <TweakRadio label="Path style" value={t.pathStyle}
                    options={['orthogonal','rounded','pixel']}
                    onChange={v => setTweak('pathStyle', v)} />
        <TweakSlider label="Path distance" value={t.pathGap} min={0} max={1} step={0.05} unit="m"
                    onChange={v => setTweak('pathGap', v)} />
        <TweakSlider label="Line width" value={t.lineWidth} min={0.4} max={2} step={0.1} unit="x"
                    onChange={v => setTweak('lineWidth', v)} />
        <TweakRadio label="Rect style" value={t.rectStyle}
                    options={['filled','outlined','ghosted']}
                    onChange={v => setTweak('rectStyle', v)} />
        <TweakToggle label="Show minimap" value={t.showMinimap} onChange={v => setTweak('showMinimap', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Sidebar" value={t.sidebarLayout}
                    options={['left','floating','topbar']}
                    onChange={v => setTweak('sidebarLayout', v)} />
        <div className="divider"/>
        <div className="twk-sect" style={{paddingTop:0}}>Quick actions</div>
        <TweakButton label="Reset floorplan" secondary onClick={() => { setPlan(JSON.parse(JSON.stringify(SAMPLE.FLOORPLAN))); }}/>
      </TweaksPanel>
    </div>
  );
}

// Inline scene list used in left sidebar
function SceneListInline({ plan, selected, setSelected, conflicts }){
  return (
    <div className="scene-list scroll-y" style={{flex:1, minHeight:0}}>
      {plan.rects.map(r => (
        <div key={r.id}
             className={`scene-row${selected === r.id ? ' selected' : ''}${r.kind === 'unified-hub' ? ' unified' : ''}${conflicts.has(r.id) ? ' conflict' : ''}`}
             onClick={() => setSelected(r.id)}>
          <span className="ix">{r.id.replace('s','')}</span>
          <span className="nm">{r.name}</span>
          {r.kind === 'unified-hub' && <span style={{fontSize:9, color:'var(--amber-deep)'}}>HUB</span>}
          {r.kind === 'pod-room' && <span style={{fontSize:9, color:'var(--ink-3)'}}>PODS</span>}
        </div>
      ))}
    </div>
  );
}

// Tiny stub — renders nothing visible (used for topbar layout)
function ToolIconStub(){ return null; }

// Play mode overlay
function PlayMode({ plan, step, setStep, isPlaying, setIsPlaying, speed, setSpeed, pathStyle, rectStyle, gridStyle, onClose }){
  const total = plan.tourOrder.length;
  const currentId = plan.tourOrder[step];
  const currentRect = plan.rects.find(r => r.id === currentId);

  return (
    <div className="play-overlay">
      <div className="play-shell">
        <div className="play-top">
          <div className="title">
            <span className="pixel-tag amber">▶ PLAY MODE</span>
            <span style={{fontFamily:"'Silkscreen', monospace", fontSize:13}}>VR JOURNEY PREVIEW</span>
            <span className="muted tiny">· step {step+1} of {total}</span>
          </div>
          <div className="row gap-12">
            <span className="muted tiny">SPEED</span>
            {[0.5, 1, 2, 4].map(s => (
              <button key={s} className="pixel-btn sm" data-pressed={speed === s}
                      onClick={() => setSpeed(s)}
                      style={{background: speed === s ? 'var(--amber)' : 'var(--panel-2)', color: speed === s ? '#1a0e00' : 'var(--ink)'}}>
                ×{s}
              </button>
            ))}
            <button className="pixel-btn ghost" onClick={onClose}>✕ EXIT (ESC)</button>
          </div>
        </div>
        <div className="play-stage">
          <div className="play-info">
            <div className="ix">SCENE {(step+1).toString().padStart(2,'0')} / {total.toString().padStart(2,'0')} · {currentId?.toUpperCase()}</div>
            <div className="nm">{currentRect?.name}</div>
            <div className="meta">{currentRect?.w}×{currentRect?.h}m · 6 users · {currentRect?.kind}</div>
            <div className="meta" style={{marginTop:6}}>{currentRect?.gameObject}</div>
            <div className="row gap-12" style={{marginTop:10}}>
              <span className="status-dot amber"/>
              <span className="tiny">VR USERS WALKING…</span>
            </div>
          </div>
          <div className="play-canvas-wrap" style={{display:'flex', flexDirection:'column'}}>
            <FloorplanCanvas
              plan={plan} setPlan={() => {}}
              selected={currentId} setSelected={() => {}}
              tool="select" setTool={() => {}}
              grid={0.5}
              pathWidth={1}
              gridStyle={gridStyle} pathStyle={pathStyle} rectStyle={rectStyle}
              layers={{ grid: true, rects: true, paths: true, labels: true, minimap: false }}
              setLayers={() => {}}
              conflicts={new Set()}
              selectedConn={null} setSelectedConn={() => {}}
              isPlaying={true}
              playStep={step}
            />
          </div>
        </div>
        <div className="play-controls">
          <button className="pixel-btn icon" onClick={() => setStep(Math.max(0, step - 1))}>◀◀</button>
          <button className="pixel-btn primary" onClick={() => setIsPlaying(p => !p)} style={{minWidth: 80, justifyContent:'center'}}>
            {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
          <button className="pixel-btn icon" onClick={() => setStep(Math.min(total - 1, step + 1))}>▶▶</button>
          <div className="play-scrubber">
            <div className="scrub-track">
              {plan.tourOrder.map((id, i) => (
                <div key={id} className={`scene-marker${i === step ? ' active' : ''}`} style={{left: `${(i / (total-1)) * 100}%`}}>
                  {id.toUpperCase()}
                </div>
              ))}
              {plan.tourOrder.map((id, i) => (
                <div key={'t'+id} className="scrub-tick" style={{left: `${(i / (total-1)) * 100}%`}} />
              ))}
              <div className="scrub-fill" style={{width: `${(step / (total-1)) * 100}%`}} />
              <div className="scrub-thumb" style={{left: `${(step / (total-1)) * 100}%`}} />
            </div>
          </div>
          <span className="tiny muted mono-num">{(step * 1.8 / speed).toFixed(1)}s / {((total-1) * 1.8 / speed).toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
