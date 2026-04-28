// Sample data for the demo — multiple VR projects, each with per-venue adaptations.

const PROJECTS = [
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
// kind: 'main' | 'alternate' | 'unified-hub' | 'individual-stop'
// connectsTo: id list. unified=multi-user bundle, paths=number of user paths
const FLOORPLAN = {
  bounds: { w: 32, h: 22 },
  gridSizes: [1, 0.5, 0.1],
  rects: [
    { id: 's01', name: 'Lobby',           x: 1,    y: 1,   w: 6,   h: 4, kind: 'main',             users: 6, gameObject: 'Scene_Lobby_01' },
    { id: 's02', name: 'Gallery A',       x: 8,    y: 2,   w: 5,   h: 4, kind: 'unified-hub',      users: 6, gameObject: 'Scene_GalleryA' },
    { id: 's03a',name: 'Booth · Paint',   x: 14,   y: 1,   w: 2.5, h: 2, kind: 'individual-stop',  users: 1, gameObject: 'Scene_BoothPaint' },
    { id: 's03b',name: 'Booth · Sculpt',  x: 14,   y: 3.5, w: 2.5, h: 2, kind: 'individual-stop',  users: 1, gameObject: 'Scene_BoothSculpt' },
    { id: 's04', name: 'Atrium',          x: 18,   y: 1,   w: 5,   h: 5, kind: 'unified-hub',      users: 6, gameObject: 'Scene_Atrium' },
    { id: 's05', name: 'Gallery B',       x: 24,   y: 2,   w: 6,   h: 4, kind: 'main',             users: 6, gameObject: 'Scene_GalleryB' },
    { id: 's06', name: 'Corridor',        x: 1,    y: 8,   w: 12,  h: 2, kind: 'main',             users: 6, gameObject: 'Scene_Corridor01' },
    { id: 's07a',name: 'Pod 01',          x: 14,   y: 8,   w: 2,   h: 2, kind: 'individual-stop',  users: 1, gameObject: 'Scene_Pod_01' },
    { id: 's07b',name: 'Pod 02',          x: 16.5, y: 8,   w: 2,   h: 2, kind: 'individual-stop',  users: 1, gameObject: 'Scene_Pod_02' },
    { id: 's07c',name: 'Pod 03',          x: 19,   y: 8,   w: 2,   h: 2, kind: 'individual-stop',  users: 1, gameObject: 'Scene_Pod_03' },
    { id: 's08', name: 'Studio',          x: 22,   y: 8,   w: 8,   h: 3, kind: 'unified-hub',      users: 6, gameObject: 'Scene_Studio' },
    { id: 's09', name: 'Workshop',        x: 1,    y: 13,  w: 7,   h: 4, kind: 'main',             users: 6, gameObject: 'Scene_Workshop' },
    { id: 's10', name: 'Auditorium',      x: 10,   y: 13,  w: 11,  h: 6, kind: 'main',             users: 6, gameObject: 'Scene_Aud' },
    { id: 's11', name: 'Cafe Exit',       x: 22,   y: 14,  w: 8,   h: 5, kind: 'main',             users: 6, gameObject: 'Scene_Cafe' },
  ],
  connections: [
    { id: 'c1',  from: 's01', to: 's02',  mode: 'unified'    },
    { id: 'c2',  from: 's02', to: 's03a', mode: 'individual' },
    { id: 'c3',  from: 's02', to: 's03b', mode: 'individual' },
    { id: 'c4',  from: 's03a',to: 's04',  mode: 'individual' },
    { id: 'c5',  from: 's03b',to: 's04',  mode: 'individual' },
    { id: 'c6',  from: 's04', to: 's05',  mode: 'unified'    },
    { id: 'c7',  from: 's01', to: 's06',  mode: 'unified'    },
    { id: 'c8',  from: 's06', to: 's07a', mode: 'individual' },
    { id: 'c9',  from: 's06', to: 's07b', mode: 'individual' },
    { id: 'c10', from: 's06', to: 's07c', mode: 'individual' },
    { id: 'c11', from: 's07a',to: 's08',  mode: 'individual' },
    { id: 'c12', from: 's07b',to: 's08',  mode: 'individual' },
    { id: 'c13', from: 's07c',to: 's08',  mode: 'individual' },
    { id: 'c14', from: 's09', to: 's10',  mode: 'unified'    },
    { id: 'c15', from: 's10', to: 's11',  mode: 'unified'    },
    { id: 'c16', from: 's08', to: 's11',  mode: 'unified'    },
  ],
  tourOrder: ['s01','s02','s03a','s04','s05','s06','s07a','s08','s09','s10','s11'],
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

window.SAMPLE = { PROJECTS, ADAPTATIONS_BY_PROJECT, FLOORPLAN, ACTIVITY, RECENT_BUILDS };
