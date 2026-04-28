/* global React, SAMPLE */
// Dashboard — Project picker / hero screen.

const { useState, useMemo } = React;

function ProjectPickerSidebar({ projects, activeId, onPick, query, setQuery }){
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.tag.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="dash-side">
      <div className="side-section">
        <h3>Projects</h3>
        <div className="search-wrap">
          <input className="search-input" placeholder="Search projects…"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="side-section">
        <h3>Filter</h3>
        <div className="tag-list">
          {['ALL','GALLERY','RETAIL','EXPO','MUSEUM','TRAINING'].map((t,i)=>(
            <span key={t} className={`pixel-tag${i===0 ? ' active' : ''}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="proj-list scroll-y" style={{flex:1, minHeight:0}}>
        {filtered.map(p => (
          <div key={p.id}
               className={`proj-row${p.id === activeId ? ' active' : ''}`}
               onClick={() => onPick(p.id)}>
            <div className="proj-thumb-mini" />
            <div className="proj-meta">
              <div className="proj-name">{p.name}</div>
              <div className="proj-sub">{p.adaptations} adapt · {p.scenes} scenes</div>
            </div>
            <span className="pixel-tag tiny">{p.tag}</span>
          </div>
        ))}
      </div>
      <div className="side-section">
        <button className="pixel-btn primary" style={{width:'100%', justifyContent:'center'}}>
          + NEW PROJECT
        </button>
      </div>
    </div>
  );
}

// SVG mini-thumbnail of a venue floorplan
function AdaptThumb({ seed }){
  // Procedural rectangles seeded by id
  const rects = useMemo(() => {
    const rng = mulberry32(hashStr(seed));
    const out = [];
    const cols = 4, rows = 2;
    let placed = 0;
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        if (rng() < 0.18) continue;
        const w = 18 + Math.floor(rng()*22);
        const h = 14 + Math.floor(rng()*18);
        const x = 8 + c * 56 + Math.floor(rng()*4);
        const y = 14 + r * 50 + Math.floor(rng()*4);
        out.push({ x, y, w, h, alt: rng() < 0.4 });
        placed++;
      }
    }
    return out;
  }, [seed]);

  // A few connector paths
  const paths = useMemo(() => {
    const ps = [];
    for (let i = 0; i < rects.length - 1; i++){
      if (Math.random() < 0.7){
        const a = rects[i], b = rects[i+1];
        const ax = a.x + a.w, ay = a.y + a.h/2;
        const bx = b.x, by = b.y + b.h/2;
        const mx = (ax + bx) / 2;
        ps.push(`M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${by} L ${bx} ${by}`);
      }
    }
    return ps;
  }, [rects]);

  return (
    <svg viewBox="0 0 240 130" preserveAspectRatio="xMidYMid meet">
      {/* grid */}
      <defs>
        <pattern id={`thumb-grid-${seed}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="var(--hairline-2)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="240" height="130" fill={`url(#thumb-grid-${seed})`} />
      {paths.map((d, i) => (
        <path key={`p${i}`} d={d} fill="none" stroke="var(--amber-deep)" strokeWidth="1" strokeDasharray="2 2" opacity="0.7"/>
      ))}
      {rects.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h}
                fill={r.alt ? "var(--amber)" : "var(--panel-2)"}
                stroke="var(--ink)" strokeWidth="1"
                opacity={r.alt ? 0.7 : 1} />
          {r.alt && <rect x={r.x+1} y={r.y+1} width={r.w-2} height={r.h-2} fill="none" stroke="var(--ink)" strokeWidth="0.5" strokeDasharray="2 1"/>}
        </g>
      ))}
    </svg>
  );
}

