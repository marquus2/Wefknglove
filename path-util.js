// Path routing helpers — orthogonal auto-routing between rectangles.
// Two modes: 'unified' (1 thick path) | 'individual' (always 6 parallel lanes)

const PathUtil = (function(){

  // ── Constants ──────────────────────────────────────────────────────────────
  const LANE_COUNT = 6;
  let LANE_WIDTH = 0.6;   // meters, each lane is 60cm wide
  let LANE_GAP = 0.1;     // meters gap between lane edges
  let LANE_SPACING = LANE_WIDTH + LANE_GAP;  // center-to-center
  let TOTAL_SPAN = (LANE_COUNT - 1) * LANE_SPACING;
  let LANE_OFFSETS = [];
  const refreshLaneMetrics = () => {
    LANE_SPACING = LANE_WIDTH + LANE_GAP;
    TOTAL_SPAN = (LANE_COUNT - 1) * LANE_SPACING;
    LANE_OFFSETS = Array.from({ length: LANE_COUNT }, (_, i) =>
      -TOTAL_SPAN / 2 + i * LANE_SPACING
    );
  };
  refreshLaneMetrics();

  // 6 visually distinct colors for individual lanes
  const LANE_COLORS = [
    'oklch(0.62 0.22 25)',   // red
    'oklch(0.65 0.20 50)',   // orange
    'oklch(0.62 0.18 80)',   // yellow-olive
    'oklch(0.55 0.18 148)',  // green
    'oklch(0.52 0.18 250)',  // blue
    'oklch(0.52 0.18 290)',  // purple
  ];

  // ── Primitives ─────────────────────────────────────────────────────────────

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function rectCenter(r){ return { x: r.x + r.w/2, y: r.y + r.h/2 }; }

  // t ∈ [0,1]: position along the face edge (0.5 = center)
  function rectEdgeAnchor(r, dir, t = 0.5){
    if (dir === 'N') return { x: r.x + r.w * t, y: r.y + r.h, dir };
    if (dir === 'S') return { x: r.x + r.w * t, y: r.y,       dir };
    if (dir === 'E') return { x: r.x + r.w,     y: r.y + r.h * t, dir };
    if (dir === 'W') return { x: r.x,           y: r.y + r.h * t, dir };
  }
  function podWorldAnchor(room, pod){
    return { x: room.x + pod.x, y: room.y + pod.y, dir: 'POD' };
  }

  function rectsOverlap(a, b){
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  // Pick exit face direction for each rect based on relative position
  function pickFaces(a, b){
    const ca = rectCenter(a), cb = rectCenter(b);
    const dx = cb.x - ca.x, dy = cb.y - ca.y;
    let aDir, bDir;
    if (Math.abs(dx) >= Math.abs(dy)){
      aDir = dx > 0 ? 'E' : 'W';
      bDir = dx > 0 ? 'W' : 'E';
    } else {
      aDir = dy > 0 ? 'N' : 'S';
      bDir = dy > 0 ? 'S' : 'N';
    }
    return { aDir, bDir };
  }

  // Remove collinear intermediate nodes (keeps path clean)
  function removeCollinear(nodes){
    if (nodes.length <= 2) return nodes;
    const eps = 0.001;
    const out = [nodes[0]];
    for (let i = 1; i < nodes.length - 1; i++){
      const p = out[out.length - 1], c = nodes[i], n = nodes[i + 1];
      const cross = (c.x - p.x) * (n.y - p.y) - (c.y - p.y) * (n.x - p.x);
      if (Math.abs(cross) > eps) out.push(c);
    }
    out.push(nodes[nodes.length - 1]);
    return out;
  }

  // ── Obstacle avoidance ────────────────────────────────────────────────────
  // Check if an orthogonal segment (p1→p2) passes through a rect (world coords)
  function segmentIntersectsRect(p1, p2, rect){
    const eps = 0.001;
    const { x, y, w, h } = rect;
    if (Math.abs(p1.y - p2.y) < eps){
      // Horizontal segment
      const sy = p1.y;
      const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
      return sy > y + eps && sy < y + h - eps && x1 < x + w - eps && x2 > x + eps;
    } else {
      // Vertical segment
      const sx = p1.x;
      const y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
      return sx > x + eps && sx < x + w - eps && y1 < y + h - eps && y2 > y + eps;
    }
  }

  // Check whether a proposed bypass segment is itself clear of all obstacles
  function segmentClear(p1, p2, obstacles){
    return !obstacles.some(o => segmentIntersectsRect(p1, p2, o));
  }

  // Iteratively push path segments around obstacle rects (world-coord, orthogonal)
  // Improvements over v1:
  //  • Clearance padding (CLR) so paths don't skim obstacle edges
  //  • Bypass validation: tries the preferred side first, falls back to the other
  //  • Processes all segments before re-checking (avoids thrashing)
  function avoidObstacles(nodes, obstacles){
    if (!obstacles || obstacles.length === 0) return nodes;
    const mrg = LANE_WIDTH * 0.5 + 0.2;  // base margin around obstacles
    const CLR = 0.25;                     // extra clearance on bypass side (keeps paths clean)

    // Pre-expand all obstacles once
    const exObs = obstacles.map(o => ({
      x: o.x - mrg, y: o.y - mrg, w: o.w + mrg*2, h: o.h + mrg*2,
    }));

    let result = nodes;
    for (let iter = 0; iter < 14 && result.length >= 2; iter++){
      let changed = false;
      const next = [result[0]];

      for (let i = 0; i < result.length - 1; i++){
        const p1 = result[i], p2 = result[i + 1];
        let blocked = false;

        for (let oi = 0; oi < exObs.length; oi++){
          const ex = exObs[oi];
          if (!segmentIntersectsRect(p1, p2, ex)) continue;

          const eps = 0.001;
          const isHoriz = Math.abs(p1.y - p2.y) < eps;

          if (isHoriz){
            // Candidate bypass Ys — prefer the side closest to current Y
            const aboveY = ex.y + ex.h + CLR;
            const belowY = ex.y - CLR;
            const goRight = p2.x > p1.x;
            const entX = goRight ? ex.x - eps : ex.x + ex.w + eps;
            const exX  = goRight ? ex.x + ex.w + eps : ex.x - eps;

            let bypassY;
            const preferAbove = Math.abs(p1.y - aboveY) <= Math.abs(p1.y - belowY);
            const prim = preferAbove ? aboveY : belowY;
            const alt  = preferAbove ? belowY : aboveY;
            // Validate primary bypass (horizontal segment at bypassY)
            const primOk = segmentClear({x: entX, y: prim}, {x: exX, y: prim}, exObs);
            bypassY = (primOk ? prim : alt);

            next.push(
              { x: entX, y: p1.y },
              { x: entX, y: bypassY },
              { x: exX,  y: bypassY },
              { x: exX,  y: p1.y }
            );
          } else {
            // Candidate bypass Xs — prefer side closest to current X
            const rightX = ex.x + ex.w + CLR;
            const leftX  = ex.x - CLR;
            const goUp = p2.y > p1.y;
            const entY = goUp ? ex.y - eps : ex.y + ex.h + eps;
            const exY  = goUp ? ex.y + ex.h + eps : ex.y - eps;

            const preferLeft = Math.abs(p1.x - leftX) <= Math.abs(p1.x - rightX);
            const prim = preferLeft ? leftX : rightX;
            const alt  = preferLeft ? rightX : leftX;
            const primOk = segmentClear({x: prim, y: entY}, {x: prim, y: exY}, exObs);
            const bypassX = (primOk ? prim : alt);

            next.push(
              { x: p1.x,   y: entY },
              { x: bypassX, y: entY },
              { x: bypassX, y: exY },
              { x: p1.x,   y: exY }
            );
          }
          blocked = true;
          changed = true;
          break; // one obstacle per segment per iteration
        }
        if (!blocked) next.push(p2);
      }

      result = removeCollinear(next);
      if (!changed) break;
    }
    return result;
  }

  // True if rects A and B share a border with overlapping extent (are "wall-to-wall")
  function rectsTouching(a, b, tol){
    tol = tol ?? 0.05;
    if (Math.abs(a.x + a.w - b.x) < tol || Math.abs(b.x + b.w - a.x) < tol){
      if (a.y < b.y + b.h - tol && b.y < a.y + a.h - tol) return true;
    }
    if (Math.abs(a.y + a.h - b.y) < tol || Math.abs(b.y + b.h - a.y) < tol){
      if (a.x < b.x + b.w - tol && b.x < a.x + a.w - tol) return true;
    }
    return false;
  }

  // ── Core orthogonal router ─────────────────────────────────────────────────
  // tA/tB: fractional position (0..1) along source/dest face edge
  // midFraction: 0..1 controls where along the px→qx (or py→qy) span the
  //   connector segment is placed. 0.5 = centre (default). Staggering this
  //   per lane prevents all 6 individual lanes from sharing the same midpoint
  //   and piling on top of each other.
  function route(a, b, opts = {}){
    const tA  = opts.tA  ?? 0.5;
    const tB  = opts.tB  ?? 0.5;
    const mrg = opts.margin ?? 0.6;
    const midFrac = opts.midFraction ?? 0.5;
    const pick = pickFaces(a, b);
    const aDir = opts.aDir || pick.aDir;
    const bDir = opts.bDir || pick.bDir;
    const pa = opts.startPoint ? { ...opts.startPoint, dir: aDir } : rectEdgeAnchor(a, aDir, tA);
    const pb = opts.endPoint ? { ...opts.endPoint, dir: bDir } : rectEdgeAnchor(b, bDir, tB);

    // Margin steps (push path away from face before turning)
    const px = aDir === 'E' ? pa.x + mrg : aDir === 'W' ? pa.x - mrg : pa.x;
    const py = aDir === 'N' ? pa.y + mrg : aDir === 'S' ? pa.y - mrg : pa.y;
    const qx = bDir === 'E' ? pb.x + mrg : bDir === 'W' ? pb.x - mrg : pb.x;
    const qy = bDir === 'N' ? pb.y + mrg : bDir === 'S' ? pb.y - mrg : pb.y;

    const nodes = [{ x: pa.x, y: pa.y }, { x: px, y: py }];
    if (aDir === 'E' || aDir === 'W'){
      // midX staggered along the horizontal span (px → qx)
      const midX = px + (qx - px) * midFrac;
      nodes.push({ x: midX, y: py }, { x: midX, y: qy });
    } else {
      // midY staggered along the vertical span (py → qy)
      const midY = py + (qy - py) * midFrac;
      nodes.push({ x: px, y: midY }, { x: qx, y: midY });
    }
    nodes.push({ x: qx, y: qy }, { x: pb.x, y: pb.y });
    return removeCollinear(nodes);
  }

  // ── Lane computation ───────────────────────────────────────────────────────
  //
  // UNIFIED  → returns 1 lane (center, customizable via customMiddleNodes)
  // INDIVIDUAL → returns 6 parallel lanes spread perpendicular to main direction
  //
  // colObstacles: array of {x,y,w,h} column rects to route around.
  // Pod positions from unrelated pod-rooms are also treated as soft obstacles.
  //
  function computeLanes(conn, rects, colObstacles){
    const a = rects.find(r => r.id === conn.from);
    const b = rects.find(r => r.id === conn.to);
    if (!a || !b) return [];

    // Build full obstacle list: columns + pod positions of non-connected pod-rooms
    const podObs = rects
      .filter(r => r.kind === 'pod-room' && r.id !== conn.from && r.id !== conn.to && Array.isArray(r.pods))
      .flatMap(r => r.pods.map(pod => ({
        x: r.x + pod.x - 0.4, y: r.y + pod.y - 0.4, w: 0.8, h: 0.8,
      })));
    const obstacles = [...(colObstacles || []), ...podObs];

    const pick = pickFaces(a, b);
    const hasFromSideOverride = !!conn.fromAnchor?.side;
    const hasToSideOverride = !!conn.toAnchor?.side;
    const aDir = conn.fromAnchor?.side || pick.aDir;
    const bDir = conn.toAnchor?.side || pick.bDir;
    // Face lengths: used to convert absolute-meter offsets into t-fractions
    const flenA = (aDir === 'E' || aDir === 'W') ? a.h : a.w;
    const flenB = (bDir === 'E' || bDir === 'W') ? b.h : b.w;

    // Build a route for given face t values, injecting custom middle nodes if set
    function buildRoute(tA, tB, opts = {}){
      const start = opts.startPoint || rectEdgeAnchor(a, aDir, tA);
      const end   = opts.endPoint || rectEdgeAnchor(b, bDir, tB);
      const laneMiddleNodes = Array.isArray(conn.customLaneMiddleNodes?.[opts.laneIdx])
        ? conn.customLaneMiddleNodes[opts.laneIdx]
        : null;
      if (laneMiddleNodes && laneMiddleNodes.length){
        return removeCollinear([start, ...laneMiddleNodes, end]);
      }
      if (conn.customMiddleNodes && conn.customMiddleNodes.length){
        // Endpoints are always live (connected to faces), middle nodes are custom
        return removeCollinear([start, ...conn.customMiddleNodes, end]);
      }
      const nodes = route(a, b, { tA, tB, aDir, bDir, startPoint: opts.startPoint, endPoint: opts.endPoint, midFraction: opts.midFraction });
      return avoidObstacles(nodes, obstacles);
    }

    if (conn.mode !== 'individual'){
      // Unified: single center lane
      const fromT = conn.fromAnchor?.t ?? 0.5;
      const toT = conn.toAnchor?.t ?? 0.5;
      return [buildRoute(fromT, toT)];
    }

    // Individual: 6 lanes with absolute-meter perpendicular offset.
    // Each lane gets a different midFraction so their connector segments are
    // staggered instead of stacked — prevents the "all 6 lines on top" problem.
    const fromPods = (a.kind === 'pod-room' && Array.isArray(a.pods)) ? a.pods.slice(0, LANE_COUNT) : null;
    const toPods = (b.kind === 'pod-room' && Array.isArray(b.pods)) ? b.pods.slice(0, LANE_COUNT) : null;
    const fromTBase = conn.fromAnchor?.t ?? 0.5;
    const toTBase = conn.toAnchor?.t ?? 0.5;
    return LANE_OFFSETS.map((offset, laneIdx) => {
      const tA = clamp(fromTBase + offset / flenA, 0.04, 0.96);
      const tB = clamp(toTBase + offset / flenB, 0.04, 0.96);
      // Spread connector columns evenly: 1/(n+1), 2/(n+1) … n/(n+1)
      const midFraction = (laneIdx + 1) / (LANE_COUNT + 1);
      const startPoint = !hasFromSideOverride && fromPods?.[laneIdx] ? podWorldAnchor(a, fromPods[laneIdx]) : null;
      const endPoint = !hasToSideOverride && toPods?.[laneIdx] ? podWorldAnchor(b, toPods[laneIdx]) : null;
      return buildRoute(tA, tB, { startPoint, endPoint, midFraction, laneIdx });
    });
  }

  // ── SVG path string ────────────────────────────────────────────────────────
  function toPathD(nodes, t, mode = 'orthogonal'){
    if (!nodes.length) return '';
    if (mode === 'rounded'){
      const r = 5;
      let d = '';
      for (let i = 0; i < nodes.length; i++){
        const p = t(nodes[i]);
        if (i === 0){ d += `M ${p.x} ${p.y} `; continue; }
        if (i === nodes.length - 1){ d += `L ${p.x} ${p.y}`; continue; }
        const pv = t(nodes[i-1]), nx = t(nodes[i+1]);
        const idx = Math.sign(p.x - pv.x), idy = Math.sign(p.y - pv.y);
        const odx = Math.sign(nx.x - p.x),  ody = Math.sign(nx.y - p.y);
        const aa = { x: p.x - idx * r, y: p.y - idy * r };
        const bb = { x: p.x + odx * r, y: p.y + ody * r };
        d += `L ${aa.x} ${aa.y} Q ${p.x} ${p.y} ${bb.x} ${bb.y} `;
      }
      return d;
    }
    if (mode === 'pixel'){
      const step = 6; let d = '';
      for (let i = 0; i < nodes.length - 1; i++){
        const aa = t(nodes[i]), bb = t(nodes[i+1]);
        if (i === 0) d += `M ${aa.x} ${aa.y} `;
        const dx = bb.x - aa.x, dy = bb.y - aa.y;
        if (Math.abs(dx) > Math.abs(dy) * 0.01 && Math.abs(dy) > Math.abs(dx) * 0.01){
          const st = Math.max(2, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / step));
          let cx = aa.x, cy = aa.y;
          for (let s = 0; s < st; s++){
            cx += dx / st; d += `L ${cx} ${cy} `;
            cy += dy / st; d += `L ${cx} ${cy} `;
          }
        } else { d += `L ${bb.x} ${bb.y} `; }
      }
      return d;
    }
    return nodes.map((n, i) => {
      const p = t(n);
      return (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`);
    }).join(' ');
  }

  return {
    route, toPathD, removeCollinear, computeLanes, rectsTouching,
    rectCenter, rectEdgeAnchor, rectsOverlap, pickFaces, podWorldAnchor,
    get LANE_COUNT(){ return LANE_COUNT; },
    get LANE_OFFSETS(){ return LANE_OFFSETS; },
    get LANE_WIDTH(){ return LANE_WIDTH; },
    get LANE_SPACING(){ return LANE_SPACING; },
    get LANE_GAP(){ return LANE_GAP; },
    setLaneGap(gap){
      LANE_GAP = Math.max(0, +gap || 0);
      refreshLaneMetrics();
    },
    setLaneWidth(width){
      LANE_WIDTH = Math.max(0.1, +width || 0.1);
      refreshLaneMetrics();
    },
    LANE_COLORS,
  };
})();

window.PathUtil = PathUtil;
