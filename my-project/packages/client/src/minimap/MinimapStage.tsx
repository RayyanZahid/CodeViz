// ---------------------------------------------------------------------------
// MinimapStage — Small Konva Stage showing the full graph with a viewport
// indicator rectangle.
//
// Renders a scaled-down overview of the virtual canvas:
//   - Zone background rectangles (colored Rects at minimap scale)
//   - A white outline Rect showing the current viewport position/size
//
// Per CONTEXT.md: "Toggleable minimap — small minimap showing full graph
// with viewport indicator, can be hidden"
//
// Scale: MINIMAP_WIDTH / CANVAS_WIDTH (maintains aspect ratio)
// Position: fixed bottom-right corner of the screen
// ---------------------------------------------------------------------------

import { Stage, Layer, Rect } from 'react-konva';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ZONE_LAYOUTS } from '../layout/ZoneConfig.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 133; // Same aspect ratio as CANVAS_WIDTH/CANVAS_HEIGHT (2400/1600 = 1.5)
const SCALE = MINIMAP_WIDTH / CANVAS_WIDTH;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MinimapStageProps {
  viewportRect: { x: number; y: number; width: number; height: number };
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MinimapStage({ viewportRect, visible }: MinimapStageProps) {
  if (!visible) return null;

  // Clamp viewport indicator to minimap bounds to avoid overflow
  const vpX = Math.max(0, viewportRect.x * SCALE);
  const vpY = Math.max(0, viewportRect.y * SCALE);
  const vpW = Math.min(viewportRect.width * SCALE, MINIMAP_WIDTH - vpX);
  const vpH = Math.min(viewportRect.height * SCALE, MINIMAP_HEIGHT - vpY);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 6,
        background: 'rgba(10, 10, 15, 0.85)',
        overflow: 'hidden',
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}
    >
      <Stage width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
        <Layer>
          {/* Zone background rectangles at minimap scale */}
          {ZONE_LAYOUTS.map((zone) => (
            <Rect
              key={zone.name}
              x={zone.bounds.x0 * SCALE}
              y={zone.bounds.y0 * SCALE}
              width={(zone.bounds.x1 - zone.bounds.x0) * SCALE}
              height={(zone.bounds.y1 - zone.bounds.y0) * SCALE}
              fill={zone.bgColor}
              stroke={zone.fillColor + '40'}
              strokeWidth={0.5}
              cornerRadius={2}
              listening={false}
            />
          ))}

          {/* Viewport indicator rectangle */}
          <Rect
            x={vpX}
            y={vpY}
            width={vpW}
            height={vpH}
            fill="#ffffff10"
            stroke="#ffffff"
            strokeWidth={1}
            listening={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}
