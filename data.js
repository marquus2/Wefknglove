// Sample data for the demo — multiple VR projects, each with per-venue adaptations.

const PROJECTS = [
  {
    id: 'blackmirror',
    name: 'Black Mirror VR',
    sub: 'Immersive Story · 6 users',
    tag: 'IMMERSIVE',
    adaptations: 1,
    scenes: 22,
    paths: 19,
    builds: 0,
    lastEdit: 'now',
    active: true,
  },
  {
    id: 'galeria-moderna',
    name: 'Galería Moderna',
    sub: 'VR Walkthrough · 6 users',
    tag: 'GALLERY',
    adaptations: 5,
    scenes: 14,
    paths: 9,
    builds: 28,
    lastEdit: '4m ago',
    active: true,
  },
  {
    id: 'mercado-norte',
    name: 'Mercado Norte',
    sub: 'Retail VR · 4 users',
    tag: 'RETAIL',
    adaptations: 4,
    scenes: 22,
    paths: 14,
    builds: 41,
    lastEdit: '2h ago',
  },
  {
    id: 'pabellón-azul',
    name: 'Pabellón Azul',
    sub: 'Expo Hall · 6 users',
    tag: 'EXPO',
    adaptations: 3,
    scenes: 9,
    paths: 5,
    builds: 12,
    lastEdit: 'yesterday',
  },
  {
    id: 'casa-rivera',
    name: 'Casa Rivera Heritage',
    sub: 'Museum · 2 users',
    tag: 'MUSEUM',
    adaptations: 2,
    scenes: 6,
    paths: 3,
    builds: 6,
    lastEdit: '3d ago',
  },
  {
    id: 'clinica-nova',
    name: 'Clínica Nova',
    sub: 'Training Sim · 4 users',
    tag: 'TRAINING',
    adaptations: 5,
    scenes: 18,
    paths: 11,
    builds: 33,
    lastEdit: '1w ago',
  },
];

