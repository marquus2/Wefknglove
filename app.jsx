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

// DWG unit → meters conversion factors
const APP_NAME = 'SAMBO';
const APP_VERSION = 'v0.4.2E';
const DWG_UNIT_SCALE = { mm: 0.001, cm: 0.01, inch: 0.0254, m: 1 };

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState('dashboard'); // dashboard | editor | export
  const [activeProjectId, setActiveProjectId] = useState('blackmirror');
  const [activeAdaptId, setActiveAdaptId] = useState('bm-madrid');
  const [query, setQuery] = useState('');

  // Editor state
  const getFloorplanForAdapt = useCallback((id) => (
    (SAMPLE.FLOORPLANS && SAMPLE.FLOORPLANS[id]) ? SAMPLE.FLOORPLANS[id] : SAMPLE.FLOORPLAN
  ), []);
  const [plan, setPlan] = useState(() => JSON.parse(JSON.stringify(getFloorplanForAdapt('bm-madrid'))));
  const [tool, setTool] = useState('select');
  const [grid, setGrid] = useState(0.5);
  const [selected, setSelected] = useState('bm000');
  const [selectedConn, setSelectedConn] = useState(null);
  const [layers, setLayers] = useState({ grid: true, rects: true, paths: true, labels: true, minimap: true });
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [toast, setToast] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [showTemplateLoad, setShowTemplateLoad] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wefknglove_templates') || '[]'); }
    catch { return []; }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playStep, setPlayStep] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [playMode, setPlayMode] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const dwgInputRef = useRef(null);
  const dwgApiRef = useRef(null);
  const dwgLoaderRef = useRef(null);
  const [dwgUnit, setDwgUnit] = useState('mm'); // mm | cm | inch | m
  const dwgUnitRef = useRef(dwgUnit);
  useEffect(() => { dwgUnitRef.current = dwgUnit; }, [dwgUnit]);

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
        // dir: CW rotation → subtract 90°; CCW → add 90°
        const oldDir = r.dir || 0;
        const newDir = clockwise
          ? (oldDir - 90 + 360) % 360
          : (oldDir + 90) % 360;
        return {
          ...r,
          dir: newDir,
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
        // dwgRef intentionally NOT rotated — stays fixed as background reference
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
        const oldDir = r.dir || 0;
        const newDir = clockwise ? (oldDir - 90 + 360) % 360 : (oldDir + 90) % 360;
        return {
          ...r,
          dir: newDir,
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
        // Load/cache the DWG package (JS module only downloaded once)
        if (!dwgLoaderRef.current){
          dwgLoaderRef.current = (async () => {
            const fromModuleBoot = await window.__libredwgPromise;
            if (fromModuleBoot?.LibreDwg && fromModuleBoot?.Dwg_File_Type) return fromModuleBoot;
            const maybe = Object.values(window).find(v => v && typeof v === 'object' && v.LibreDwg && v.Dwg_File_Type);
            if (maybe) return maybe;
            throw new Error('Could not initialize libredwg runtime module');
          })();
        }
        const dwgPkg = await dwgLoaderRef.current;

        // Create a fresh WASM instance for every load to avoid heap pollution.
        // LibreDwg.instance is a static singleton — we reset it so create()
        // calls createModule() fresh each time.
        try { dwgPkg.LibreDwg.instance = null; } catch(_) {}
        const lib = await dwgPkg.LibreDwg.create();
        const Dwg_File_Type = dwgPkg.Dwg_File_Type;

        const bytes = new Uint8Array(await file.arrayBuffer());
        const dwgData = lib.dwg_read_data(bytes, Dwg_File_Type.DWG);
        const db = lib.convert(dwgData);
        const svgRaw = lib.dwg_to_svg(db);
        console.log('[DWG] svgRaw length:', svgRaw?.length);
        if (!svgRaw || !svgRaw.includes('<svg')) throw new Error('DWG→SVG conversion returned empty content');
        // Note: intentionally not calling lib.dwg_free(dwgData) here —
        // it corrupts the Emscripten heap singleton and breaks subsequent loads.

        // Parse viewBox to get real-world DWG dimensions
        const vbMatch = svgRaw.match(/viewBox="([^"]+)"/);
        let dwgW = null, dwgH = null;
        if (vbMatch) {
          const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
          if (parts.length >= 4 && !parts.some(isNaN)) {
            const scale = DWG_UNIT_SCALE[dwgUnitRef.current] || 0.001;
            dwgW = +(Math.abs(parts[2]) * scale).toFixed(3); // viewBox width → meters
            dwgH = +(Math.abs(parts[3]) * scale).toFixed(3); // viewBox height → meters
            console.log(`[DWG] viewBox → ${parts[2].toFixed(1)} × ${parts[3].toFixed(1)} ${dwgUnitRef.current} = ${dwgW}m × ${dwgH}m`);
          }
        }

        // Post-process SVG for dangerouslySetInnerHTML injection.
        // The HTML parser does NOT accept XML declarations or DOCTYPEs — strip them first.
        // Then overwrite width/height/preserveAspectRatio so the SVG fills the container.
        let svgString = svgRaw
          .replace(/^[\s\S]*?(<svg[\s>])/i, '$1')  // strip everything before <svg (XML decl, DOCTYPE, comments)
          .replace(/<svg([^>]*)>/i, (match, attrs) => {
            const cleanAttrs = attrs
              .replace(/\s+width="[^"]*"/g, '')
              .replace(/\s+height="[^"]*"/g, '')
              .replace(/\s+preserveAspectRatio="[^"]*"/g, '');
            return `<svg${cleanAttrs} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">`;
          })
          // Strip libredwg solid black background rectangles (replace fill with none)
          .replace(/(<rect\b[^>]*?)fill\s*=\s*["'](?:#0{3,8}|black|#0d0d0d|#121[0-9a-f]{3})["']/gi,
            '$1fill="none"')
          .replace(/(<rect\b[^>]*?style\s*=\s*["'][^"']*?)(?:fill|background)\s*:\s*(?:#0{3,8}|black|#0d0d0d|#121[0-9a-f]{3})/gi,
            '$1fill:none');

        // Use setPlan (not history) so large SVG strings don't bloat the undo stack
        setPlan(prev => {
          // Use real-world dimensions if parsed, otherwise fall back to 90% of bounds
          const baseW = dwgW && dwgW > 0.5 ? dwgW : Math.max(4, +(prev.bounds.w * 0.9).toFixed(2));
          const baseH = dwgH && dwgH > 0.5 ? dwgH : Math.max(4, +(prev.bounds.h * 0.9).toFixed(2));

          // Expand bounds to fit the DWG (with 20% margin), rounded up to nearest meter
          const PAD = 1.2;
          const newBoundsW = Math.ceil(Math.max(prev.bounds.w, baseW * PAD));
          const newBoundsH = Math.ceil(Math.max(prev.bounds.h, baseH * PAD));

          return {
            ...prev,
            bounds: { w: newBoundsW, h: newBoundsH },
            sourceFile: file.name,
            dwgRef: {
              x: +(newBoundsW / 2).toFixed(2),
              y: +(newBoundsH / 2).toFixed(2),
              w: baseW,
              h: baseH,
              vbW: vbMatch ? Math.abs(+vbMatch[1].trim().split(/[\s,]+/)[2]) : null,
              vbH: vbMatch ? Math.abs(+vbMatch[1].trim().split(/[\s,]+/)[3]) : null,
              visible: true,
              opacity: 0.85,
              svgString,
            },
          };
        });
        const dims = dwgW ? ` · ${dwgW}m × ${dwgH}m` : '';
        showToast(`DWG loaded: ${file.name}${dims}`);
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

  const removeDwg = useCallback(() => {
    setPlan(prev => ({ ...prev, sourceFile: null, dwgRef: null }));
  }, []);

  // When unit changes and a DWG is loaded, recalculate its real-world dimensions
  useEffect(() => {
    setPlan(prev => {
      const ref = prev.dwgRef;
      if (!ref || ref.vbW == null || ref.vbH == null) return prev;
      const scale = DWG_UNIT_SCALE[dwgUnit] || 0.001;
      const newW = +(ref.vbW * scale).toFixed(3);
      const newH = +(ref.vbH * scale).toFixed(3);
      if (newW < 0.1 || newH < 0.1) return prev;
      const PAD = 1.2;
      const newBoundsW = Math.ceil(Math.max(prev.bounds.w, newW * PAD));
      const newBoundsH = Math.ceil(Math.max(prev.bounds.h, newH * PAD));
      return {
        ...prev,
        bounds: { w: newBoundsW, h: newBoundsH },
        dwgRef: { ...ref, w: newW, h: newH,
                  x: +(newBoundsW / 2).toFixed(2),
                  y: +(newBoundsH / 2).toFixed(2) },
      };
    });
  }, [dwgUnit]);

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

  // ── Template persistence (localStorage) ────────────────────────────────────
  const onSaveTemplate = (name) => {
    const planCopy = JSON.parse(JSON.stringify(plan));
    // Strip heavy SVG string from DWG ref — templates are for layout, not the DWG image
    if (planCopy.dwgRef) delete planCopy.dwgRef.svgString;
    const newTpl = {
      id: 'tpl-' + Date.now(),
      name: name.trim(),
      projectId: activeProjectId,
      adaptId: activeAdaptId,
      date: new Date().toISOString(),
      plan: planCopy,
    };
    const next = [newTpl, ...templates].slice(0, 60); // keep max 60 templates
    setTemplates(next);
    localStorage.setItem('wefknglove_templates', JSON.stringify(next));
    showToast(`Template "${name}" saved`);
  };

  const onDeleteTemplate = (id) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    localStorage.setItem('wefknglove_templates', JSON.stringify(next));
  };

  const onLoadTemplate = (tpl) => {
    setPlanWithHistory(JSON.parse(JSON.stringify(tpl.plan)));
    setSelected(null); setSelectedConn(null);
    showToast(`Loaded "${tpl.name}"`);
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
      <button className="brand brand-button" onClick={() => setShowAbout(true)} title="About SAMBO">
        <img className="brand-logo" src="assets/sambo_logo.svg" alt="SAMBO" />
      </button>
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

  const adjustGridToContent = useCallback(() => {
    const MARGIN = 3;
    setPlanWithHistory(prev => {
      const measuredRects = prev.rects.filter(r => r.kind !== 'alternate-content');
      const xs = measuredRects.flatMap(r => [r.x, r.x + r.w]);
      const ys = measuredRects.flatMap(r => [r.y, r.y + r.h]);
      if (prev.dwgRef && prev.dwgRef.visible !== false) {
        xs.push(prev.dwgRef.x - prev.dwgRef.w / 2, prev.dwgRef.x + prev.dwgRef.w / 2);
        ys.push(prev.dwgRef.y - prev.dwgRef.h / 2, prev.dwgRef.y + prev.dwgRef.h / 2);
      }
      if (!xs.length || !ys.length) return prev;

      const minX = Math.floor(Math.min(...xs) - MARGIN);
      const minY = Math.floor(Math.min(...ys) - MARGIN);
      const maxX = Math.ceil(Math.max(...xs) + MARGIN);
      const maxY = Math.ceil(Math.max(...ys) + MARGIN);
      const dx = -minX;
      const dy = -minY;
      const movePoint = pt => pt ? ({ ...pt, x: +(pt.x + dx).toFixed(2), y: +(pt.y + dy).toFixed(2) }) : pt;
      const moveRoute = route => ({
        ...route,
        customMiddleNodes: Array.isArray(route.customMiddleNodes) ? route.customMiddleNodes.map(movePoint) : route.customMiddleNodes,
        customLaneMiddleNodes: Array.isArray(route.customLaneMiddleNodes)
          ? route.customLaneMiddleNodes.map(nodes => Array.isArray(nodes) ? nodes.map(movePoint) : nodes)
          : route.customLaneMiddleNodes,
      });

      return {
        ...prev,
        bounds: { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) },
        rects: prev.rects.map(r => ({
          ...r,
          x: +(r.x + dx).toFixed(2),
          y: +(r.y + dy).toFixed(2),
          customRoutes: r.customRoutes
            ? Object.fromEntries(Object.entries(r.customRoutes).map(([key, route]) => [key, moveRoute(route)]))
            : r.customRoutes,
        })),
        connections: prev.connections.map(c => moveRoute(c)),
        dwgRef: prev.dwgRef ? { ...prev.dwgRef, x: +(prev.dwgRef.x + dx).toFixed(2), y: +(prev.dwgRef.y + dy).toFixed(2) } : prev.dwgRef,
      };
    });
    showToast('Grid adjusted to content');
  }, [setPlanWithHistory]);

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
                           onOpenAdapt={(id) => {
                             setActiveAdaptId(id);
                             const fp = getFloorplanForAdapt(id);
                             setPlan(JSON.parse(JSON.stringify(fp)));
                             setHistory([]); setFuture([]);
                             setSelected(null); setSelectedConn(null);
                             setRoute('editor');
                           }}
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
                  <div className="row gap-12" style={{marginBottom:6}}>
                    <span className="tiny" style={{lineHeight:'24px', whiteSpace:'nowrap'}}>DWG units</span>
                    <select className="pixel-input sm" style={{flex:1, fontSize:11}}
                            value={dwgUnit} onChange={e => setDwgUnit(e.target.value)}>
                      <option value="mm">mm (millimeters)</option>
                      <option value="cm">cm (centimeters)</option>
                      <option value="inch">inches</option>
                      <option value="m">m (meters)</option>
                    </select>
                  </div>
                  <button className="pixel-btn sm" style={{width:'100%', justifyContent:'center'}} onClick={onPickDwg}>↥ IMPORT .DWG</button>
                  <input ref={dwgInputRef} id="dwg-input" type="file" accept=".dwg" onChange={onDwgSelected}
                         style={{position:'absolute', left:'-99999px', width:1, height:1, opacity:0, pointerEvents:'none'}} />
                  {plan.sourceFile && plan.dwgRef && (
                    <div className="pixel-inset" style={{marginTop:6, padding:6, display:'flex', flexDirection:'column', gap:6}}>
                      <div className="tiny" style={{wordBreak:'break-word'}}>REF: {plan.sourceFile}</div>
                      <div className="tiny" style={{opacity:0.7}}>
                        {plan.dwgRef.w.toFixed(2)}m × {plan.dwgRef.h.toFixed(2)}m
                      </div>
                      <label className="tiny" style={{display:'flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={plan.dwgRef.visible !== false}
                               onChange={(e) => updateDwgRef({ visible: e.target.checked })}/>
                        Show
                      </label>
                      <label className="tiny" style={{display:'flex', alignItems:'center', gap:6}}>
                        <input type="checkbox" checked={!!plan.dwgRef.locked}
                               onChange={(e) => updateDwgRef({ locked: e.target.checked })}/>
                        Lock (no select)
                      </label>
                      <div className="tiny">Opacity {Math.round((plan.dwgRef.opacity ?? 0.85) * 100)}%</div>
                      <input type="range" min="0.1" max="1" step="0.05"
                             value={plan.dwgRef.opacity ?? 0.85}
                             onChange={(e) => updateDwgRef({ opacity: +e.target.value })}/>
                      <button className="pixel-btn sm ghost" style={{justifyContent:'center'}}
                              onClick={() => updateDwgRef({ x: +(plan.bounds.w / 2).toFixed(2), y: +(plan.bounds.h / 2).toFixed(2) })}>
                        CENTER REF
                      </button>
                      <button className="pixel-btn sm ghost" style={{justifyContent:'center', color:'var(--red, #e05)'}}
                              onClick={removeDwg}>
                        ✕ REMOVE DWG
                      </button>
                    </div>
                  )}
                  <button className="pixel-btn sm ghost" style={{width:'100%', justifyContent:'center', marginTop:6}} onClick={() => setShowTemplateLoad(true)}>≡ LOAD TEMPLATE</button>
                </div>

                <div className="tool-group">
                  <h4>Edit</h4>
                  <div className="row gap-12">
                    <button className="pixel-btn icon sm" onClick={undo} title="Undo (⌘Z)" disabled={!history.length}>↶</button>
                    <button className="pixel-btn icon sm" onClick={redo} title="Redo (⌘⇧Z)" disabled={!future.length}>↷</button>
                    <button className="pixel-btn sm" onClick={() => setShowCreator(true)} style={{flex:1, justifyContent:'center'}}>+ SCENE</button>
                  </div>
                  <div className="row gap-12" style={{marginTop:6}}>
                    <button className="pixel-btn sm ghost" title="Add a column obstacle — paths will route around it"
                            style={{flex:1, justifyContent:'center'}}
                            onClick={() => {
                              const id = 'col' + Math.floor(Math.random() * 9000 + 100);
                              setPlanWithHistory(p => ({
                                ...p,
                                rects: [...p.rects, {
                                  id, name: 'Column',
                                  x: +(p.bounds.w / 2 - 0.15).toFixed(2),
                                  y: +(p.bounds.h / 2 - 0.15).toFixed(2),
                                  w: 0.3, h: 0.3,
                                  kind: 'column',
                                  gameObject: '',
                                }],
                              }));
                            }}>▪ ADD COLUMN</button>
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
                <button className="pixel-btn sm ghost" onClick={adjustGridToContent}>ADJUST GRID</button>
                <button className="pixel-btn sm ghost" onClick={() => setPlanWithHistory(JSON.parse(JSON.stringify(getFloorplanForAdapt(activeAdaptId))))}>RESET</button>
                <button className="pixel-btn sm ghost" onClick={() => setShowTemplateSave(true)}>SAVE TEMPLATE</button>
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
        <ExportView project={project} plan={plan} onClose={() => setRoute('editor')}
                    onSaveTemplate={() => { setRoute('editor'); setShowTemplateSave(true); }}/>
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

      {showTemplateLoad && (
        <TemplateLoadModal
          templates={templates}
          onLoad={(tpl) => { onLoadTemplate(tpl); setShowTemplateLoad(false); }}
          onDelete={onDeleteTemplate}
          onClose={() => setShowTemplateLoad(false)}/>
      )}

      {showTemplateSave && (
        <TemplateSaveModal
          defaultName={`${project.name} · ${new Date().toLocaleDateString()}`}
          onSave={(name) => { onSaveTemplate(name); setShowTemplateSave(false); }}
          onClose={() => setShowTemplateSave(false)}/>
      )}

      {showAbout && (
        <AboutModal appName={APP_NAME} version={APP_VERSION} onClose={() => setShowAbout(false)} />
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
        <TweakButton label="Reset floorplan" secondary onClick={() => { setPlan(JSON.parse(JSON.stringify(getFloorplanForAdapt(activeAdaptId)))); }}/>
      </TweaksPanel>
    </div>
  );
}

// Inline scene list used in left sidebar
function SceneListInline({ plan, selected, setSelected, conflicts }){
  return (
    <div className="scene-list scroll-y" style={{flex:1, minHeight:0}}>
      {plan.rects.filter(r => r.kind !== 'column').map(r => (
        <div key={r.id}
             className={`scene-row${selected === r.id ? ' selected' : ''}${r.kind === 'alternate-content' ? ' unified' : ''}${conflicts.has(r.id) ? ' conflict' : ''}`}
             onClick={() => setSelected(r.id)}>
          <span className="ix">{r.id.replace('s','')}</span>
          <span className="nm">{r.name}</span>
          {r.kind === 'alternate-content' && <span style={{fontSize:9, color:'var(--amber-deep)'}}>ALT</span>}
          {r.kind === 'pod-room' && <span style={{fontSize:9, color:'var(--ink-3)'}}>PODS</span>}
        </div>
      ))}
    </div>
  );
}

// Tiny stub — renders nothing visible (used for topbar layout)
function AboutModal({ appName, version, onClose }){
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal about-modal" onClick={e => e.stopPropagation()}>
        <button className="pixel-btn icon ghost about-close" onClick={onClose}>X</button>
        <div className="about-logo">
          <img className="about-logo-img" src="assets/sambo_logo.svg" alt={appName} />
        </div>
        <div className="about-version">floorplan maker {version}</div>
        <div className="about-credit">created by Marcos Ovejero and Ricard Orpi</div>
      </div>
    </div>
  );
}

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

// ── Template modals ───────────────────────────────────────────────────────────

function TemplateSaveModal({ defaultName, onSave, onClose }){
  const [name, setName] = React.useState(defaultName || '');
  const handleSave = () => { if (name.trim()) onSave(name.trim()); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:360, maxWidth:'90vw'}}>
        <div className="modal-head">
          <div>
            <div className="label-amber label">SAVE</div>
            <div style={{fontFamily:"'Silkscreen', monospace", fontSize:14}}>SAVE AS TEMPLATE</div>
          </div>
          <button className="pixel-btn icon ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <div className="label">Template name</div>
            <input value={name} onChange={e => setName(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                   placeholder="e.g. Standard Loft · 400m²"
                   autoFocus/>
          </div>
          <div className="tiny muted" style={{lineHeight:1.5}}>
            Templates are saved locally in this browser. They can be reloaded for any project or adaptation.
          </div>
        </div>
        <div className="modal-foot">
          <button className="pixel-btn ghost" onClick={onClose}>CANCEL</button>
          <button className="pixel-btn primary" onClick={handleSave} disabled={!name.trim()}>SAVE TEMPLATE</button>
        </div>
      </div>
    </div>
  );
}

function TemplateLoadModal({ templates, onLoad, onDelete, onClose }){
  const [confirmId, setConfirmId] = React.useState(null);
  const [filter, setFilter] = React.useState('');
  const shown = templates.filter(t =>
    !filter || t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.projectId.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:520, maxWidth:'94vw'}}>
        <div className="modal-head">
          <div>
            <div className="label-amber label">TEMPLATES</div>
            <div style={{fontFamily:"'Silkscreen', monospace", fontSize:14}}>LOAD FLOORPLAN</div>
          </div>
          <button className="pixel-btn icon ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{gap:8}}>
          {templates.length > 3 && (
            <input value={filter} onChange={e => setFilter(e.target.value)}
                   placeholder="Filter templates…" style={{marginBottom:4}}/>
          )}
          <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:'55vh', overflowY:'auto'}}>
            {shown.length === 0 && (
              <div className="insp-empty" style={{padding:'24px 0'}}>
                <div className="tiny muted">
                  {templates.length === 0
                    ? 'No templates saved yet — use Save Template to store a floorplan layout.'
                    : 'No templates match your search.'}
                </div>
              </div>
            )}
            {shown.map(tpl => (
              <div key={tpl.id} className="pixel-box" style={{padding:'10px 12px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:"'Silkscreen', monospace", fontSize:12, marginBottom:3}}>{tpl.name}</div>
                    <div className="tiny muted">
                      {tpl.projectId} · {tpl.adaptId}
                    </div>
                    <div className="tiny muted" style={{marginTop:2}}>
                      {tpl.plan.rects?.length ?? 0} scenes · {tpl.plan.connections?.length ?? 0} connections
                      · {tpl.plan.bounds?.w ?? '?'}×{tpl.plan.bounds?.h ?? '?'}m
                      · saved {new Date(tpl.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:4, flexShrink:0}}>
                    {confirmId === tpl.id
                      ? <>
                          <button className="pixel-btn sm ghost" style={{color:'var(--danger)'}}
                                  onClick={() => { onDelete(tpl.id); setConfirmId(null); }}>CONFIRM</button>
                          <button className="pixel-btn sm ghost" onClick={() => setConfirmId(null)}>CANCEL</button>
                        </>
                      : <>
                          <button className="pixel-btn sm primary" onClick={() => onLoad(tpl)}>LOAD</button>
                          <button className="pixel-btn sm ghost" style={{color:'var(--danger)'}}
                                  title="Delete template"
                                  onClick={() => setConfirmId(tpl.id)}>✕</button>
                        </>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <span className="tiny muted">{templates.length} template{templates.length !== 1 ? 's' : ''} saved</span>
          <button className="pixel-btn ghost" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
