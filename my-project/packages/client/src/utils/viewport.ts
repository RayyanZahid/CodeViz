// ---------------------------------------------------------------------------
// Viewport persistence helpers — localStorage read/write for Phase 6 consumption.
// Phase 6 (canvas renderer) will call saveViewport() on every viewport change
// and loadViewport() on mount to restore the last pan/zoom position.
// ---------------------------------------------------------------------------

const VIEWPORT_KEY = 'archlens:viewport';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Persist the current viewport state to localStorage.
 * Silently ignores errors (quota exceeded, private browsing, etc.).
 */
export function saveViewport(state: ViewportState): void {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota or private browsing — silently ignore
  }
}

/**
 * Load the persisted viewport state from localStorage.
 * Returns null if no valid state is stored.
 */
export function loadViewport(): ViewportState | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.zoom === 'number' &&
      typeof parsed.panX === 'number' &&
      typeof parsed.panY === 'number'
    ) {
      return parsed as unknown as ViewportState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the persisted viewport state from localStorage.
 * Useful when resetting the canvas to default view.
 */
export function clearViewport(): void {
  try {
    localStorage.removeItem(VIEWPORT_KEY);
  } catch {
    // Silently ignore
  }
}