// Adaptations keyed by projectId — only the active project's adaptations are shown.
const ADAPTATIONS_BY_PROJECT = {
  'blackmirror': [
    { id: 'bm-madrid', name: 'Venue · Madrid', loc: 'Madrid · 450 m²', scenes: 22, paths: 19, status: 'editing', updated: 'now', user: 'JR' },
  ],
  'galeria-moderna': [
    { id: 'venue-soho',     name: 'Venue · Soho NYC',       loc: 'New York · 480 m²',        scenes: 14, paths: 9,  status: 'editing',  updated: '4m ago',   user: 'JR' },
    { id: 'venue-cdmx',     name: 'Venue · Roma Norte',     loc: 'CDMX · 320 m²',            scenes: 11, paths: 7,  status: 'ready',    updated: '2d ago',   user: 'AM' },
    { id: 'venue-bsas',     name: 'Venue · Palermo',        loc: 'Buenos Aires · 540 m²',    scenes: 16, paths: 11, status: 'building', updated: '12m ago',  user: 'JR' },
    { id: 'venue-lisboa',   name: 'Venue · Príncipe Real',  loc: 'Lisboa · 280 m²',          scenes: 9,  paths: 5,  status: 'draft',    updated: 'yesterday',user: 'TC' },
    { id: 'venue-template', name: 'Template · Std Loft',    loc: 'Reusable · 400 m²',        scenes: 12, paths: 8,  status: 'template', updated: '1w ago',   user: 'JR' },
  ],
  'mercado-norte': [
    { id: 'mn-cdmx',        name: 'Venue · CDMX Centro',    loc: 'CDMX · 680 m²',            scenes: 22, paths: 14, status: 'ready',    updated: '2h ago',   user: 'AM' },
    { id: 'mn-monterrey',   name: 'Venue · Monterrey',      loc: 'Monterrey · 550 m²',       scenes: 18, paths: 11, status: 'editing',  updated: '1h ago',   user: 'TC' },
    { id: 'mn-guadalajara', name: 'Venue · Guadalajara',    loc: 'Guadalajara · 490 m²',     scenes: 16, paths: 10, status: 'draft',    updated: 'yesterday',user: 'JR' },
    { id: 'mn-template',    name: 'Template · Mercado Std', loc: 'Reusable · 600 m²',        scenes: 20, paths: 13, status: 'template', updated: '3d ago',   user: 'AM' },
  ],
  'pabellón-azul': [
    { id: 'pb-paris',       name: 'Venue · Paris Expo',     loc: 'Paris · 1200 m²',          scenes: 9,  paths: 5,  status: 'building', updated: '12m ago',  user: 'TC' },
    { id: 'pb-milan',       name: 'Venue · Milano Fair',    loc: 'Milano · 980 m²',          scenes: 8,  paths: 4,  status: 'ready',    updated: '3d ago',   user: 'JR' },
    { id: 'pb-template',    name: 'Template · Expo Std',    loc: 'Reusable · 1000 m²',       scenes: 9,  paths: 5,  status: 'template', updated: '1w ago',   user: 'AM' },
  ],
  'casa-rivera': [
    { id: 'cr-main',        name: 'Venue · Casa Principal', loc: 'CDMX · 320 m²',            scenes: 6,  paths: 3,  status: 'ready',    updated: '3d ago',   user: 'JR' },
    { id: 'cr-extension',   name: 'Venue · Ala Norte',      loc: 'CDMX · 180 m²',            scenes: 4,  paths: 2,  status: 'draft',    updated: '5d ago',   user: 'TC' },
  ],
  'clinica-nova': [
    { id: 'cn-madrid',      name: 'Venue · Madrid',         loc: 'Madrid · 420 m²',          scenes: 18, paths: 11, status: 'editing',  updated: '1w ago',   user: 'AM' },
    { id: 'cn-barcelona',   name: 'Venue · Barcelona',      loc: 'Barcelona · 380 m²',       scenes: 15, paths: 9,  status: 'ready',    updated: '2w ago',   user: 'JR' },
    { id: 'cn-sevilla',     name: 'Venue · Sevilla',        loc: 'Sevilla · 360 m²',         scenes: 14, paths: 8,  status: 'draft',    updated: '1w ago',   user: 'TC' },
    { id: 'cn-valencia',    name: 'Venue · Valencia',       loc: 'Valencia · 400 m²',        scenes: 16, paths: 10, status: 'building', updated: '3d ago',   user: 'AM' },
    { id: 'cn-template',    name: 'Template · Clinic Std',  loc: 'Reusable · 400 m²',        scenes: 18, paths: 11, status: 'template', updated: '3w ago',   user: 'JR' },
  ],
};

