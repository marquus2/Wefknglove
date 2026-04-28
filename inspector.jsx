/* global React, SAMPLE, PathUtil */
// Inspector + scene list + creator/export views

const { useState, useMemo } = React;

function SceneList({ plan, selected, setSelected, conflicts }){
  return (
    <div className="scene-list scroll-y">
      {plan.rects.map((r, i) => (
        <div key={r.id}
             className={`scene-row${selected === r.id ? ' selected' : ''}${r.kind === 'unified-hub' ? ' unified' : ''}${conflicts.has(r.id) ? ' conflict' : ''}`}
             onClick={() => setSelected(r.id)}>
          <span className="ix">{r.id.replace('s','').toUpperCase()}</span>
          <span className="nm">{r.name}</span>
          <span className="meta">{r.w}×{r.h}m</span>
          {r.kind === 'unified-hub' && <span className="pixel-tag amber tiny" style={{padding:'1px 4px'}}>HUB</span>}
          {r.kind === 'individual-stop' && <span className="pixel-tag ghost tiny" style={{padding:'1px 4px'}}>1U</span>}
        </div>
      ))}
    </div>
  );
}

function Inspector({ plan, setPlan, selected, selectedConn, setSelectedConn, onAutoRoute, onDelete, conflicts }){
  const [tab, setTab] = useState('props');
  const rect = plan.rects.find(r => r.id === selected);
  const conn = plan.connections.find(c => c.id === selectedConn);

  const updateRect = (patch) => setPlan(p => ({...p, rects: p.rects.map(r => r.id === selected ? { ...r, ...patch } : r)}));
  const updateConn = (patch) => setPlan(p => ({...p, connections: p.connections.map(c => c.id === selectedConn ? { ...c, ...patch } : c)}));

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
              return (
                <div key={c.id} className="conn-row" style={{cursor:'pointer', borderColor: selectedConn === c.id ? 'var(--amber-deep)' : 'var(--hairline)'}}
                     onClick={() => setSelectedConn(c.id)}>
                  <div className="from-to">
                    <span className="tiny">{a.id.toUpperCase()}</span>
                    <span className="conn-arrow" />
                    <span className="tiny">{b.id.toUpperCase()}</span>
                  </div>
                  <span className={`pixel-tag ${c.mode === 'unified' ? 'amber' : 'ghost'} tiny`} style={{padding:'1px 5px'}}>
                    {c.mode === 'unified' ? '●' : '×6'}
                  </span>
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

      {tab === 'props' && rect && (
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
            <select value={rect.kind} onChange={(e) => updateRect({kind: e.target.value})}>
              <option value="main">Main scene</option>
              <option value="unified-hub">Unified hub (alt-content)</option>
              <option value="individual-stop">Individual stop (alt-content)</option>
            </select>
          </div>

          <div className="field">
            <div className="label">User capacity</div>
            <select value={rect.users} onChange={(e) => updateRect({users: +e.target.value})}>
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} user{n>1?'s':''}</option>)}
            </select>
          </div>

          <div className="field">
            <div className="label">Unity GameObject ID</div>
            <input value={rect.gameObject} onChange={(e) => updateRect({gameObject: e.target.value})}/>
          </div>

          <div className="divider"/>
          <div className="label">Connections from this scene</div>
          {plan.connections.filter(c => c.from === rect.id || c.to === rect.id).map(c => {
            const other = c.from === rect.id ? c.to : c.from;
            const otherRect = plan.rects.find(r => r.id === other);
            return (
              <div key={c.id} className="conn-row" onClick={() => setSelectedConn(c.id)} style={{cursor:'pointer'}}>
                <span className="tiny">{c.from === rect.id ? '→' : '←'}</span>
                <span className="flex1 tiny">{otherRect?.name}</span>
                <span className={`pixel-tag ${c.mode === 'unified' ? 'amber' : 'ghost'} tiny`} style={{padding:'1px 4px'}}>
                {c.mode === 'unified' ? '●' : '×6'}
              </span>
              </div>
            );
          })}
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
    name: 'New scene', kind: 'main', w: 4, h: 3, users: 6,
    gameObject: 'Scene_New_01', connectsTo: [],
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
              <option value="unified-hub">Unified hub · alt-content (×6)</option>
              <option value="individual-stop">Individual stop · alt-content (×1)</option>
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
function ExportView({ project, plan, onClose }){
  const [target, setTarget] = useState('android');
  const [buildPath, setBuildPath] = useState('~/Unity/galeria-moderna/');

  const json = useMemo(() => {
    const obj = {
      project: project.id,
      version: 'v0028',
      exported: new Date().toISOString(),
      bounds: plan.bounds,
      rects: plan.rects.map(r => ({
        id: r.id, name: r.name,
        position: { x: r.x, y: r.y },
        size: { w: r.w, h: r.h },
        kind: r.kind,
        users: r.users,
        gameObject: r.gameObject,
      })),
      connections: plan.connections.map(c => {
        const lanes = PathUtil.computeLanes(c, plan.rects);
        const isIndividual = c.mode === 'individual';
        return {
          id: c.id, from: c.from, to: c.to,
          mode: c.mode,
          nodesEdited: !!c.customMiddleNodes,
          // unified: single path nodes array; individual: array of 6 lane node arrays
          ...(isIndividual
            ? { lanes: lanes.map(lane => lane.map(n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) }))) }
            : { nodes: (lanes[0] || []).map(n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) })) }
          ),
        };
      }),
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
          <button className="pixel-btn primary" style={{flex:1}}>↓ DOWNLOAD JSON + RUN BUILD</button>
          <button className="pixel-btn">SAVE AS TEMPLATE</button>
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
