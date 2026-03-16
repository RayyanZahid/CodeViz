// ---------------------------------------------------------------------------
// ZoneConfig — Zone geometry constants for the ArchLens canvas.
//
// Virtual canvas space: 2400 x 1600
// Zone layout (left to right, top to bottom):
//   frontend    — far left column
//   api         — center-left column
//   services    — wide center region
//   data-stores — right column
//   external    — far right column (outer ring / top-right)
//   infrastructure — bottom strip spanning full width
//
// All zones have non-overlapping bounds. Infrastructure runs along the bottom
// below all other zones. External occupies the far-right column.
// ---------------------------------------------------------------------------

export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1600;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ZoneBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ZoneLayout {
  name: string;
  label: string;
  bounds: ZoneBounds;
  center: { x: number; y: number };
  /** Border/header color — used for zone label and node fill tint */
  fillColor: string;
  /** Translucent background fill for the zone region */
  bgColor: string;
  /** Brighter accent for glow effects on active nodes */
  glowColor: string;
}

// ---------------------------------------------------------------------------
// Zone layout definitions
// ---------------------------------------------------------------------------

// Infrastructure occupies the bottom strip (y: 1200–1560) across full width.
// All other zones share the upper region (y: 0–1180).

export const ZONE_LAYOUTS: ZoneLayout[] = [
  {
    name: 'frontend',
    label: 'Frontend',
    bounds: { x0: 0, y0: 0, x1: 380, y1: 1180 },
    center: { x: 190, y: 590 },
    fillColor: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.08)',
    glowColor: '#60a5fa',
  },
  {
    name: 'api',
    label: 'API',
    bounds: { x0: 400, y0: 0, x1: 780, y1: 1180 },
    center: { x: 590, y: 590 },
    fillColor: '#16a34a',
    bgColor: 'rgba(22, 163, 74, 0.08)',
    glowColor: '#4ade80',
  },
  {
    name: 'services',
    label: 'Services',
    bounds: { x0: 800, y0: 0, x1: 1580, y1: 1180 },
    center: { x: 1190, y: 590 },
    fillColor: '#9333ea',
    bgColor: 'rgba(147, 51, 234, 0.08)',
    glowColor: '#c084fc',
  },
  {
    name: 'data-stores',
    label: 'Data Stores',
    bounds: { x0: 1600, y0: 0, x1: 2000, y1: 1180 },
    center: { x: 1800, y: 590 },
    fillColor: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.08)',
    glowColor: '#fbbf24',
  },
  {
    name: 'external',
    label: 'External',
    bounds: { x0: 2020, y0: 0, x1: 2380, y1: 1180 },
    center: { x: 2200, y: 590 },
    fillColor: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.08)',
    glowColor: '#9ca3af',
  },
  {
    name: 'infrastructure',
    label: 'Infrastructure',
    bounds: { x0: 0, y0: 1200, x1: 2400, y1: 1560 },
    center: { x: 1200, y: 1380 },
    fillColor: '#475569',
    bgColor: 'rgba(71, 85, 105, 0.08)',
    glowColor: '#94a3b8',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ZoneLayout for a given zone name.
 * Falls back to the 'external' zone for unknown or unrecognized names.
 */
export function getZoneLayout(zoneName: string): ZoneLayout {
  const zone = ZONE_LAYOUTS.find((z) => z.name === zoneName);
  if (zone) return zone;

  // Fallback: external zone acts as catch-all for unrecognized names
  return ZONE_LAYOUTS.find((z) => z.name === 'external')!;
}

/**
 * Returns the center point for a given zone name.
 * Shortcut for node placement — delegates to getZoneLayout().
 */
export function getZoneCenter(zoneName: string): { x: number; y: number } {
  return getZoneLayout(zoneName).center;
}