// Floorplan: rectangles in METERS. (x,y,w,h) bottom-left origin.
// kind: 'main' | 'unified-hub' | 'pod-room'
// connectsTo: id list. unified=multi-user bundle, paths=number of user paths
const FLOORPLAN = {
  bounds: { w: 32, h: 22 },
  gridSizes: [1, 0.5, 0.1],
  rects: [
    { id: 's01', name: 'Lobby',           x: 1,    y: 1,   w: 6,   h: 4,   dir: 0, kind: 'main',             gameObject: 'Scene_Lobby_01' },
    { id: 's02', name: 'Gallery A',       x: 8,    y: 2,   w: 5,   h: 4,   dir: 0, kind: 'alternate-content', gameObject: 'Scene_GalleryA',  entry: 's01', exit: 's03', mode: 'individual' },
    { id: 's03', name: 'Booths Room',     x: 14,   y: 1,   w: 4.5, h: 4.5, dir: 0, kind: 'pod-room',          gameObject: 'Scene_BoothsRoom',
      pods: [
        { id: 'pod-1', x: 0.9,  y: 3.4, dir: 90,  gameObject: 'Scene_Booth_01' },
        { id: 'pod-2', x: 2.25, y: 3.4, dir: 90,  gameObject: 'Scene_Booth_02' },
        { id: 'pod-3', x: 3.6,  y: 3.4, dir: 90,  gameObject: 'Scene_Booth_03' },
        { id: 'pod-4', x: 0.9,  y: 1.2, dir: 270, gameObject: 'Scene_Booth_04' },
        { id: 'pod-5', x: 2.25, y: 1.2, dir: 270, gameObject: 'Scene_Booth_05' },
        { id: 'pod-6', x: 3.6,  y: 1.2, dir: 270, gameObject: 'Scene_Booth_06' },
      ] },
    { id: 's04', name: 'Atrium',          x: 20,   y: 1,   w: 5,   h: 5,   dir: 0, kind: 'alternate-content', gameObject: 'Scene_Atrium',  entry: 's03', exit: 's05', mode: 'unified' },
    { id: 's05', name: 'Gallery B',       x: 26,   y: 2,   w: 5,   h: 4,   dir: 0, kind: 'main',             gameObject: 'Scene_GalleryB' },
    { id: 's06', name: 'Corridor',        x: 1,    y: 8,   w: 12,  h: 2,   dir: 0, kind: 'main',             gameObject: 'Scene_Corridor01' },
    { id: 's07', name: 'Pod Room North',  x: 14,   y: 7.5, w: 8,   h: 4,   dir: 0, kind: 'pod-room',         gameObject: 'Scene_PodHall',
      pods: [
        { id: 'pod-1', x: 1.2, y: 2.9, dir: 90,  gameObject: 'Scene_Pod_01' },
        { id: 'pod-2', x: 2.9, y: 2.9, dir: 90,  gameObject: 'Scene_Pod_02' },
        { id: 'pod-3', x: 4.6, y: 2.9, dir: 90,  gameObject: 'Scene_Pod_03' },
        { id: 'pod-4', x: 1.2, y: 1.1, dir: 270, gameObject: 'Scene_Pod_04' },
        { id: 'pod-5', x: 2.9, y: 1.1, dir: 270, gameObject: 'Scene_Pod_05' },
        { id: 'pod-6', x: 4.6, y: 1.1, dir: 270, gameObject: 'Scene_Pod_06' },
      ] },
    { id: 's08', name: 'Studio',          x: 23,   y: 8,   w: 8,   h: 3,   dir: 0, kind: 'alternate-content', gameObject: 'Scene_Studio',  entry: 's07', exit: 's11', mode: 'unified' },
    { id: 's09', name: 'Workshop',        x: 1,    y: 13,  w: 7,   h: 4,   dir: 0, kind: 'main',             gameObject: 'Scene_Workshop' },
    { id: 's10', name: 'Auditorium',      x: 10,   y: 13,  w: 11,  h: 6,   dir: 0, kind: 'main',             gameObject: 'Scene_Aud' },
    { id: 's11', name: 'Cafe Exit',       x: 22,   y: 14,  w: 8,   h: 5,   dir: 0, kind: 'main',             gameObject: 'Scene_Cafe' },
  ],
  connections: [
    // AC scenes (s02 Gallery A, s04 Atrium, s08 Studio) carry their own entry/exit — no connections needed
    { id: 'c7',  from: 's01', to: 's06',  mode: 'unified'    },
    { id: 'c8',  from: 's06', to: 's07',  mode: 'individual' },
    { id: 'c14', from: 's09', to: 's10',  mode: 'unified'    },
    { id: 'c15', from: 's10', to: 's11',  mode: 'unified'    },
  ],
  tourOrder: ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11'],
};

