// "Set up later" shows where setup lives (ticket 18, the owner's ask 2026-10-13): the welcome screen asks, and the
// setup plugin's sidebar row, the one place that can anchor a pop-up to itself, takes the ask once and points.
// The ask is kept on globalThis, which survives a plugin reload, so a row that mounts later still finds it.
const g = globalThis as { __agenticPocketsPointAtSetup?: boolean };
const listeners = new Set<() => void>();

export function askToPoint(): void {
  g.__agenticPocketsPointAtSetup = true;
  listeners.forEach((l) => l());
}

export function takePoint(): boolean {
  if (g.__agenticPocketsPointAtSetup !== true) return false;
  g.__agenticPocketsPointAtSetup = false;
  return true;
}

export function onPoint(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
