// Persisted physics engine choice (cannon | crashcat).
// Pure module: storage is injected, all access wrapped in try/catch.

export const ENGINE_KEY = 'barrelBlast.physicsEngine';
const VALID = new Set(['cannon', 'crashcat']);

export function readEngineChoice(storage) {
  try {
    const v = storage?.getItem(ENGINE_KEY);
    return VALID.has(v) ? v : 'cannon';
  } catch {
    return 'cannon';
  }
}

export function writeEngineChoice(storage, name) {
  if (!VALID.has(name)) return;
  try {
    storage?.setItem(ENGINE_KEY, name);
  } catch {
    // ignore
  }
}
