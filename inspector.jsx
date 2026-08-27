/* global React, SAMPLE, PathUtil */
// Inspector + scene list + creator/export views

const { useState, useMemo } = React;

function SceneList({ plan, selected, setSelected, conflicts }){
  return (
    <div className="scene-list scroll-y">
      {plan.rects.filter(r => r.kind !== 'column').map((r, i) => (
        <div key={r.id}
             className={`scene-row${selected === r.id ? ' selected' : ''}${r.kind === 'alternate-content' ? ' unified' : ''}${conflicts.has(r.id) ? ' conflict' : ''}`}
             onClick={() => setSelected(r.id)}>
          <span className="ix">{r.id.replace('s','').toUpperCase()}</span>
          <span className="nm">{r.name}</span>
          <span className="meta">{r.w}×{r.h}m</span>
          {r.kind === 'alternate-content' && <span className="pixel-tag amber tiny" style={{padding:'1px 4px'}}>ALT</span>}
          {r.kind === 'pod-room' && <span className="pixel-tag ghost tiny" style={{padding:'1px 4px'}}>PODS</span>}
        </div>
      ))}
    </div>
  );
}

function Inspector({ plan, setPlan, selected, selectedConn, setSelectedConn, onAutoRoute, onDelete, onRotateRectCW, onRotateRectCCW, onRotatePlanCW, onRotatePlanCCW, conflicts }){
  const [tab, setTab] = useState('props');
  const rect = plan.rects.find(r => r.id === selected);
  const conn = plan.connections.find(c => c.id === selectedConn);

  const updateRect = (patch) => setPlan(p => ({...p, rects: p.rects.map(r => r.id === selected ? { ...r, ...patch } : r)}));
  const updateConn = (patch) => setPlan(p => ({...p, connections: p.connections.map(c => c.id === selectedConn ? { ...c, ...patch } : c)}));
  const updateConnById = (connId, patch) => setPlan(p => ({...p, connections: p.connections.map(c => c.id === connId ? { ...c, ...patch } : c)}));
  const podRoomDefaults = [
    { id: 'pod-1', x: 1, y: 3, gameObject: 'Scene_Pod_01' },
    { id: 'pod-2', x: 2, y: 3, gameObject: 'Scene_Pod_02' },
    { id: 'pod-3', x: 3, y: 3, gameObject: 'Scene_Pod_03' },
    { id: 'pod-4', x: 1, y: 1, gameObject: 'Scene_Pod_04' },
    { id: 'pod-5', x: 2, y: 1, gameObject: 'Scene_Pod_05' },
    { id: 'pod-6', x: 3, y: 1, gameObject: 'Scene_Pod_06' },
  ];

  return (
    <div className="inspector">
      <div className="insp-tabs">
        <button className="insp-tab" data-active={tab === 'props'} onClick={() => setTab('props')}>Inspector</button>
        <button className="insp-tab" data-active={tab === 'scenes'} onClick={() => setTab('scenes')}>Scenes</button>
        <button className="insp-tab" data-active={tab === 'paths'} onClick={() => setTab('paths')}>Paths</button>
      </div>

      {tab === 'scenes' && (
        <SceneList plan={plan} selected={selected} setSelected={(id) => { setSelectedConn(null); window.dispatchEvent(new CustomEvent('select-scene', { detail: id })); }} conflicts={conflicts}/>
      )}

      {tab === 'paths' && (
        <div className="insp-body">
          <div className="label">Connections · {plan.connections.length}</div>
          <div className="conn-list">
            {plan.connections.map(c => {
              const a = plan.rects.find(r => r.id === c.from);
              const b = plan.rects.find(r => r.id === c.to);
              if (!a || !b) return null;
              const auto = PathUtil.pickFaces(a, b);
              const toggleMode = (e) => {
                e.stopPropagation();
                setPlan(p => ({ ...p, connections: p.connections.map(cc =>
                  cc.id === c.id ? { ...cc, mode: cc.mode === 'unified' ? 'individual' : 'unified', customMiddleNodes: null } : cc
                )}));
              };
              const deleteConn = (e) => {
                e.stopPropagation();
                setPlan(p => ({ ...p, connections: p.connections.filter(cc => cc.id !== c.id) }));
                setSelectedConn(null);
              };
              const FacePicker = ({ label, current, autoDir, onChange }) => (
                <div style={{display:'flex', alignItems:'center', gap:2, marginTop:3}}>
                  <span className="tiny muted" style={{minWidth:26, fontSize:9}}>{label}</span>
                  {['N','E','S','W'].map(dir => {
                    const isAuto = !current && dir === autoDir;
                    const isSet  = current === dir;
                    return (
                      <button key={dir}
                              className="pixel-btn sm ghost"
                              style={{padding:'0 4px', fontSize:9, lineHeight:'14px', minWidth:16,
                                      background: isSet ? 'var(--amber-deep)' : isAuto ? 'var(--amber)' : 'var(--panel-2)',
                                      color: (isSet || isAuto) ? '#1a0e00' : 'var(--ink-3)',
                                      opacity: isAuto ? 0.7 : 1}}
                              title={isAuto ? `Auto (${dir})` : dir}
                              onClick={(e) => { e.stopPropagation(); onChange(current === dir ? null : dir); }}>
                        {dir}
                      </button>
                    );
                  })}
                </div>
              );
              return (
                <div key={c.id} className="conn-row" style={{cursor:'pointer', borderColor: selectedConn === c.id ? 'var(--amber-deep)' : 'var(--hairline)', flexDirection:'column', alignItems:'stretch', gap:0}}
                     onClick={() => setSelectedConn(c.id)}>
                  <div style={{display:'flex', alignItems:'center', gap:4}}>
                    <div className="from-to" style={{flex:1, minWidth:0}}>
                      <span className="tiny" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                      <span className="conn-arrow" />
                      <span className="tiny" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</span>
                    </div>
                    <button className={`pixel-tag ${c.mode === 'unified' ? 'amber' : 'ghost'} tiny`}
                            style={{padding:'1px 5px', cursor:'pointer', flexShrink:0}}
                            title="Cambiar modo (● unified / ×6 individual)"
                            onClick={toggleMode}>
                      {c.mode === 'unified' ? '●' : '×6'}
                    </button>
                    <button className="pixel-btn icon sm ghost"
                            style={{padding:'0 4px', color:'var(--danger)', flexShrink:0, marginLeft:2}}
                            title="Eliminar conexión"
                            onClick={deleteConn}>✕</button>
                  </div>
                  <FacePicker label="exit" current={c.fromAnchor?.side || null} autoDir={auto.aDir}
                              onChange={(dir) => updateConnById(c.id, { fromAnchor: dir ? {side:dir, t: c.fromAnchor?.t ?? 0.5} : null, customMiddleNodes: null })}/>
                  <FacePicker label="enter" current={c.toAnchor?.side || null} autoDir={auto.bDir}
                              onChange={(dir) => updateConnById(c.id, { toAnchor: dir ? {side:dir, t: c.toAnchor?.t ?? 0.5} : null, customMiddleNodes: null })}/>
                </div>
              );
            })}
          </div>
          <button className="pixel-btn" onClick={onAutoRoute} style={{marginTop:8}}>
            ⟷ AUTO-ROUTE ALL
          </button>
        </div>
      )}

      {tab === 'props' && !rect && !conn && (
        <div className="insp-empty">
          <div className="glyph" />
          <div>No selection</div>
          <div className="tiny" style={{marginTop:6, color:'var(--ink-3)'}}>Click a scene rectangle or path on canvas, or pick from the Scenes tab.</div>
        </div>
      )}

      {tab === 'props' && rect && rect.kind === 'alternate-content' && (
        <div className="insp-body">
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="label-amber label">ALT CONTENT · {rect.id.toUpperCase()}</div>
              <div style={{fontFamily:"'VT323', monospace", fontSize:22, lineHeight:1.1, marginTop:2}}>{rect.name}</div>
            </div>
            <button className="pixel-btn icon ghost danger sm" title="Delete" onClick={() => onDelete(rect.id)}>✕</button>
          </div>
          <div className="pixel-inset" style={{padding:'5px 8px', fontSize:10, lineHeight:1.5, color:'var(--amber-deep)'}}>
            AC scenes are pure connectors — they have no physical presence on the canvas. Edit entry/exit below to control where the connecting paths appear.
          </div>
          <div className="field">
            <div className="label">Name</div>
            <input value={rect.name} onChange={(e) => updateRect({name: e.target.value})}/>
          </div>
          <div className="field">
            <div className="label">Mode</div>
            <select value={rect.mode || 'unified'} onChange={(e) => updateRect({mode: e.target.value})}>
              <option value="unified">● Unified (1 shared path)</option>
              <option value="individual">×6 Individual (6 parallel paths)</option>
            </select>
          </div>
          <div className="field">
            <div className="label">Entry scene(s) — IN overlay</div>
            {(() => {
              const entryIds = rect.entries || (rect.entry ? [rect.entry] : []);
              const isMulti = !!rect.entries;
              return (
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  {entryIds.map((eid, i) => (
                    <div key={i} style={{display:'flex', gap:4, alignItems:'center'}}>
                      <select style={{flex:1}} value={eid}
                              onChange={(e) => {
                                if (isMulti) {
                                  const next = entryIds.map((x, j) => j === i ? e.target.value : x);
                                  updateRect({entries: next, entry: undefined});
                                } else {
                                  updateRect({entry: e.target.value, entries: undefined});
                                }
                              }}>
                        <option value="">— none —</option>
                        {plan.rects.filter(r => r.id !== rect.id && r.kind !== 'alternate-content').map(r =>
                          <option key={r.id} value={r.id}>{r.name}</option>
                        )}
                      </select>
                      {isMulti && <button className="pixel-btn icon sm ghost" style={{padding:'0 4px', color:'var(--danger)'}}
                        onClick={() => { const next = entryIds.filter((_, j) => j !== i); updateRect({entries: next.length > 1 ? next : undefined, entry: next.length === 1 ? next[0] : undefined}); }}>✕</button>}
                    </div>
                  ))}
                  <button className="pixel-btn sm ghost" style={{fontSize:10}}
                    onClick={() => {
                      const next = [...entryIds, ''];
                      updateRect({entries: next, entry: undefined});
                    }}>＋ add entry</button>
                </div>
              );
            })()}
          </div>
          <div className="field">
            <div className="label">Exit scene(s) — OUT overlay</div>
            {(() => {
              const exitIds = rect.exits || (rect.exit ? [rect.exit] : []);
              const isMulti = !!rect.exits;
              return (
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  {exitIds.map((xid, i) => (
                    <div key={i} style={{display:'flex', gap:4, alignItems:'center'}}>
                      <select style={{flex:1}} value={xid}
                              onChange={(e) => {
                                if (isMulti) {
                                  const next = exitIds.map((x, j) => j === i ? e.target.value : x);
                                  updateRect({exits: next, exit: undefined});
                                } else {
                                  updateRect({exit: e.target.value, exits: undefined});
                                }
                              }}>
                        <option value="">— none —</option>
                        {plan.rects.filter(r => r.id !== rect.id && r.kind !== 'alternate-content').map(r =>
                          <option key={r.id} value={r.id}>{r.name}</option>
                        )}
                      </select>
                      {isMulti && <button className="pixel-btn icon sm ghost" style={{padding:'0 4px', color:'var(--danger)'}}
                        onClick={() => { const next = exitIds.filter((_, j) => j !== i); updateRect({exits: next.length > 1 ? next : undefined, exit: next.length === 1 ? next[0] : undefined}); }}>✕</button>}
                    </div>
                  ))}
                  <button className="pixel-btn sm ghost" style={{fontSize:10}}
                    onClick={() => {
                      const next = [...exitIds, ''];
                      updateRect({exits: next, exit: undefined});
                    }}>＋ add exit</button>
                </div>
              );
            })()}
          </div>
          <div className="field">
            <div className="label">Unity GameObject ID</div>
            <input value={rect.gameObject} onChange={(e) => updateRect({gameObject: e.target.value})}/>
          </div>
        </div>
      )}

      {tab === 'props' && rect && rect.kind !== 'alternate-content' && (
        <div className="insp-body">
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="label-amber label">SCENE · {rect.id.toUpperCase()}</div>
              <div style={{fontFamily:"'VT323', monospace", fontSize:22, lineHeight:1.1, marginTop:2}}>{rect.name}</div>
            </div>
            <button className="pixel-btn icon ghost danger sm" title="Delete" onClick={() => onDelete(rect.id)}>✕</button>
          </div>

          {conflicts.has(rect.id) && (
            <div className="pixel-tag danger" style={{padding:'4px 8px', alignSelf:'flex-start'}}>
              ⚠ OVERLAP DETECTED
            </div>
          )}

          <div className="field">
            <div className="label">Name</div>
            <input value={rect.name} onChange={(e) => updateRect({name: e.target.value})}/>
          </div>

          <div className="field">
            <div className="label">Position (m)</div>
            <div className="field-row">
              <input type="number" step="0.1" value={rect.x} onChange={(e) => updateRect({x: +e.target.value})}/>
              <input type="number" step="0.1" value={rect.y} onChange={(e) => updateRect({y: +e.target.value})}/>
            </div>
          </div>

          <div className="field">
            <div className="label">Size (m)</div>
            <div className="field-row">
              <input type="number" step="0.1" value={rect.w} onChange={(e) => updateRect({w: +e.target.value})}/>
              <input type="number" step="0.1" value={rect.h} onChange={(e) => updateRect({h: +e.target.value})}/>
            </div>
          </div>

          <div className="field">
            <div className="label">Scene type</div>
            <select value={rect.kind} onChange={(e) => {
              const next = e.target.value;
              updateRect({
                kind: next,
                ...(next === 'pod-room' ? { pods: rect.pods?.length === 6 ? rect.pods : podRoomDefaults } : {}),
              });
            }}>
              <option value="main">Main scene</option>
              <option value="alternate-content">Alternate Content (connector)</option>
              <option value="pod-room">Room with 6 pods (individual)</option>
              <option value="column">Column (obstacle)</option>
            </select>
          </div>

          <div className="field">
            <div className="label">Unity GameObject ID</div>
            <input value={rect.gameObject} onChange={(e) => updateRect({gameObject: e.target.value})}/>
          </div>
          {rect.kind === 'pod-room' && (
            <div className="field">
              <div className="label">Pods (local position inside room)</div>
              <div className="pixel-inset" style={{padding:8, display:'flex', flexDirection:'column', gap:6}}>
                {(rect.pods || podRoomDefaults).slice(0, 6).map((pod, i) => (
                  <div key={pod.id || i} style={{display:'flex', flexDirection:'column', gap:3, marginBottom:4, borderBottom:'1px solid var(--hairline)', paddingBottom:4}}>
                    <div className="field-row pod-row">
                      <input type="number" step="0.1" value={pod.x} title="X (local)"
                             onChange={(e) => updateRect({ pods: (rect.pods || podRoomDefaults).map((p, idx) => idx === i ? { ...p, x: +e.target.value } : p) })}/>
                      <input type="number" step="0.1" value={pod.y} title="Y (local)"
                             onChange={(e) => updateRect({ pods: (rect.pods || podRoomDefaults).map((p, idx) => idx === i ? { ...p, y: +e.target.value } : p) })}/>
                      <select value={pod.dir ?? 0} title="Direction"
                              style={{width:60, fontSize:11}}
                              onChange={(e) => updateRect({ pods: (rect.pods || podRoomDefaults).map((p, idx) => idx === i ? { ...p, dir: +e.target.value } : p) })}>
                        <option value={0}>E →</option>
                        <option value={90}>N ↑</option>
                        <option value={180}>W ←</option>
                        <option value={270}>S ↓</option>
                      </select>
                    </div>
                    <input value={pod.gameObject || ''} title="GameObject"
                           onChange={(e) => updateRect({ pods: (rect.pods || podRoomDefaults).map((p, idx) => idx === i ? { ...p, gameObject: e.target.value } : p) })}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divider"/>
          <div className="label">Rotate</div>
          <div className="row gap-12" style={{marginBottom:8}}>
            <button className="pixel-btn sm" onClick={onRotateRectCCW}>↺ ROOM</button>
            <button className="pixel-btn sm" onClick={onRotateRectCW}>↻ ROOM</button>
          </div>
          <div className="row gap-12" style={{marginBottom:8}}>
            <button className="pixel-btn sm ghost" onClick={onRotatePlanCCW}>↺ FLOORPLAN</button>
            <button className="pixel-btn sm ghost" onClick={onRotatePlanCW}>↻ FLOORPLAN</button>
          </div>
          <div className="divider"/>
          <div className="label">Connections</div>
          {plan.connections.filter(c => c.from === rect.id || c.to === rect.id).map(c => {
            const other = c.from === rect.id ? c.to : c.from;
            const otherRect = plan.rects.find(r => r.id === other);
            const isSource = c.from === rect.id;
            const auto = otherRect ? PathUtil.pickFaces(
              plan.rects.find(r => r.id === c.from),
              plan.rects.find(r => r.id === c.to)
            ) : { aDir: 'E', bDir: 'W' };
            const toggleMode = (e) => {
              e.stopPropagation();
              setPlan(p => ({ ...p, connections: p.connections.map(cc =>
                cc.id === c.id ? { ...cc, mode: cc.mode === 'unified' ? 'individual' : 'unified', customMiddleNodes: null } : cc
              )}));
            };
            const deleteConn = (e) => {
              e.stopPropagation();
              setPlan(p => ({ ...p, connections: p.connections.filter(cc => cc.id !== c.id) }));
            };
            const FacePicker = ({ label, current, autoDir, onChange }) => (
              <div style={{display:'flex', alignItems:'center', gap:2, marginTop:2}}>
                <span className="tiny muted" style={{minWidth:26, fontSize:9}}>{label}</span>
                {['N','E','S','W'].map(dir => {
                  const isAuto = !current && dir === autoDir;
                  const isSet  = current === dir;
                  return (
                    <button key={dir} className="pixel-btn sm ghost"
                            style={{padding:'0 4px', fontSize:9, lineHeight:'14px', minWidth:16,
                                    background: isSet ? 'var(--amber-deep)' : isAuto ? 'var(--amber)' : 'var(--panel-2)',
                                    color: (isSet || isAuto) ? '#1a0e00' : 'var(--ink-3)',
                                    opacity: isAuto ? 0.7 : 1}}
                            title={isAuto ? `Auto (${dir})` : dir}
                            onClick={(e) => { e.stopPropagation(); onChange(current === dir ? null : dir); }}>
                      {dir}
                    </button>
                  );
                })}
              </div>
            );
            return (
              <div key={c.id} className="conn-row" onClick={() => setSelectedConn(c.id)} style={{cursor:'pointer', flexDirection:'column', alignItems:'stretch', gap:0}}>
                <div style={{display:'flex', alignItems:'center', gap:4}}>
                  <span className="tiny" style={{flexShrink:0}}>{isSource ? '→' : '←'}</span>
                  <span className="flex1 tiny" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{otherRect?.name}</span>
                  <button className={`pixel-tag ${c.mode === 'unified' ? 'amber' : 'ghost'} tiny`}
                          style={{padding:'1px 4px', cursor:'pointer', flexShrink:0}}
                          title="Cambiar modo"
                          onClick={toggleMode}>
                    {c.mode === 'unified' ? '●' : '×6'}
                  </button>
                  <button className="pixel-btn icon sm ghost"
                          style={{padding:'0 4px', color:'var(--danger)', flexShrink:0, marginLeft:2}}
                          title="Eliminar" onClick={deleteConn}>✕</button>
                </div>
                {isSource
                  ? <FacePicker label="exit" current={c.fromAnchor?.side || null} autoDir={auto.aDir}
                                onChange={(dir) => updateConnById(c.id, { fromAnchor: dir ? {side:dir, t: c.fromAnchor?.t ?? 0.5} : null, customMiddleNodes: null })}/>
                  : <FacePicker label="enter" current={c.toAnchor?.side || null} autoDir={auto.bDir}
                                onChange={(dir) => updateConnById(c.id, { toAnchor: dir ? {side:dir, t: c.toAnchor?.t ?? 0.5} : null, customMiddleNodes: null })}/>
                }
              </div>
            );
          })}
          {/* ── Add new connections inline ── */}
          <div style={{marginTop:6, display:'flex', flexDirection:'column', gap:4}}>
            <select className="pixel-input sm" style={{fontSize:11}}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const toId = e.target.value;
                      const newId = 'c' + Math.floor(Math.random()*9000+100);
                      setPlan(p => ({...p, connections: [...p.connections, {id:newId, from:rect.id, to:toId, mode:'unified'}]}));
                    }}>
              <option value="">＋ Conectar salida hacia…</option>
              {plan.rects
                .filter(r => r.id !== rect.id && r.kind !== 'alternate-content' && !plan.connections.some(c => c.from === rect.id && c.to === r.id))
                .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="pixel-input sm" style={{fontSize:11}}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const fromId = e.target.value;
                      const newId = 'c' + Math.floor(Math.random()*9000+100);
                      setPlan(p => ({...p, connections: [...p.connections, {id:newId, from:fromId, to:rect.id, mode:'unified'}]}));
                    }}>
              <option value="">＋ Conectar entrada desde…</option>
              {plan.rects
                .filter(r => r.id !== rect.id && r.kind !== 'alternate-content' && !plan.connections.some(c => c.from === r.id && c.to === rect.id))
                .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {tab === 'props' && conn && !rect && (
        <div className="insp-body">
          <div className="label-amber label">CONNECTION · {conn.id.toUpperCase()}</div>
          <div style={{fontFamily:"'VT323', monospace", fontSize:22, lineHeight:1.1}}>
            {plan.rects.find(r => r.id === conn.from)?.name}
            <span style={{color:'var(--ink-3)'}}> → </span>
            {plan.rects.find(r => r.id === conn.to)?.name}
          </div>
          <div className="field">
            <div className="label">Mode</div>
            <select value={conn.mode} onChange={(e) => updateConn({mode: e.target.value, customMiddleNodes: null})}>
              <option value="unified">Unified (● · 1 route, todos juntos)</option>
              <option value="individual">Individual (×6 · 6 rutas paralelas)</option>
            </select>
          </div>
          <div className="field">
            <div className="label">From anchor</div>
            <div className="field-row">
              <select value={conn.fromAnchor?.side || ''} onChange={(e) => updateConn({ fromAnchor: { side: e.target.value || undefined, t: conn.fromAnchor?.t ?? 0.5 } })}>
                <option value="">Auto side</option>
                <option value="N">North</option><option value="E">East</option><option value="S">South</option><option value="W">West</option>
              </select>
              <input type="number" min="0.04" max="0.96" step="0.01" value={conn.fromAnchor?.t ?? 0.5}
                     onChange={(e) => updateConn({ fromAnchor: { side: conn.fromAnchor?.side, t: +e.target.value } })}/>
            </div>
          </div>
          <div className="field">
            <div className="label">To anchor</div>
            <div className="field-row">
              <select value={conn.toAnchor?.side || ''} onChange={(e) => updateConn({ toAnchor: { side: e.target.value || undefined, t: conn.toAnchor?.t ?? 0.5 } })}>
                <option value="">Auto side</option>
                <option value="N">North</option><option value="E">East</option><option value="S">South</option><option value="W">West</option>
              </select>
              <input type="number" min="0.04" max="0.96" step="0.01" value={conn.toAnchor?.t ?? 0.5}
                     onChange={(e) => updateConn({ toAnchor: { side: conn.toAnchor?.side, t: +e.target.value } })}/>
            </div>
          </div>
          <div className="pixel-inset" style={{padding:'6px 8px', fontSize:10, lineHeight:1.5}}>
            {conn.mode === 'unified'
              ? '● Un solo path para los 6 usuarios. Editable con herramienta E.'
              : '×6 Seis paths paralelos, uno por usuario. Auto-generados desde la misma cara.'}
          </div>
          <button className="pixel-btn ghost danger sm" onClick={() => {
            setPlan(p => ({...p, connections: p.connections.filter(c => c.id !== conn.id)}));
            setSelectedConn(null);
          }}>✕ DELETE CONNECTION</button>
          <div className="divider"/>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
            <div className="label" style={{marginBottom:0}}>
              Path nodes {conn.customMiddleNodes ? <span style={{color:'var(--amber-deep)'}}>· custom</span> : '· auto'}
            </div>
            {conn.customMiddleNodes && (
              <button className="pixel-btn sm ghost" style={{padding:'2px 6px', fontSize:10}}
                      onClick={() => updateConn({ customMiddleNodes: null })}>
                ↺ RESET AUTO
              </button>
            )}
          </div>
          <div className="pixel-inset" style={{padding:8, fontSize:10, fontFamily:"'JetBrains Mono', monospace"}}>
            {(() => {
              const lanes = PathUtil.computeLanes(conn, plan.rects);
              if (!lanes.length) return <div className="muted">—</div>;
              const nodes = lanes[0];
              return nodes.map((n, i) => (
                <div key={i}>{i.toString().padStart(2,'0')}: ({n.x.toFixed(2)}, {n.y.toFixed(2)})</div>
              ));
            })()}
          </div>
          {conn.mode === 'unified' && (
            <div className="tiny muted" style={{marginTop:4}}>
              Usá la herramienta E para editar nodos intermedios en el canvas
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Creator modal — define a rect from scratch
function CreatorModal({ onClose, onCreate, plan }){
  const [form, setForm] = useState({
    name: 'New scene', kind: 'main', w: 4, h: 3,
    gameObject: 'Scene_New_01', connectsTo: [],
    pods: [
      { id: 'pod-1', x: 1, y: 3, gameObject: 'Scene_Pod_01' },
      { id: 'pod-2', x: 2, y: 3, gameObject: 'Scene_Pod_02' },
      { id: 'pod-3', x: 3, y: 3, gameObject: 'Scene_Pod_03' },
      { id: 'pod-4', x: 1, y: 1, gameObject: 'Scene_Pod_04' },
      { id: 'pod-5', x: 2, y: 1, gameObject: 'Scene_Pod_05' },
      { id: 'pod-6', x: 3, y: 1, gameObject: 'Scene_Pod_06' },
    ],
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="label-amber label">CREATE</div>
            <div style={{fontFamily:"'Silkscreen', monospace", fontSize:14}}>NEW SCENE RECTANGLE</div>
          </div>
          <button className="pixel-btn icon ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <div className="label">Scene name</div>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}/>
          </div>
          <div className="field-row">
            <div className="field">
              <div className="label">Width (m)</div>
              <input type="number" step="0.1" value={form.w} onChange={(e) => setForm({...form, w: +e.target.value})}/>
            </div>
            <div className="field">
              <div className="label">Height (m)</div>
              <input type="number" step="0.1" value={form.h} onChange={(e) => setForm({...form, h: +e.target.value})}/>
            </div>
          </div>
          <div className="field">
            <div className="label">Scene type</div>
            <select value={form.kind} onChange={(e) => setForm({...form, kind: e.target.value})}>
              <option value="main">Main scene</option>
              <option value="alternate-content">Alternate Content (connector)</option>
              <option value="pod-room">Room with 6 pods · individual lanes</option>
            </select>
          </div>
          <div className="field">
            <div className="label">Unity GameObject</div>
            <input value={form.gameObject} onChange={(e) => setForm({...form, gameObject: e.target.value})}/>
          </div>
          <div className="field">
            <div className="label">Connect to (alt-content paths)</div>
            <div className="pixel-inset" style={{padding:8, maxHeight:120, overflow:'auto'}}>
              {plan.rects.map(r => (
                <label key={r.id} style={{display:'flex', gap:6, fontSize:11, padding:'2px 0'}}>
                  <input type="checkbox" checked={form.connectsTo.includes(r.id)}
                         onChange={(e) => {
                           const next = e.target.checked ? [...form.connectsTo, r.id] : form.connectsTo.filter(x => x !== r.id);
                           setForm({...form, connectsTo: next});
                         }}/>
                  <span>{r.id.toUpperCase()} · {r.name}</span>
                  <span className="muted tiny right">{r.kind}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="pixel-btn ghost" onClick={onClose}>CANCEL</button>
          <button className="pixel-btn primary" onClick={() => onCreate(form)}>+ ADD TO CANVAS</button>
        </div>
      </div>
    </div>
  );
}

// Export view — JSON preview + build command
function ExportView({ project, plan, onClose, onSaveTemplate }){
  const [target, setTarget] = useState('android');
  const [buildPath, setBuildPath] = useState('~/Unity/galeria-moderna/');

  const handleDownloadJson = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-v0028.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const json = useMemo(() => {
    const columns = plan.rects.filter(r => r.kind === 'column');
    const acIds = new Set(plan.rects.filter(r => r.kind === 'alternate-content').map(r => r.id));
    const toPoint = n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) });
    const toPathPayload = lanes => ({
      nodes: (lanes[0] || []).map(toPoint),
      lanes: lanes.map(lane => lane.map(toPoint)),
    });
    const stripSvg = ref => {
      if (!ref) return null;
      const clean = { ...ref };
      delete clean.svgString;
      return clean;
    };

    const regularPaths = plan.connections
      .filter(c => !acIds.has(c.from) && !acIds.has(c.to))
      .map(c => {
        const lanes = PathUtil.computeLanes(c, plan.rects, columns);
        return {
          type: 'connection',
          id: c.id,
          from: c.from,
          to: c.to,
          mode: c.mode,
          fromAnchor: c.fromAnchor || null,
          toAnchor: c.toAnchor || null,
          customMiddleNodes: c.customMiddleNodes || null,
          customLaneMiddleNodes: c.customLaneMiddleNodes || null,
          ...toPathPayload(lanes),
        };
      });

    const alternateContentPaths = [];
    plan.rects.filter(r => r.kind === 'alternate-content').forEach(r => {
      const entryIds = r.entries || (r.entry ? [r.entry] : []);
      const exitIds = r.exits || (r.exit ? [r.exit] : []);
      const mode = r.mode || 'unified';
      entryIds.forEach(entId => {
        exitIds.forEach(extId => {
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
          alternateContentPaths.push({
            type: 'alternate-content',
            id: synth.id,
            acId: r.id,
            routeKey,
            from: entId,
            to: extId,
            mode,
            customMiddleNodes: customRoute.customMiddleNodes || null,
            customLaneMiddleNodes: customRoute.customLaneMiddleNodes || null,
            ...toPathPayload(lanes),
          });
        });
      });
    });

    const obj = {
      project: project.id,
      version: 'v0028',
      exported: new Date().toISOString(),
      bounds: plan.bounds,
      sourceFile: plan.sourceFile || null,
      dwgRef: stripSvg(plan.dwgRef),
      rects: plan.rects.map(r => ({
        id: r.id, name: r.name,
        position: { x: r.x, y: r.y },
        size: { w: r.w, h: r.h },
        dir: r.dir || 0,
        kind: r.kind,
        gameObject: r.gameObject,
        pods: r.pods,
        entry: r.entry,
        exit: r.exit,
        entries: r.entries,
        exits: r.exits,
        mode: r.mode,
        customRoutes: r.customRoutes,
      })),
      connections: plan.connections.map(c => {
        const lanes = PathUtil.computeLanes(c, plan.rects, columns);
        const isIndividual = c.mode === 'individual';
        return {
          id: c.id, from: c.from, to: c.to,
          mode: c.mode,
          fromAnchor: c.fromAnchor || null,
          toAnchor: c.toAnchor || null,
          customMiddleNodes: c.customMiddleNodes || null,
          customLaneMiddleNodes: c.customLaneMiddleNodes || null,
          nodesEdited: !!(c.customMiddleNodes?.length || c.customLaneMiddleNodes?.some(nodes => nodes?.length)),
          // unified: single path nodes array; individual: array of 6 lane node arrays
          ...(isIndividual
            ? { lanes: lanes.map(lane => lane.map(n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) }))) }
            : { nodes: (lanes[0] || []).map(n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) })) }
          ),
        };
      }),
      paths: [...regularPaths, ...alternateContentPaths],
      tourOrder: plan.tourOrder,
    };
    return JSON.stringify(obj, null, 2);
  }, [project, plan]);

  // Light syntax highlight
  const highlighted = json
    .replace(/("[^"]+"):/g, '<span class="json-key">$1</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>');

  return (
    <div className="export">
      <div className="export-left">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="label-amber label">EXPORT</div>
            <div className="hero-title" style={{fontSize:22, marginTop:4}}>BUILD PIPELINE</div>
            <div className="muted tiny" style={{marginTop:6, maxWidth:380}}>Generates a JSON layout + a Unity batch command to compile the APK with all changes applied.</div>
          </div>
          <button className="pixel-btn ghost" onClick={onClose}>← BACK TO EDITOR</button>
        </div>

        <div className="pixel-box" style={{padding:14}}>
          <div className="label" style={{marginBottom:8}}>Target</div>
          <div className="row gap-12">
            {[
              {id:'android', label:'Android APK'},
              {id:'oculus',  label:'Oculus Build'},
              {id:'json',    label:'JSON only'},
            ].map(t => (
              <button key={t.id} className="pixel-btn sm"
                      data-pressed={target===t.id}
                      onClick={() => setTarget(t.id)}
                      style={{
                        background: target === t.id ? 'var(--amber)' : 'var(--panel-2)',
                        color: target === t.id ? '#1a0e00' : 'var(--ink)',
                      }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pixel-box" style={{padding:14}}>
          <div className="label" style={{marginBottom:8}}>Project location</div>
          <input value={buildPath} onChange={(e) => setBuildPath(e.target.value)} className="search-input" style={{paddingLeft:8}}/>
          <div className="tiny muted" style={{marginTop:8}}>Unity will be invoked with this project root. JSON is written to <b>~/floorplans/{project.id}/v0028.json</b></div>
        </div>

        <div className="pixel-box" style={{padding:14}}>
          <div className="label" style={{marginBottom:8}}>Build command</div>
          <div className="pixel-inset" style={{padding:10, fontSize:11, fontFamily:"'JetBrains Mono', monospace", lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-all'}}>
            <span className="muted">$ </span>
            unity-batch --project "{buildPath}" \<br/>
            &nbsp;&nbsp;--floorplan ~/floorplans/{project.id}/v0028.json \<br/>
            &nbsp;&nbsp;--build {target} \<br/>
            &nbsp;&nbsp;--out ~/builds/{project.id}-v0028.{target === 'android' ? 'apk' : target === 'oculus' ? 'apk' : 'json'}
          </div>
        </div>

        <div className="pixel-box" style={{padding:14}}>
          <div className="label" style={{marginBottom:8}}>Pre-flight checks</div>
          <div className="col" style={{gap:6, fontSize:11}}>
            <div className="row gap-12"><span className="status-dot" /><span>{plan.rects.length} scenes mapped to GameObjects</span></div>
            <div className="row gap-12"><span className="status-dot" /><span>{plan.connections.length} connections routed (0/45/90°)</span></div>
            <div className="row gap-12"><span className="status-dot" /><span>No overlapping rectangles</span></div>
            <div className="row gap-12"><span className="status-dot amber" /><span>Spline mesh resolution: 0.5m (auto)</span></div>
            <div className="row gap-12"><span className="status-dot" /><span>Tour order: {plan.tourOrder.length} steps</span></div>
          </div>
        </div>

        <div className="row gap-12">
          <button className="pixel-btn primary" style={{flex:1}} onClick={handleDownloadJson}>↓ DOWNLOAD JSON</button>
          <button className="pixel-btn" onClick={onSaveTemplate}>⊞ SAVE AS TEMPLATE</button>
        </div>
      </div>
      <div className="export-right">
        <div className="row" style={{justifyContent:'space-between', marginBottom:10}}>
          <span className="label-amber label">PREVIEW · v0028.json</span>
          <span className="tiny muted">{json.length.toLocaleString()} bytes</span>
        </div>
        <pre dangerouslySetInnerHTML={{__html: highlighted}} />
      </div>
    </div>
  );
}

window.SceneList = SceneList;
window.Inspector = Inspector;
window.CreatorModal = CreatorModal;
window.ExportView = ExportView;
