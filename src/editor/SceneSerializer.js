const KEY = 'tankGame_layout_v1';

export function saveLayout(terrainHeights, objects) {
  localStorage.setItem(KEY, JSON.stringify({ v: 1, terrain: terrainHeights, objects }));
  console.log(`[Editor] Saved: ${objects.length} objects`);
}

export function loadLayout() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { console.warn('[Editor] Corrupt save data'); return null; }
}

export function clearLayout() {
  localStorage.removeItem(KEY);
}
