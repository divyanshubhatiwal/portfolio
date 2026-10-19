// Device checks kept separate from hero3d.ts so testing them never pulls Three.js into the main bundle.

/** Desktop-class device with WebGL2, a mouse, enough cores/memory, and no reduced-motion preference. */
export function canRun3D(): boolean {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || innerWidth < 760) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

/** Run work when the browser is idle (or soon, where requestIdleCallback isn't supported). */
export function whenIdle(fn: () => void, timeout = 2000): void {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 300);
}