const ACTIVITY = [
  { t: 'now',  who: 'You',   text: 'edited rect ',        tag: 'Atrium' },
  { t: '4m',   who: 'JR',    text: 'auto-routed ',        tag: 'c4 → c6' },
  { t: '12m',  who: 'AM',    text: 'saved template ',     tag: 'std-loft.json' },
  { t: '38m',  who: 'CI',    text: 'build APK · ',        tag: 'venue-bsas v23' },
  { t: '2h',   who: 'TC',    text: 'imported ',           tag: 'lisboa.dwg' },
  { t: '1d',   who: 'JR',    text: 'created adaptation ', tag: 'lisboa-280' },
  { t: '2d',   who: 'AM',    text: 'merged conflict ',    tag: 'gallery-b' },
];

const RECENT_BUILDS = [
  { v: 'v0028', adapt: 'venue-bsas',   status: 'OK',   t: '12m' },
  { v: 'v0027', adapt: 'venue-soho',   status: 'OK',   t: '2h'  },
  { v: 'v0026', adapt: 'venue-cdmx',   status: 'OK',   t: '6h'  },
  { v: 'v0025', adapt: 'venue-soho',   status: 'WARN', t: '1d'  },
  { v: 'v0024', adapt: 'venue-lisboa', status: 'OK',   t: '2d'  },
  { v: 'v0023', adapt: 'venue-bsas',   status: 'FAIL', t: '3d'  },
];

