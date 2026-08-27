/* global React, SAMPLE, PathUtil */
// Editor — Floorplan canvas with tools, interactions, and path rendering.

const { useState, useRef, useEffect, useMemo, useCallback } = React;

// ── Tool icons ──────────────────────────────────────────────────────────────
function ToolIcon({ kind }){
  const s = { width: 14, height: 14, position: 'relative', display:'inline-block' };
  if (kind === 'select')
    return <span style={s}><span style={{position:'absolute',left:1,top:0,width:2,height:11,background:'currentColor',transform:'rotate(-22deg)',transformOrigin:'top left'}}/><span style={{position:'absolute',left:5,top:7,width:2,height:6,background:'currentColor',transform:'rotate(-22deg)'}}/></span>;
  if (kind === 'rect')
    return <span style={{...s, border:'2px solid currentColor'}}/>;
  if (kind === 'pan')
    return <span style={s}><span style={{position:'absolute',inset:2,border:'2px solid currentColor',borderRadius:'50%'}}/></span>;
  if (kind === 'connect')
    return <span style={s}><span style={{position:'absolute',left:0,top:6,width:14,height:2,background:'currentColor'}}/><span style={{position:'absolute',left:0,top:3,width:4,height:8,background:'currentColor'}}/><span style={{position:'absolute',right:0,top:3,width:4,height:8,background:'currentColor'}}/></span>;
  if (kind === 'auto')
    return <span style={s}><span style={{position:'absolute',left:0,top:0,width:5,height:5,background:'currentColor'}}/><span style={{position:'absolute',right:0,bottom:0,width:5,height:5,background:'currentColor'}}/><span style={{position:'absolute',left:0,top:6,width:8,height:2,background:'currentColor'}}/><span style={{position:'absolute',left:6,top:0,width:2,height:8,background:'currentColor'}}/></span>;
  if (kind === 'edit')
    return <span style={s}><span style={{position:'absolute',left:1,top:9,width:12,height:2,background:'currentColor'}}/><span style={{position:'absolute',left:7,top:1,width:4,height:8,background:'currentColor',transform:'skewX(-22deg)'}}/></span>;
  return <span style={s}/>;
}

function ToolPalette({ tool, setTool }){
  const tools = [
    { id:'select',  k:'V', label:'Select & Move' },
    { id:'rect',    k:'R', label:'Draw Rect'      },
    { id:'connect', k:'C', label:'Connect'        },
    { id:'edit',    k:'E', label:'Edit Path Nodes'},
    { id:'pan',     k:'H', label:'Pan'            },
    { id:'auto',    k:'A', label:'Auto-route'     },
  ];
  return (
    <div className="tool-group">
      <h4>Tools</h4>
      <div className="tool-grid">
        {tools.map(t => (
          <button key={t.id} className="tool-btn" data-active={tool === t.id}
                  onClick={() => setTool(t.id)} title={`${t.label} (${t.k})`}>
            <ToolIcon kind={t.id} />
            <span className="k">{t.k}</span>
          </button>
        ))}
      </div>
      {tool === 'edit' && (
        <div className="tiny muted" style={{padding:'4px 6px', lineHeight:1.4}}>
          Seleccioná un path → arrastrá los nodos intermedios (naranjas)
        </div>
      )}
    </div>
  );
}

function findConflicts(rects){
  const out = new Set();
  for (let i = 0; i < rects.length; i++){
    for (let j = i + 1; j < rects.length; j++){
      // Alternate-content scenes are pure connectors — they may overlap freely
      if (rects[i].kind === 'alternate-content' || rects[j].kind === 'alternate-content') continue;
      if (PathUtil.rectsOverlap(rects[i], rects[j])){ out.add(rects[i].id); out.add(rects[j].id); }
    }
  }
  return out;
}

function snap(v, grid){ return Math.round(v / grid) * grid; }