function hashStr(s){
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++){
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function StatusTag({ status }){
  const map = {
    editing: { cls: 'amber', label: 'EDITING' },
    ready:   { cls: 'ok',    label: 'READY' },
    building:{ cls: '',      label: 'BUILDING' },
    draft:   { cls: 'ghost', label: 'DRAFT' },
    template:{ cls: '',      label: 'TEMPLATE' },
  };
  const m = map[status] || map.draft;
  return <span className={`pixel-tag ${m.cls}`}>{m.label}</span>;
}

function HeroDashboard({ project, adaptations, onOpenAdapt, onNewAdapt, onCreateRect }){
  return (
    <div className="hero scroll-y">
      <div className="hero-head">
        <div>
          <div className="row" style={{gap:8, marginBottom:6}}>
            <span className="pixel-tag amber">{project.tag}</span>
            <span className="label">PROJECT · {project.id.toUpperCase()}</span>
          </div>
          <h1 className="hero-title">{project.name}</h1>
          <div className="hero-sub">
            VR walkthrough with up to {project.sub.match(/\d+/)?.[0] || 6} concurrent users.
            Edit floorplan adaptations per venue, auto-route paths, then export to Unity for batch APK build.
          </div>
        </div>
        <div className="row gap-12">
          <button className="pixel-btn ghost" onClick={onCreateRect}>
            <span style={{width:10, height:10, border:'1.5px solid currentColor'}} />
            CREATOR
          </button>
          <button className="pixel-btn primary" onClick={onNewAdapt}>+ NEW ADAPTATION</button>
        </div>
      </div>

      <div className="hero-stats">
        <div className="stat">
          <div className="stat-val mono-num">{project.adaptations}</div>
          <div className="stat-lbl">Adaptations</div>
          <div className="stat-trend">+1 this week</div>
        </div>
        <div className="stat">
          <div className="stat-val mono-num">{project.scenes}</div>
          <div className="stat-lbl">Scenes total</div>
          <div className="stat-trend muted">across venues</div>
        </div>
        <div className="stat">
          <div className="stat-val mono-num">{project.paths}</div>
          <div className="stat-lbl">Routed paths</div>
          <div className="stat-trend">7 unified · 2 split</div>
        </div>
        <div className="stat">
          <div className="stat-val mono-num">{project.builds}</div>
          <div className="stat-lbl">APK builds</div>
          <div className="stat-trend">last 12m</div>
        </div>
      </div>

      <div>
        <div className="row" style={{justifyContent:'space-between', marginBottom:10}}>
          <h3 className="label">Adaptations · per venue</h3>
          <div className="row gap-12 tiny muted">
            <span>SORT: <b style={{color:'var(--ink)'}}>RECENT</b></span>
            <span>VIEW: <b style={{color:'var(--ink)'}}>GRID</b></span>
          </div>
        </div>
        <div className="adapts">
          {adaptations.map(a => (
            <div key={a.id} className="adapt-card" onClick={() => onOpenAdapt(a.id)}>
              <div className="adapt-thumb">
                <AdaptThumb seed={a.id} />
              </div>
              <div className="adapt-meta">
                <div className="adapt-meta-top">
                  <div className="adapt-name">{a.name}</div>
                  <StatusTag status={a.status} />
                </div>
                <div className="adapt-loc">{a.loc}</div>
                <div className="adapt-foot">
                  <span>{a.scenes} scenes · {a.paths} paths</span>
                  <span>{a.user} · {a.updated}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="adapt-card" onClick={onNewAdapt} style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:200, color:'var(--ink-3)'}}>
            <div className="center">
              <div style={{width:36, height:36, border:'2px dashed var(--hairline)', margin:'0 auto 10px', position:'relative'}}>
                <span style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:18, fontFamily:"'Silkscreen', monospace"}}>+</span>
              </div>
              <div className="uppercase">New adaptation</div>
              <div className="tiny" style={{marginTop:4}}>Start blank, from template, or import .DWG</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashAside({ activity, builds }){
  return (
    <div className="dash-aside">
      <div className="aside-section">
        <h3 className="label" style={{marginBottom:10}}>Pipeline status</h3>
        <div className="pipeline">
          <div className="pipe-row">
            <div className="pipe-step done">1</div>
            <div className="pipe-text">Web Floorplan Editor <small>JSON saved · 4m ago</small></div>
            <span className="status-dot" />
          </div>
          <div className="pipe-row">
            <div className="pipe-step done">2</div>
            <div className="pipe-text">Shared folder sync <small>~/projects/galeria/</small></div>
            <span className="status-dot" />
          </div>
          <div className="pipe-row">
            <div className="pipe-step active">3</div>
            <div className="pipe-text">Unity Batch Processor <small>Recalc splines… 38%</small></div>
            <span className="status-dot amber" />
          </div>
          <div className="pipe-row">
            <div className="pipe-step">4</div>
            <div className="pipe-text muted">Generate meshes <small>queued</small></div>
          </div>
          <div className="pipe-row">
            <div className="pipe-step">5</div>
            <div className="pipe-text muted">Build Android APK <small>queued</small></div>
          </div>
        </div>
      </div>

      <div className="aside-section">
        <h3 className="label" style={{marginBottom:10}}>Activity</h3>
        <div className="activity">
          {activity.map((a, i) => (
            <div key={i} className="act-row">
              <span className="act-time">{a.t}</span>
              <span className="act-text"><b>{a.who}</b> {a.text}<span className="act-tag">{a.tag}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="aside-section" style={{flex:1, minHeight:0, overflow:'auto'}}>
        <h3 className="label" style={{marginBottom:10}}>Recent builds</h3>
        <div className="recent-builds">
          <div className="build-row" style={{borderBottom:'1px solid var(--line)'}}>
            <span className="h">VER</span><span className="h">VENUE</span><span className="h">STATUS</span>
          </div>
          {builds.map(b => (
            <div key={b.v} className="build-row">
              <span>{b.v}</span>
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.adapt}</span>
              <span style={{color: b.status === 'OK' ? 'var(--ok)' : b.status === 'WARN' ? 'var(--amber-deep)' : 'var(--danger)'}}>
                {b.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.HeroDashboard = HeroDashboard;
window.ProjectPickerSidebar = ProjectPickerSidebar;
window.DashAside = DashAside;
window.AdaptThumb = AdaptThumb;
window.StatusTag = StatusTag;
