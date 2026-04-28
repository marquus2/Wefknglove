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

  const w2s = useCallback((p) => ({ x: view.x + p.x * view.scale, y: view.y + (plan.bounds.h - p.y) * view.scale }), [view, plan.bounds.h]);
  const s2w = useCallback((p) => ({ x: (p.x - view.x) / view.scale, y: plan.bounds.h - (p.y - view.y) / view.scale }), [view, plan.bounds.h]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const fit = () => {
      const r = wrapRef.current.getBoundingClientRect();
      const s = Math.max(8, Math.min((r.width - 80) / plan.bounds.w, (r.height - 80) / plan.bounds.h));
      setView({ x: (r.width - plan.bounds.w * s) / 2, y: (r.height - plan.bounds.h * s) / 2, scale: s });
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
    const ns = Math.max(6, Math.min(80, view.scale * factor));
    setView({ x: mx - wp.x * ns, y: my - (plan.bounds.h - wp.y) * ns, scale: ns });
  };

  const onPointerDown = (e) => {
    if (e.target.closest('[data-node-handle]')) return;
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
            setPlan(p => ({ ...p, rects: [...p.rects, { id, name: 'Untitled scene', x: rb.x, y: rb.y, w: rb.w, h: rb.h, kind: 'main', users: 6, gameObject: 'Scene_New' }] }));
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

  // ── Node drag (unified mode only, middle nodes only) ─────────────────────
  const beginNodeDrag = useCallback((connId, middleIdx, e, currentAllNodes) => {
    e.stopPropagation();
    const domRect = wrapRef.current.getBoundingClientRect();

    // Build starting middle nodes from current state
    const conn = plan.connections.find(c => c.id === connId);
    if (!conn) return;
    const startMiddle = conn.customMiddleNodes
      ? [...conn.customMiddleNodes]
      : currentAllNodes.slice(1, -1).map(n => ({ ...n }));

    const move = (ev) => {
      const sp = { x: ev.clientX - domRect.left, y: ev.clientY - domRect.top };
      const wp = s2w(sp);
      const snapped = { x: snap(wp.x, grid), y: snap(wp.y, grid) };
      const newMiddle = startMiddle.map((n, i) => i === middleIdx ? snapped : n);
      setPlan(p => ({
        ...p,
        connections: p.connections.map(c =>
          c.id === connId ? { ...c, customMiddleNodes: newMiddle } : c
        ),
      }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [plan, s2w, grid, setPlan]);

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
    return plan.connections.map(c => {
      const a = plan.rects.find(r => r.id === c.from);
      const b = plan.rects.find(r => r.id === c.to);
      if (!a || !b) return null;
      const lanes = PathUtil.computeLanes(c, plan.rects);
      return {
        conn: c,
        lanes,                            // array of node arrays
        laneDs: lanes.map(nodes => PathUtil.toPathD(nodes, w2s, pathStyle)),
        from: a, to: b,
      };
    }).filter(Boolean);
  }, [plan.connections, plan.rects, view, pathStyle]);

  // 1m width in screen pixels
  const laneW = view.scale * PathUtil.LANE_WIDTH;

  // ── Color helpers ─────────────────────────────────────────────────────────
  const rectFillFor = (r, isSel, isConflict) => {
    if (isConflict) return rectStyle === 'outlined' ? 'transparent' : 'oklch(0.78 0.18 28 / 0.35)';
    if (isSel)      return rectStyle === 'outlined' ? 'transparent' : 'oklch(0.85 0.12 65 / 0.35)';
    if (r.kind === 'unified-hub')     return rectStyle === 'outlined' ? 'transparent' : 'oklch(0.86 0.10 65 / 0.30)';
    if (r.kind === 'individual-stop') return rectStyle === 'outlined' ? 'transparent' : 'var(--panel)';
    if (rectStyle === 'ghosted' || rectStyle === 'outlined') return 'transparent';
    return rectStyle === 'filled' ? 'var(--panel-2)' : 'var(--panel)';
  };
  const rectStrokeFor = (r, isSel, isConflict) => {
    if (isConflict) return 'var(--danger)';
    if (isSel)      return 'var(--amber-deep)';
    if (r.kind === 'unified-hub') return 'var(--amber-deep)';
    return 'var(--ink)';
  };

  const activeRectId = isPlaying && playStep != null ? plan.tourOrder[playStep] : null;

  return (
    <div className={`canvas-stage tool-${tool}`}
         ref={wrapRef}
         onWheel={onWheel}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}>
      <svg className="canvas-svg" preserveAspectRatio="none">
        <defs>
          <pattern id="conflict-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--danger)" strokeWidth="2"/>
          </pattern>
        </defs>

        {/* Boundary */}
        <rect x={w2s({x:0,y:plan.bounds.h}).x} y={w2s({x:0,y:plan.bounds.h}).y}
              width={plan.bounds.w * view.scale} height={plan.bounds.h * view.scale}
              fill="var(--panel-2)" stroke="var(--ink)" strokeWidth="1.5"/>

        {/* Grid */}
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

        {/* ── Paths (rendered below rects) ── */}
        {layers.paths && drawnConns.map(({ conn, lanes, laneDs, from, to }) => {
          const isSel       = selectedConn === conn.id;
          const isIndiv     = conn.mode === 'individual';
          const isFlowing   = isPlaying || isSel;
          const editingPath = tool === 'edit' && isSel && !isIndiv;

          return (
            <g key={conn.id}
               onClick={(e) => { e.stopPropagation(); setSelectedConn(conn.id); setSelected(null); }}
               style={{cursor:'pointer'}}>

              {/* Wide invisible hit target */}
              {laneDs.map((d, i) =>
                <path key={`hit${i}`} d={d} fill="none" stroke="transparent" strokeWidth={laneW + 14}/>
              )}

              {/* Lane strokes — 1m wide */}
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

              {/* Flow animation overlay */}
              {isFlowing && laneDs.map((d, i) =>
                <path key={`flow${i}`} d={d} fill="none"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth={laneW * 0.35}
                      strokeDasharray={`${laneW * 0.6} ${laneW * 0.8}`}
                      style={{animation:'dash-flow 1.5s linear infinite'}}/>
              )}

              {/* Mode badge (midpoint label) */}
              {(() => {
                const mid = w2s({ x: (from.x+from.w/2+to.x+to.w/2)/2, y: (from.y+from.h/2+to.y+to.h/2)/2 });
                const label = isIndiv ? '×6' : '●';
                return (
                  <g>
                    <rect x={mid.x-14} y={mid.y-9} width="28" height="18" fill="var(--ink)" rx="1"/>
                    <text x={mid.x} y={mid.y+4} textAnchor="middle" fill="var(--paper)"
                          fontSize="10" fontFamily="'Silkscreen', monospace">{label}</text>
                  </g>
                );
              })()}

              {/* ── Node edit handles (unified only, middle nodes only) ── */}
              {editingPath && lanes.length > 0 && (() => {
                const nodes = lanes[0];
                return nodes.map((n, nodeIdx) => {
                  const sp = w2s(n);
                  const isAnchor = nodeIdx === 0 || nodeIdx === nodes.length - 1;
                  return (
                    <circle key={`nd${nodeIdx}`}
                            data-node-handle="1"
                            cx={sp.x} cy={sp.y}
                            r={isAnchor ? 6 : 8}
                            fill={isAnchor ? 'var(--panel)' : 'var(--amber)'}
                            stroke={isAnchor ? 'var(--ink-3)' : 'var(--ink)'}
                            strokeWidth={isAnchor ? 1.5 : 2}
                            style={{cursor: isAnchor ? 'not-allowed' : 'grab'}}
                            onPointerDown={isAnchor ? undefined
                              : (e) => beginNodeDrag(conn.id, nodeIdx - 1, e, nodes)}/>
                  );
                });
              })()}

              {/* Edit mode hint when no middle nodes */}
              {editingPath && lanes[0]?.length <= 2 && (() => {
                const mid = w2s({ x: (from.x+from.w/2+to.x+to.w/2)/2, y: (from.y+from.h/2+to.y+to.h/2)/2 });
                return (
                  <text x={mid.x} y={mid.y - laneW - 6} textAnchor="middle"
                        fill="var(--ink-3)" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                    ruta recta · sin nodos editables
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* ── Rectangles (above paths) ── */}
        {layers.rects && plan.rects.map(r => {
          const tl = w2s({ x: r.x, y: r.y + r.h });
          const isSel = selected === r.id;
          const isConflict = conflicts.has(r.id);
          const isActive = activeRectId === r.id;
          const sw = r.w * view.scale, sh = r.h * view.scale;
          return (
            <g key={r.id}
               onPointerDown={(e) => beginRectDrag(r, e)}
               style={{cursor: tool === 'connect' ? 'crosshair' : tool === 'select' ? 'move' : 'default'}}>
              {isConflict && <rect x={tl.x} y={tl.y} width={sw} height={sh} fill="url(#conflict-hatch)" opacity="0.5"/>}
              <rect x={tl.x} y={tl.y} width={sw} height={sh}
                    fill={rectFillFor(r, isSel, isConflict)}
                    stroke={rectStrokeFor(r, isSel, isConflict)}
                    strokeWidth={isSel||isConflict ? 2 : r.kind==='unified-hub' ? 1.5 : 1}
                    strokeDasharray={r.kind==='individual-stop' ? '4 2' : '0'}/>
              {isActive && <rect x={tl.x-4} y={tl.y-4} width={sw+8} height={sh+8} fill="none" stroke="var(--amber)" strokeWidth="3" strokeDasharray="6 3"/>}
              {connectFrom===r.id && <rect x={tl.x-3} y={tl.y-3} width={sw+6} height={sh+6} fill="none" stroke="var(--amber)" strokeWidth="2" strokeDasharray="4 2"/>}
              {isSel && <rect x={tl.x-1} y={tl.y-1} width={sw+2} height={sh+2} fill="none" stroke="var(--amber-deep)" strokeWidth="2" strokeDasharray="4 2" pointerEvents="none"/>}
              {layers.labels && sw > 50 && (
                <>
                  <text x={tl.x+6} y={tl.y+14} fill={isConflict?'var(--danger)':'var(--ink)'} fontSize="10" fontFamily="'Silkscreen', monospace" letterSpacing="0.05em">{r.id.toUpperCase()}</text>
                  <text x={tl.x+6} y={tl.y+28} fill={isConflict?'var(--danger)':'var(--ink)'} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="500">{r.name}</text>
                  {sh > 60 && <text x={tl.x+6} y={tl.y+sh-6} fill="var(--ink-3)" fontSize="9" fontFamily="'JetBrains Mono', monospace">{r.w}×{r.h}m · {r.users}u</text>}
                </>
              )}
            </g>
          );
        })}

        {/* Rubber-band creation */}
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
