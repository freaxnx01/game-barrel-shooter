// Lazy backend loader. cannon is always available (static import passed in);
// crashcat is loaded via dynamic import() from esm.sh on first use. If the
// crashcat import fails, the cannon backend is returned with `error` set so
// the game can keep running and mark crashcat unavailable.
// engine switch (temporary, #9)

import { createCannonBackend } from './backend-cannon.js';
import { createCrashcatBackend } from './backend-crashcat.js';

export async function loadBackend(name, CANNON) {
  if (name === 'crashcat') {
    try {
      const cc = await import('https://esm.sh/crashcat@0.0.5');
      return { phys: createCrashcatBackend(cc), name: 'crashcat' };
    } catch (e) {
      console.warn('[physics] crashcat unavailable, falling back to cannon:', e.message);
      return { phys: createCannonBackend(CANNON), name: 'cannon', error: e };
    }
  }
  return { phys: createCannonBackend(CANNON), name: 'cannon' };
}