// ── Main canvas ──────────────────────────────────────────────────────────────
function FloorplanCanvas(props){
  const {
    plan, setPlan,
    selected, setSelected,
    tool, setTool,
    pathWidth = 1,
    grid, gridStyle, pathStyle, rectStyle,
    layers, conflicts,
    isPlaying, playStep,
    selectedConn, setSelectedConn,
  } = props;

  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 30, y: 30, scale: 24 });
  const [hoverCoord, setHoverCoord] = useState(null);
  const [rubber, setRubber] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [dwgActive, setDwgActive] = useState(false);

  const w2s = useCallback((p) => ({ x: view.x + p.x * view.scale, y: view.y + (plan.bounds.h - p.y) * view.scale }), [view, plan.bounds.h]);
  const s2w = useCallback((p) => ({ x: (p.x - view.x) / view.scale, y: plan.bounds.h - (p.y - view.y) / view.scale }), [view, plan.bounds.h]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const fit = () => {
      const r = wrapRef.current.getBoundingClientRect();
      const visibleRects = plan.rects.filter(rect => rect.kind !== 'alternate-content');
      const xs = visibleRects.flatMap(rect => [rect.x, rect.x + rect.w]);
      const ys = visibleRects.flatMap(rect => [rect.y, rect.y + rect.h]);
      if (plan.dwgRef?.visible !== false && plan.dwgRef) {
        xs.push(plan.dwgRef.x - plan.dwgRef.w / 2, plan.dwgRef.x + plan.dwgRef.w / 2);
        ys.push(plan.dwgRef.y - plan.dwgRef.h / 2, plan.dwgRef.y + plan.dwgRef.h / 2);
      }
      const minX = xs.length ? Math.max(0, Math.min(...xs)) : 0;
      const maxX = xs.length ? Math.min(plan.bounds.w, Math.max(...xs)) : plan.bounds.w;
      const minY = ys.length ? Math.max(0, Math.min(...ys)) : 0;
      const maxY = ys.length ? Math.min(plan.bounds.h, Math.max(...ys)) : plan.bounds.h;
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const pad = 72;
      const fitScale = Math.min(
        Math.max(1, r.width - pad) / contentW,
        Math.max(1, r.height - pad) / contentH
      );
      const s = Math.max(2, Math.min(80, fitScale));
      setView({
        x: (r.width - contentW * s) / 2 - minX * s,
        y: (r.height - contentH * s) / 2 - (plan.bounds.h - maxY) * s,
        scale: s,
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [plan.bounds.w, plan.bounds.h]);

  const onWheel = (e) => {
    e.preventDefault();
    const r = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const wp = s2w({ x: mx, y: my });
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const ns = Math.max(2, Math.min(80, view.scale * factor));
    setView({ x: mx - wp.x * ns, y: my - (plan.bounds.h - wp.y) * ns, scale: ns });
  };

  const onPointerDown = (e) => {
    if (e.target.closest('[data-node-handle]') || e.target.closest('[data-dwg-handle]')) return;
    const r = wrapRef.current.getBoundingClientRect();
    const sp = { x: e.clientX - r.left, y: e.clientY - r.top };
    const wp = s2w(sp);

    if (tool === 'pan' || e.button === 1 || (tool === 'select' && e.shiftKey)){
      const start = { ...view };
      const sx = e.clientX, sy = e.clientY;
      wrapRef.current.classList.add('grabbing');
      const move = (ev) => setView({ ...start, x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy) });
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); wrapRef.current?.classList.remove('grabbing'); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    if (tool === 'rect'){
      const start = { x: snap(wp.x, grid), y: snap(wp.y, grid) };
      setRubber({ x: start.x, y: start.y, w: 0, h: 0, start });
      const move = (ev) => {
        const sp2 = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        const wp2 = s2w(sp2);
        const sx = snap(wp2.x, grid), sy = snap(wp2.y, grid);
        setRubber({ x: Math.min(start.x, sx), y: Math.min(start.y, sy), w: Math.abs(sx - start.x), h: Math.abs(sy - start.y), start });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setRubber(rb => {
          if (rb && rb.w >= grid && rb.h >= grid){
            const id = `s${Math.floor(Math.random()*9000)+100}`;
            setPlan(p => ({ ...p, rects: [...p.rects, { id, name: 'Untitled scene', x: rb.x, y: rb.y, w: rb.w, h: rb.h, kind: 'main', gameObject: 'Scene_New' }] }));
            setSelected(id); setTool('select');
          }
          return null;
        });
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    if (tool === 'select'){
      let hit = null;
      for (let i = plan.rects.length - 1; i >= 0; i--){
        const rc = plan.rects[i];
        if (wp.x >= rc.x && wp.x <= rc.x + rc.w && wp.y >= rc.y && wp.y <= rc.y + rc.h){ hit = rc; break; }
      }
      setSelected(hit ? hit.id : null);
      setSelectedConn(null);
    }

    if (tool === 'edit') setSelectedConn(null);
  };

  const onPointerMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    setHoverCoord(s2w({ x: e.clientX - r.left, y: e.clientY - r.top }));
  };

  // ── Rect drag-to-move ────────────────────────────────────────────────────
  const beginRectDrag = (rect, e) => {
    e.stopPropagation();
    if (tool === 'connect'){
      if (rect.kind === 'column') return;           // columns can't be connected
      if (rect.kind === 'alternate-content') return; // ACs own their paths via entry/exit — no manual connections
      if (!connectFrom){ setConnectFrom(rect.id); }
      else if (connectFrom !== rect.id){
        const newId = 'c' + Math.floor(Math.random()*9000+100);
        setPlan(p => ({ ...p, connections: [...p.connections, { id: newId, from: connectFrom, to: rect.id, mode: 'unified' }] }));
        setConnectFrom(null); setTool('select'); setSelectedConn(newId);
      }
      return;
    }
    setSelected(rect.id); setSelectedConn(null);
    if (tool !== 'select') return;

    const sx = e.clientX, sy = e.clientY;
    const start = { x: rect.x, y: rect.y };
    const move = (ev) => {
      const dx = (ev.clientX - sx) / view.scale;
      const dy = -(ev.clientY - sy) / view.scale;
      setPlan(p => ({
        ...p,
        rects: p.rects.map(r => r.id === rect.id
          ? { ...r, x: Math.max(0, Math.min(p.bounds.w - r.w, snap(start.x + dx, grid))),
                    y: Math.max(0, Math.min(p.bounds.h - r.h, snap(start.y + dy, grid))) }
          : r
        ),
      }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginDwgDrag = useCallback((e) => {
    const ref = plan.dwgRef;
    if (!ref || ref.visible === false) return;
    if (!(tool === 'select' || tool === 'edit')) return;
    e.stopPropagation();
    setDwgActive(true);
    const sx = e.clientX, sy = e.clientY;
    const start = { x: ref.x, y: ref.y };
    const move = (ev) => {
      const dx = (ev.clientX - sx) / view.scale;
      const dy = -(ev.clientY - sy) / view.scale;
      setPlan(p => {
        if (!p.dwgRef) return p;
        const nx = Math.max(0, Math.min(p.bounds.w, start.x + dx));
        const ny = Math.max(0, Math.min(p.bounds.h, start.y + dy));
        return { ...p, dwgRef: { ...p.dwgRef, x: +nx.toFixed(2), y: +ny.toFixed(2) } };
      });
    };
    const up = () => {
      setDwgActive(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [plan.dwgRef, setPlan, tool, view.scale]);

  const beginDwgScale = useCallback((e) => {
    const ref = plan.dwgRef;
    if (!ref || ref.visible === false) return;
    e.stopPropagation();
    setDwgActive(true);
    const sx = e.clientX;
    const startW = ref.w;
    const startH = ref.h;
    const ratio = startH / Math.max(startW, 0.001);
    const move = (ev) => {
      const dx = (ev.clientX - sx) / view.scale;
      const nextW = Math.max(2, startW + dx * 2);
      const nextH = Math.max(2, nextW * ratio);
      setPlan(p => p.dwgRef ? { ...p, dwgRef: { ...p.dwgRef, w: +nextW.toFixed(2), h: +nextH.toFixed(2) } } : p);
    };
    const up = () => {
      setDwgActive(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [plan.dwgRef, setPlan, view.scale]);

  // ── Node drag (unified mode only, middle nodes only) ─────────────────────

  const beginPodDrag = useCallback((rect, podIdx, e) => {
    if (tool !== 'edit') return;
    e.stopPropagation();
    const domRect = wrapRef.current.getBoundingClientRect();
    const move = (ev) => {
      const sp = { x: ev.clientX - domRect.left, y: ev.clientY - domRect.top };
      const wp = s2w(sp);
      const localX = Math.max(0, Math.min(rect.w, snap(wp.x - rect.x, grid)));
      const localY = Math.max(0, Math.min(rect.h, snap(wp.y - rect.y, grid)));
      setPlan(p => ({
        ...p,
        rects: p.rects.map(r => r.id === rect.id
          ? { ...r, pods: (r.pods || []).map((pod, i) => i === podIdx ? { ...pod, x: localX, y: localY } : pod) }
          : r),
      }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [tool, s2w, grid, setPlan]);

  const beginNodeDrag = useCallback((routeRef, laneIdx, middleIdx, e, currentAllNodes) => {
    e.stopPropagation();
    const domRect = wrapRef.current.getBoundingClientRect();

    const startMiddle = currentAllNodes.slice(1, -1).map(n => ({ ...n }));

    const move = (ev) => {
      const sp = { x: ev.clientX - domRect.left, y: ev.clientY - domRect.top };
      const wp = s2w(sp);
      const snapped = { x: snap(wp.x, grid), y: snap(wp.y, grid) };
      const newMiddle = startMiddle.map((n, i) => i === middleIdx ? snapped : n);
      setPlan(p => ({
        ...p,
        connections: routeRef.kind === 'connection'
          ? p.connections.map(c => {
              if (c.id !== routeRef.id) return c;
              if (c.mode === 'individual') {
                const customLaneMiddleNodes = [...(c.customLaneMiddleNodes || [])];
                customLaneMiddleNodes[laneIdx] = newMiddle;
                return { ...c, customLaneMiddleNodes };
              }
              return { ...c, customMiddleNodes: newMiddle };
            })
          : p.connections,
        rects: routeRef.kind === 'ac'
          ? p.rects.map(r => {
              if (r.id !== routeRef.acId) return r;
              const customRoutes = { ...(r.customRoutes || {}) };
              const route = { ...(customRoutes[routeRef.routeKey] || {}) };
              if ((r.mode || 'unified') === 'individual') {
                const customLaneMiddleNodes = [...(route.customLaneMiddleNodes || [])];
                customLaneMiddleNodes[laneIdx] = newMiddle;
                route.customLaneMiddleNodes = customLaneMiddleNodes;
              } else {
                route.customMiddleNodes = newMiddle;
              }
              customRoutes[routeRef.routeKey] = route;
              return { ...r, customRoutes };
            })
          : p.rects,
      }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [s2w, grid, setPlan]);

  // ── Grid lines ────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const lines = [];
    for (let x = 0; x <= plan.bounds.w; x += grid){
      const a = w2s({x, y:0}), b = w2s({x, y:plan.bounds.h});
      lines.push({k:'v', x1:a.x, y1:a.y, x2:b.x, y2:b.y, major: x%1===0});
    }
    for (let y = 0; y <= plan.bounds.h; y += grid){
      const a = w2s({x:0, y}), b = w2s({x:plan.bounds.w, y});
      lines.push({k:'h', x1:a.x, y1:a.y, x2:b.x, y2:b.y, major: y%1===0});
    }
    return lines;
  }, [plan.bounds, grid, view]);

  // ── Compute all connection lanes ──────────────────────────────────────────
  const drawnConns = useMemo(() => {
    const columns = plan.rects.filter(r => r.kind === 'column');
    const acIds = new Set(plan.rects.filter(r => r.kind === 'alternate-content').map(r => r.id));

    // 1. Regular connections — both endpoints must be non-AC scenes
    const regularConns = plan.connections
      .filter(c => !acIds.has(c.from) && !acIds.has(c.to))
      .map(c => {
        const a = plan.rects.find(r => r.id === c.from);
        const b = plan.rects.find(r => r.id === c.to);
        if (!a || !b) return null;
        if (PathUtil.rectsTouching(a, b)) return null;
        const lanes = PathUtil.computeLanes(c, plan.rects, columns);
        return {
          conn: c,
          lanes,
          laneDs: lanes.map(nodes => PathUtil.toPathD(nodes, w2s, pathStyle)),
          from: a, to: b,
          acId: null,
        };
      }).filter(Boolean);

    // 2. Synthetic paths from AC rects (entry→exit) — each AC owns its paths
    const acConns = [];
    plan.rects.filter(r => r.kind === 'alternate-content').forEach(r => {
      const entryIds = r.entries || (r.entry ? [r.entry] : []);
      const exitIds  = r.exits  || (r.exit  ? [r.exit]  : []);
      const mode     = r.mode || 'unified';
      entryIds.forEach(entId => {
        exitIds.forEach(extId => {
          const a = plan.rects.find(s => s.id === entId);
          const b = plan.rects.find(s => s.id === extId);
          if (!a || !b) return;
          if (PathUtil.rectsTouching(a, b)) return;
          const routeKey = `${entId}->${extId}`;
          const customRoute = r.customRoutes?.[routeKey] || {};
          const synth = {
            id: `ac-${r.id}-${entId}-${extId}`,
            from: entId,
            to: extId,
            mode,
            customMiddleNodes: customRoute.customMiddleNodes,
            customLaneMiddleNodes: customRoute.customLaneMiddleNodes,
          };
          const lanes = PathUtil.computeLanes(synth, plan.rects, columns);
          acConns.push({
            conn: synth,
            lanes,
            laneDs: lanes.map(nodes => PathUtil.toPathD(nodes, w2s, pathStyle)),
            from: a, to: b,
            acId: r.id,
            routeKey,
          });
        });
      });
    });

    return [...regularConns, ...acConns];
  }, [plan.connections, plan.rects, view, pathStyle]);

  // 1m width in screen pixels
  const laneW = view.scale * PathUtil.LANE_WIDTH * pathWidth;

  // ── Color helpers ─────────────────────────────────────────────────────────
  const rectFillFor = (r, isSel, isConflict) => {
    if (isConflict) return rectStyle === 'outlined' ? 'transparent' : 'oklch(0.78 0.18 28 / 0.35)';
    if (isSel)      return rectStyle === 'outlined' ? 'transparent' : 'oklch(0.85 0.12 65 / 0.35)';
    if (r.kind === 'alternate-content') return 'none'; // always transparent — AC is a connector, not a filled room
    if (r.kind === 'pod-room') return rectStyle === 'outlined' ? 'transparent' : 'var(--panel)';
    if (rectStyle === 'ghosted' || rectStyle === 'outlined') return 'transparent';
    return rectStyle === 'filled' ? 'var(--panel-2)' : 'var(--panel)';
  };
  const rectStrokeFor = (r, isSel, isConflict) => {
    if (isConflict) return 'var(--danger)';
    if (isSel)      return 'var(--amber-deep)';
    if (r.kind === 'alternate-content') return 'var(--amber-deep)';
    return 'var(--ink)';
  };

  const activeRectId = isPlaying && playStep != null ? plan.tourOrder[playStep] : null;
  const acMarkersByScene = useMemo(() => {
    const map = {};
    const add = (sceneId, marker) => {
      if (!sceneId) return;
      if (!map[sceneId]) map[sceneId] = [];
      map[sceneId].push(marker);
    };
    plan.rects.filter(r => r.kind === 'alternate-content').forEach(ac => {
      const entryIds = ac.entries || (ac.entry ? [ac.entry] : []);
      const exitIds = ac.exits || (ac.exit ? [ac.exit] : []);
      entryIds.forEach(id => add(id, { type: 'entry', acId: ac.id }));
      exitIds.forEach(id => add(id, { type: 'exit', acId: ac.id }));
    });
    return map;
  }, [plan.rects]);

  return (
    <div className={`canvas-stage tool-${tool}`}
         ref={wrapRef}
         onWheel={onWheel}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}>
      <svg className="canvas-svg canvas-grid-svg" preserveAspectRatio="none">
        <defs>
          <pattern id="conflict-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--danger)" strokeWidth="2"/>
          </pattern>
        </defs>

        <rect x={w2s({x:0,y:plan.bounds.h}).x} y={w2s({x:0,y:plan.bounds.h}).y}
              width={plan.bounds.w * view.scale} height={plan.bounds.h * view.scale}
              fill="var(--panel-2)" stroke="var(--ink)" strokeWidth="1.5"/>

        {layers.grid && gridStyle === 'lines' && gridLines.map((l, i) =>
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="var(--grid-color)" strokeWidth={l.major ? 0.6 : 0.3}/>
        )}
        {layers.grid && gridStyle === 'blueprint' && gridLines.map((l, i) =>
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="var(--grid-color)" strokeWidth={l.major ? 0.8 : 0.3}
                strokeDasharray={l.major ? '0' : '2 2'}/>
        )}
        {layers.grid && gridStyle === 'dots' && gridLines.filter(l=>l.k==='v').map((l, i) => {
          const cnt = Math.floor(plan.bounds.h / grid) + 1;
          return Array.from({length: cnt}, (_, j) =>
            <circle key={`d${i}-${j}`} cx={l.x1} cy={l.y1 - j*grid*view.scale} r={1} fill="var(--grid-color)"/>
          );
        })}
      </svg>

      {/* DWG visual reference: above grid, below paths and levels. */}
      {plan.dwgRef?.svgString && plan.dwgRef.visible !== false && (() => {
        const ref = plan.dwgRef;
        const tl = w2s({ x: ref.x - ref.w / 2, y: ref.y + ref.h / 2 });
        const sw = ref.w * view.scale;
        const sh = ref.h * view.scale;
        return (
          <div key={ref.svgString.length}
               className="dwg-visual-layer"
               dangerouslySetInnerHTML={{ __html: ref.svgString }}
               style={{
                 left: tl.x + 'px',
                 top:  tl.y + 'px',
                 width:  sw + 'px',
                 height: sh + 'px',
                 opacity: ref.opacity ?? 0.85,
               }} />
        );
      })()}

      <svg className="canvas-svg canvas-main-svg" preserveAspectRatio="none">
        <defs>
          <pattern id="conflict-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--danger)" strokeWidth="2"/>
          </pattern>
        </defs>

        {plan.dwgRef && plan.sourceFile && plan.dwgRef.visible !== false && (() => {
          const ref = plan.dwgRef;
          const isLocked = !!ref.locked;
          const tl = w2s({ x: ref.x - ref.w / 2, y: ref.y + ref.h / 2 });
          const sw = ref.w * view.scale;
          const sh = ref.h * view.scale;
          const br = w2s({ x: ref.x + ref.w / 2, y: ref.y - ref.h / 2 });
          return (
            <g>
              <rect x={tl.x} y={tl.y} width={sw} height={sh}
                    fill="rgba(120,170,255,0.04)"
                    stroke={isLocked ? 'rgba(80,120,200,0.3)' : dwgActive ? 'var(--amber-deep)' : 'rgba(80,120,200,0.65)'}
                    strokeWidth={dwgActive ? 2 : 1.2}
                    strokeDasharray="6 4"
                    onPointerDown={isLocked ? undefined : beginDwgDrag}
                    style={{cursor: isLocked ? 'default' : 'move'}} />
              <rect x={tl.x + 4} y={tl.y + 4} width={Math.max(80, Math.min(220, sw - 8))} height="16" fill="rgba(20,20,30,0.75)"/>
              <text x={tl.x + 8} y={tl.y + 15} fill="#dce7ff" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                {isLocked ? 'LOCKED ' : ''}DWG / {plan.sourceFile}
              </text>
              {!isLocked && (
                <circle data-dwg-handle="1" cx={br.x} cy={br.y} r="7" fill="var(--amber)" stroke="var(--ink)" strokeWidth="1.5"
                        style={{cursor:'nwse-resize'}} onPointerDown={beginDwgScale} />
              )}
            </g>
          );
        })()}

        {layers.paths && drawnConns.map(({ conn, lanes, laneDs, from, to, acId, routeKey }) => {
          const isSel       = acId ? selected === acId : selectedConn === conn.id;
          const isIndiv     = conn.mode === 'individual';
          const isFlowing   = isPlaying || isSel;
          const editingPath = tool === 'edit' && isSel;
          const routeRef = acId
            ? { kind: 'ac', acId, routeKey }
            : { kind: 'connection', id: conn.id };

          return (
            <g key={conn.id}
               onClick={(e) => {
                 e.stopPropagation();
                 if (acId) { setSelected(acId); setSelectedConn(null); }
                 else { setSelectedConn(conn.id); setSelected(null); }
               }}
               style={{cursor:'pointer'}}>
              {laneDs.map((d, i) =>
                <path key={`hit${i}`} d={d} fill="none" stroke="transparent" strokeWidth={laneW + 14}/>
              )}
              {laneDs.map((d, i) => {
                const color = isIndiv
                  ? PathUtil.LANE_COLORS[i]
                  : (isSel ? 'var(--amber-deep)' : 'var(--ink)');
                return (
                  <path key={`lane${i}`} d={d} fill="none"
                        stroke={color}
                        strokeWidth={laneW}
                        strokeLinecap="butt"
                        strokeLinejoin={pathStyle === 'rounded' ? 'round' : 'miter'}
                        opacity={isIndiv ? 0.82 : 0.75}/>
                );
              })}
              {isFlowing && laneDs.map((d, i) =>
                <path key={`flow${i}`} d={d} fill="none"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth={laneW * 0.35}
                      strokeDasharray={`${laneW * 0.6} ${laneW * 0.8}`}
                      style={{animation:'dash-flow 1.5s linear infinite'}}/>
              )}
              {(() => {
                const mid = w2s({ x: (from.x+from.w/2+to.x+to.w/2)/2, y: (from.y+from.h/2+to.y+to.h/2)/2 });
                const label = isIndiv ? 'x6' : '*';
                return (
                  <g>
                    <rect x={mid.x-14} y={mid.y-9} width="28" height="18" fill="var(--ink)" rx="1"/>
                    <text x={mid.x} y={mid.y+4} textAnchor="middle" fill="var(--paper)"
                          fontSize="10" fontFamily="'Silkscreen', monospace">{label}</text>
                  </g>
                );
              })()}
              {editingPath && lanes.map((nodes, laneIdx) =>
                nodes.map((n, nodeIdx) => {
                  const sp = w2s(n);
                  const isAnchor = nodeIdx === 0 || nodeIdx === nodes.length - 1;
                  const key = `nd-${laneIdx}-${nodeIdx}`;
                  return (
                    <circle key={key}
                            data-node-handle="1"
                            cx={sp.x} cy={sp.y}
                            r={isAnchor ? 4.5 : isIndiv ? 6 : 8}
                            fill={isAnchor ? 'var(--panel)' : (isIndiv ? PathUtil.LANE_COLORS[laneIdx] : 'var(--amber)')}
                            stroke={isAnchor ? 'var(--ink-3)' : 'var(--ink)'}
                            strokeWidth={isAnchor ? 1.2 : 2}
                            opacity={isAnchor ? 0.7 : 1}
                            style={{cursor: isAnchor ? 'not-allowed' : 'grab'}}
                            onPointerDown={isAnchor ? undefined
                              : (e) => beginNodeDrag(routeRef, laneIdx, nodeIdx - 1, e, nodes)}/>
                  );
                })
              )}
            </g>
          );
        })}

        {layers.rects && plan.rects.filter(r => r.kind !== 'alternate-content').map(r => {
          const tl = w2s({ x: r.x, y: r.y + r.h });
          const isSel = selected === r.id;
          const isConflict = conflicts.has(r.id);
          const isActive = activeRectId === r.id;
          const sw = r.w * view.scale, sh = r.h * view.scale;
          const DirArrow = () => {
            if (sw < 25 || sh < 25) return null;
            const dirRad = (r.dir || 0) * Math.PI / 180;
            const dx = Math.cos(dirRad), dy = -Math.sin(dirRad);
            const px = -dy, py = dx;
            const fx = tl.x + sw / 2 + dx * (sw / 2);
            const fy = tl.y + sh / 2 + dy * (sh / 2);
            const ax = fx - dx * 5;
            const ay = fy - dy * 5;
            const len = 9;
            const half = len * 0.55;
            const tipX = ax + dx * len;
            const tipY = ay + dy * len;
            const baseX = ax - dx * len;
            const baseY = ay - dy * len;
            return (
              <polygon points={`${tipX},${tipY} ${baseX+px*half},${baseY+py*half} ${baseX-px*half},${baseY-py*half}`}
                       fill={isSel ? 'var(--amber-deep)' : 'var(--ink-3)'}
                       opacity="0.85"
                       pointerEvents="none" />
            );
          };
          return (
            <g key={r.id}
               onPointerDown={(e) => beginRectDrag(r, e)}
               style={{cursor: tool === 'connect' ? 'crosshair' : tool === 'select' ? 'move' : 'default'}}>
              {isConflict && <rect x={tl.x} y={tl.y} width={sw} height={sh} fill="url(#conflict-hatch)" opacity="0.5"/>}
              <rect x={tl.x} y={tl.y} width={sw} height={sh}
                    fill={rectFillFor(r, isSel, isConflict)}
                    stroke={rectStrokeFor(r, isSel, isConflict)}
                    strokeWidth={isSel||isConflict ? 2 : r.kind==='alternate-content' ? 1.5 : 1}
                    strokeDasharray={r.kind==='pod-room' || r.kind==='alternate-content' ? '4 2' : '0'}/>
              {isActive && <rect x={tl.x-4} y={tl.y-4} width={sw+8} height={sh+8} fill="none" stroke="var(--amber)" strokeWidth="3" strokeDasharray="6 3"/>}
              {connectFrom===r.id && <rect x={tl.x-3} y={tl.y-3} width={sw+6} height={sh+6} fill="none" stroke="var(--amber)" strokeWidth="2" strokeDasharray="4 2"/>}
              {isSel && <rect x={tl.x-1} y={tl.y-1} width={sw+2} height={sh+2} fill="none" stroke="var(--amber-deep)" strokeWidth="2" strokeDasharray="4 2" pointerEvents="none"/>}
              {layers.labels && sw > 50 && (
                <>
                  <text x={tl.x+6} y={tl.y+14} fill={isConflict?'var(--danger)':'var(--ink)'} fontSize="10" fontFamily="'Silkscreen', monospace" letterSpacing="0.05em">{r.id.toUpperCase()}</text>
                  <text x={tl.x+6} y={tl.y+28} fill={isConflict?'var(--danger)':'var(--ink)'} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="500">{r.name}</text>
                  {sh > 60 && <text x={tl.x+6} y={tl.y+sh-6} fill="var(--ink-3)" fontSize="9" fontFamily="'JetBrains Mono', monospace">{r.w}x{r.h}m</text>}
                </>
              )}
              {(acMarkersByScene[r.id] || []).map((marker, idx) => {
                const inset = 4 + idx * 5;
                const color = marker.type === 'entry' ? 'var(--amber-deep)' : 'var(--amber)';
                const dash = marker.type === 'entry' ? '5 3' : '2 3';
                return (
                  <rect key={`${marker.acId}-${marker.type}-${idx}`}
                        x={tl.x + inset} y={tl.y + inset}
                        width={Math.max(0, sw - inset * 2)}
                        height={Math.max(0, sh - inset * 2)}
                        fill="none"
                        stroke={color}
                        strokeWidth={selected === marker.acId ? 2.2 : 1.3}
                        strokeDasharray={dash}
                        pointerEvents="none" />
                );
              })}
              <DirArrow />
              {r.kind === 'pod-room' && Array.isArray(r.pods) && r.pods.slice(0, 6).map((pod, idx) => {
                const p = w2s({ x: r.x + pod.x, y: r.y + pod.y });
                const isEditPod = tool === 'edit' && selected === r.id;
                const podRad = (pod.dir ?? 0) * Math.PI / 180;
                const adx = Math.cos(podRad), ady = -Math.sin(podRad);
                const apx = -ady, apy = adx;
                const tipLen = isEditPod ? 11 : 8;
                const half = tipLen * 0.62;
                const tip = { x: p.x + adx * tipLen, y: p.y + ady * tipLen };
                const base = { x: p.x - adx * (tipLen * 0.35), y: p.y - ady * (tipLen * 0.35) };
                const bl = { x: base.x + apx * half, y: base.y + apy * half };
                const br = { x: base.x - apx * half, y: base.y - apy * half };
                const lblX = tip.x + adx * 6;
                const lblY = tip.y + ady * 6 + 4;
                return (
                  <g key={`${r.id}-pod-${idx}`}>
                    <circle cx={p.x} cy={p.y} r={view.scale * 0.4}
                            fill="none" stroke="var(--amber)" strokeWidth="0.8"
                            strokeDasharray="3 2" opacity="0.45" pointerEvents="none"/>
                    <polygon points={`${tip.x},${tip.y} ${bl.x},${bl.y} ${br.x},${br.y}`}
                            fill="var(--amber)" stroke="var(--ink)" strokeWidth={isEditPod ? 1.5 : 1}
                            style={{cursor: isEditPod ? 'grab' : 'default'}}
                            onPointerDown={isEditPod ? (e) => beginPodDrag(r, idx, e) : undefined} />
                    <text x={lblX} y={lblY} textAnchor="middle" fill="var(--amber-deep)" fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace" pointerEvents="none">{idx + 1}</text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {rubber && (() => {
          const tl = w2s({x:rubber.x, y:rubber.y+rubber.h});
          return <rect x={tl.x} y={tl.y} width={rubber.w*view.scale} height={rubber.h*view.scale}
                       fill="oklch(0.85 0.12 65 / 0.4)" stroke="var(--amber-deep)" strokeWidth="1.5" strokeDasharray="3 3"/>;
        })()}
      </svg>

      {/* Coord readout */}
      {hoverCoord && (
        <div className="coord-readout">
          x: {hoverCoord.x.toFixed(2)}m · y: {hoverCoord.y.toFixed(2)}m · grid: {grid}m
        </div>
      )}

      {/* Edit hint */}
      {!isPlaying && tool === 'edit' && selectedConn && (
        <div className="coord-readout" style={{top:8,bottom:'auto',right:8,left:'auto',maxWidth:260}}>
          ✎ Arrastrá nodos naranjas · extremos siempre conectados
        </div>
      )}

      {/* Layer toggles */}
      {!isPlaying && (
        <div className="layer-toggles">
          <div className="label" style={{fontSize:9,marginBottom:2}}>Layers</div>
          {Object.keys(layers).map(k => (
            <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => props.setLayers({...layers,[k]:e.target.checked})}/>{k}</label>
          ))}
        </div>
      )}

      {/* Shortcuts */}
      {!isPlaying && (
        <div className="shortcuts-hint">
          <div className="row"><span className="kbd">V</span><span>select+move</span></div>
          <div className="row"><span className="kbd">R</span><span>rect</span></div>
          <div className="row"><span className="kbd">C</span><span>connect</span></div>
          <div className="row"><span className="kbd">E</span><span>edit nodes</span></div>
          <div className="row"><span className="kbd">A</span><span>auto-route</span></div>
          <div className="row"><span className="kbd">⌫</span><span>delete</span></div>
        </div>
      )}

      {/* Minimap */}
      {!isPlaying && layers.minimap && (
        <div className="minimap">
          <div className="minimap-label">MINIMAP</div>
          <svg viewBox={`0 0 ${plan.bounds.w} ${plan.bounds.h}`} preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width={plan.bounds.w} height={plan.bounds.h} fill="var(--panel-2)" stroke="var(--ink)" strokeWidth="0.2"/>
            {plan.rects.map(r => (
              <rect key={r.id} x={r.x} y={plan.bounds.h-r.y-r.h} width={r.w} height={r.h}
                    fill={r.kind==='unified-hub'?'var(--amber)':'var(--ink)'} opacity={selected===r.id?1:0.55}/>
            ))}
            {(() => {
              const tl = s2w({x:0,y:0});
              const br = s2w({x:wrapRef.current?.clientWidth||0,y:wrapRef.current?.clientHeight||0});
              return <rect x={tl.x} y={plan.bounds.h-tl.y} width={br.x-tl.x} height={tl.y-br.y} fill="none" stroke="var(--amber-deep)" strokeWidth="0.3" strokeDasharray="0.4 0.4"/>;
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}

window.FloorplanCanvas = FloorplanCanvas;
window.ToolPalette = ToolPalette;
window.findConflicts = findConflicts;
window.snap = snap;