// ── BLACKMIRROR floorplan ─────────────────────────────────────────────────────
// Linear narrative: Onboarding → Intro → TV branch (Quiz/Music/Freud) → Creation
// → Playground → Deployment → Maze → Escape → Battle → Truth → Ending → Offboarding
// AC scenes (alternate-content) act as connectors between narrative beats.
// Canvas: 165 × 30m. Main flow runs at y=12 (room bottom). TV branch fans vertically.
const FLOORPLAN_BLACKMIRROR = {
  bounds: { w: 165, h: 30 },
  gridSizes: [1, 0.5, 0.1],
  rects: [
    // ── Act 1 · Onboarding ──────────────────────────────────────────────────
    { id: 'bm000', name: '000 · ONBOARDING',      x: 1,   y: 12, w: 3,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_000_Onboarding' },
    { id: 'bm002', name: '002 · AC ONBOARDING',   x: 5,   y: 12, w: 8,  h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_002_AC_Onboarding',  entry: 'bm000', exit: 'bm010', mode: 'unified' },
    { id: 'bm010', name: '010 · INTRO',           x: 14,  y: 12, w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_010_Intro' },
    // ── AC Mapping fans out to 3 TV scenes ─────────────────────────────────
    { id: 'bm012', name: '012 · AC MAPPING',      x: 20,  y: 9,  w: 10, h: 13, dir: 0, kind: 'alternate-content', gameObject: 'Scene_012_AC_Mapping',  entry: 'bm010', exits: ['bm020','bm022','bm024'], mode: 'individual' },
    // ── Act 2 · TV Branch (parallel alternatives) ───────────────────────────
    { id: 'bm020', name: '020 · TV QUIZ',         x: 31,  y: 18, w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_020_TV_Quiz' },
    { id: 'bm022', name: '022 · TV MUSIC',        x: 31,  y: 12, w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_022_TV_Music' },
    { id: 'bm024', name: '024 · TV FREUD',        x: 31,  y: 6,  w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_024_TV_Freud' },
    // ── AC Creation re-converges from TV branch ─────────────────────────────
    { id: 'bm026', name: '026 · AC CREATION',     x: 37,  y: 9,  w: 10, h: 13, dir: 0, kind: 'alternate-content', gameObject: 'Scene_026_AC_Creation',  entries: ['bm020','bm022','bm024'], exit: 'bm030', mode: 'individual' },
    // ── Act 3 · Creation ─────────────────────────────────────────────────────
    { id: 'bm030', name: '030 · CREATION HALL',   x: 48,  y: 12, w: 5,  h: 5,  dir: 0, kind: 'pod-room',         gameObject: 'Scene_030_CreationHall',
      pods: [
        { id: 'pod-1', x: 1.0,  y: 3.5, dir: 270, gameObject: 'Scene_030_Pod_01' },
        { id: 'pod-2', x: 2.5,  y: 3.5, dir: 270, gameObject: 'Scene_030_Pod_02' },
        { id: 'pod-3', x: 4.0,  y: 3.5, dir: 270, gameObject: 'Scene_030_Pod_03' },
        { id: 'pod-4', x: 1.0,  y: 1.5, dir: 90,  gameObject: 'Scene_030_Pod_04' },
        { id: 'pod-5', x: 2.5,  y: 1.5, dir: 90,  gameObject: 'Scene_030_Pod_05' },
        { id: 'pod-6', x: 4.0,  y: 1.5, dir: 90,  gameObject: 'Scene_030_Pod_06' },
      ] },
    { id: 'bm032', name: '032 · AC PLAYGROUND',   x: 54,  y: 12, w: 12, h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_032_AC_Playground',  entry: 'bm030', exit: 'bm040', mode: 'individual' },
    // ── Act 4 · Playground ───────────────────────────────────────────────────
    { id: 'bm040', name: '040 · PLAYGROUND',      x: 67,  y: 12, w: 7,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_040_Playground' },
    { id: 'bm042', name: '042 · AC DEPLOYMENT',   x: 75,  y: 12, w: 12, h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_042_AC_Deployment',  entry: 'bm040', exit: 'bm060', mode: 'individual' },
    // ── Act 5 · Deployment + Confinement ─────────────────────────────────────
    { id: 'bm060', name: '060 · DEPLOY + CONFIN', x: 88,  y: 12, w: 5,  h: 5,  dir: 0, kind: 'pod-room',         gameObject: 'Scene_060_Deploy',
      pods: [
        { id: 'pod-1', x: 1.0,  y: 3.5, dir: 270, gameObject: 'Scene_060_Pod_01' },
        { id: 'pod-2', x: 2.5,  y: 3.5, dir: 270, gameObject: 'Scene_060_Pod_02' },
        { id: 'pod-3', x: 4.0,  y: 3.5, dir: 270, gameObject: 'Scene_060_Pod_03' },
        { id: 'pod-4', x: 1.0,  y: 1.5, dir: 90,  gameObject: 'Scene_060_Pod_04' },
        { id: 'pod-5', x: 2.5,  y: 1.5, dir: 90,  gameObject: 'Scene_060_Pod_05' },
        { id: 'pod-6', x: 4.0,  y: 1.5, dir: 90,  gameObject: 'Scene_060_Pod_06' },
      ] },
    // ── Act 6 · Maze + Escape ────────────────────────────────────────────────
    { id: 'bm063', name: '063 · MAZE',            x: 94,  y: 12, w: 7,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_063_Maze' },
    { id: 'bm070', name: '070 · ESCAPE CODY',     x: 102, y: 12, w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_070_EscapeCody' },
    { id: 'bm080', name: '080 · BATTLE',          x: 108, y: 12, w: 5,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_080_Battle' },
    // ── Act 7 · Truth Reveal ─────────────────────────────────────────────────
    { id: 'bm092', name: '092 · AC TRUTH',        x: 114, y: 12, w: 10, h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_092_AC_Truth',       entry: 'bm080', exit: 'bm100', mode: 'individual' },
    { id: 'bm100', name: '100 · TRUTH REVEAL',    x: 125, y: 12, w: 5,  h: 5,  dir: 0, kind: 'pod-room',         gameObject: 'Scene_100_TruthReveal',
      pods: [
        { id: 'pod-1', x: 1.0,  y: 3.5, dir: 270, gameObject: 'Scene_100_Pod_01' },
        { id: 'pod-2', x: 2.5,  y: 3.5, dir: 270, gameObject: 'Scene_100_Pod_02' },
        { id: 'pod-3', x: 4.0,  y: 3.5, dir: 270, gameObject: 'Scene_100_Pod_03' },
        { id: 'pod-4', x: 1.0,  y: 1.5, dir: 90,  gameObject: 'Scene_100_Pod_04' },
        { id: 'pod-5', x: 2.5,  y: 1.5, dir: 90,  gameObject: 'Scene_100_Pod_05' },
        { id: 'pod-6', x: 4.0,  y: 1.5, dir: 90,  gameObject: 'Scene_100_Pod_06' },
      ] },
    // ── Act 8 · Ending ───────────────────────────────────────────────────────
    { id: 'bm105', name: '105 · AC TO ENDING',    x: 131, y: 12, w: 10, h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_105_AC_ToEnding',    entry: 'bm100', exit: 'bm110', mode: 'individual' },
    { id: 'bm110', name: '110 · ENDING',          x: 142, y: 13.5,w: 5,  h: 2,  dir: 0, kind: 'main',            gameObject: 'Scene_110_Ending' },
    { id: 'bm112', name: '112 · AC ENDING',       x: 148, y: 12, w: 9,  h: 5,  dir: 0, kind: 'alternate-content', gameObject: 'Scene_112_AC_Ending',      entry: 'bm110', exit: 'bm120', mode: 'unified' },
    // ── Act 9 · Offboarding ──────────────────────────────────────────────────
    { id: 'bm120', name: '120 · OFFBOARDING',     x: 158, y: 12, w: 4,  h: 5,  dir: 0, kind: 'main',             gameObject: 'Scene_120_Offboarding' },
  ],
  connections: [
    // AC scenes carry their own entry/exit — only non-AC-to-non-AC connections live here
    { id: 'bmc11',  from: 'bm060', to: 'bm063',  mode: 'unified'    },
    { id: 'bmc12',  from: 'bm063', to: 'bm070',  mode: 'unified'    },
    { id: 'bmc13',  from: 'bm070', to: 'bm080',  mode: 'unified'    },
  ],
  tourOrder: [
    'bm000','bm002','bm010','bm012',
    'bm020','bm022','bm024','bm026',
    'bm030','bm032','bm040','bm042',
    'bm060','bm063','bm070','bm080',
    'bm092','bm100','bm105','bm110','bm112','bm120',
  ],
};

// FLOORPLANS keyed by adaptation id — add entries here for non-default floorplans.
// Adaptations not listed fall back to SAMPLE.FLOORPLAN (Galería Moderna default).
const BLACKMIRROR_V0028_LAYOUT = {
  bounds: { w: 38, h: 30 },
  rects: {
    bm000: { x: 6, y: 22, w: 5, h: 5 },
    bm002: { x: 0, y: 11, w: 8, h: 5 },
    bm010: { x: 12, y: 22, w: 5, h: 5 },
    bm012: { x: 0, y: 8, w: 10, h: 13 },
    bm020: { x: 17, y: 22, w: 5, h: 5 },
    bm022: { x: 22, y: 22, w: 5, h: 5 },
    bm024: { x: 27, y: 22, w: 5, h: 5 },
    bm026: { x: 0, y: 8, w: 10, h: 13 },
    bm030: { x: 28, y: 16, w: 5, h: 5, pods: [
      { id: 'pod-1', x: 1.5, y: 1, dir: 270, gameObject: 'Scene_030_Pod_01' },
      { id: 'pod-2', x: 1.5, y: 2.5, dir: 270, gameObject: 'Scene_030_Pod_02' },
      { id: 'pod-3', x: 1.5, y: 4, dir: 270, gameObject: 'Scene_030_Pod_03' },
      { id: 'pod-4', x: 3.5, y: 1, dir: 90, gameObject: 'Scene_030_Pod_04' },
      { id: 'pod-5', x: 3.5, y: 2.5, dir: 90, gameObject: 'Scene_030_Pod_05' },
      { id: 'pod-6', x: 3.5, y: 4, dir: 90, gameObject: 'Scene_030_Pod_06' },
    ] },
    bm032: { x: 0, y: 11, w: 12, h: 5 },
    bm040: { x: 28, y: 9, w: 5, h: 7 },
    bm042: { x: 0, y: 11, w: 12, h: 5 },
    bm060: { x: 28.5, y: 3, w: 5, h: 5, pods: [
      { id: 'pod-1', x: 4, y: 1.5, dir: 270, gameObject: 'Scene_060_Pod_01' },
      { id: 'pod-2', x: 2.5, y: 1.5, dir: 270, gameObject: 'Scene_060_Pod_02' },
      { id: 'pod-3', x: 1, y: 1.5, dir: 270, gameObject: 'Scene_060_Pod_03' },
      { id: 'pod-4', x: 4, y: 3.5, dir: 90, gameObject: 'Scene_060_Pod_04' },
      { id: 'pod-5', x: 2.5, y: 3.5, dir: 90, gameObject: 'Scene_060_Pod_05' },
      { id: 'pod-6', x: 1, y: 3.5, dir: 90, gameObject: 'Scene_060_Pod_06' },
    ] },
    bm063: { x: 21.5, y: 3, w: 7, h: 5 },
    bm070: { x: 16.5, y: 3, w: 5, h: 5 },
    bm080: { x: 11.5, y: 3, w: 5, h: 5 },
    bm092: { x: 0, y: 11, w: 10, h: 5 },
    bm100: { x: 6.5, y: 3, w: 5, h: 5, pods: [
      { id: 'pod-1', x: 3.5, y: 4, dir: 270, gameObject: 'Scene_100_Pod_01' },
      { id: 'pod-2', x: 3.5, y: 2.5, dir: 270, gameObject: 'Scene_100_Pod_02' },
      { id: 'pod-3', x: 3.5, y: 1, dir: 270, gameObject: 'Scene_100_Pod_03' },
      { id: 'pod-4', x: 1.5, y: 4, dir: 90, gameObject: 'Scene_100_Pod_04' },
      { id: 'pod-5', x: 1.5, y: 2.5, dir: 90, gameObject: 'Scene_100_Pod_05' },
      { id: 'pod-6', x: 1.5, y: 1, dir: 90, gameObject: 'Scene_100_Pod_06' },
    ] },
    bm105: { x: 0, y: 11, w: 10, h: 5 },
    bm110: { x: 6, y: 9.5, w: 5, h: 2 },
    bm112: { x: 0, y: 11, w: 9, h: 5 },
    bm120: { x: 2.5, y: 9.5, w: 3, h: 4 },
  },
  connections: [
    { id: 'bmc11', from: 'bm060', to: 'bm063', mode: 'unified' },
    { id: 'bmc12', from: 'bm063', to: 'bm070', mode: 'unified' },
    { id: 'bmc13', from: 'bm070', to: 'bm080', mode: 'unified' },
    { id: 'c7364', from: 'bm010', to: 'bm020', mode: 'unified' },
    { id: 'c3836', from: 'bm000', to: 'bm010', mode: 'unified' },
    { id: 'c4084', from: 'bm020', to: 'bm022', mode: 'unified' },
    { id: 'c5209', from: 'bm022', to: 'bm024', mode: 'unified' },
  ],
};

function withLayout(base, layout){
  return {
    ...base,
    bounds: layout.bounds,
    rects: base.rects.map(rect => {
      const next = layout.rects[rect.id];
      return next ? { ...rect, ...next } : rect;
    }),
    connections: layout.connections,
  };
}

const FLOORPLANS = {
  'bm-madrid': withLayout(FLOORPLAN_BLACKMIRROR, BLACKMIRROR_V0028_LAYOUT),
};

window.SAMPLE = { PROJECTS, ADAPTATIONS_BY_PROJECT, FLOORPLAN, FLOORPLANS, ACTIVITY, RECENT_BUILDS };
