// ---------------------------------------------------------------------------
// EdgeLegend — Always-visible legend card in the bottom-left corner of the canvas.
//
// Shows three horizontal line samples explaining edge thickness meanings:
//   - Thin  (strokeWidth ~1.5): 1-3 deps
//   - Medium (strokeWidth ~3):  4-8 deps
//   - Thick  (strokeWidth ~5):  9+ deps
//
// Per CONTEXT.md decision: "bottom-left corner, always visible, semi-transparent card"
// Repositions above minimap when minimapVisible is true.
// ---------------------------------------------------------------------------

interface EdgeLegendProps {
  minimapVisible: boolean;
}

export function EdgeLegend({ minimapVisible }: EdgeLegendProps) {
  const bottomOffset = minimapVisible ? 180 : 16;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 16,
        zIndex: 200,
        background: 'rgba(10, 10, 15, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        padding: '8px 12px',
        transition: 'bottom 0.15s ease',
      }}
    >
      {/* Title */}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 10,
          fontFamily: 'monospace',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Edge Weight
      </div>

      {/* Thin line row — 1-3 deps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <svg width="30" height="8">
          <line
            x1="0"
            y1="4"
            x2="30"
            y2="4"
            stroke="rgba(150, 200, 255, 0.5)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 11, color: '#ffffffb3', fontFamily: 'monospace' }}>
          1-3 deps
        </span>
      </div>

      {/* Medium line row — 4-8 deps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <svg width="30" height="8">
          <line
            x1="0"
            y1="4"
            x2="30"
            y2="4"
            stroke="rgba(150, 200, 255, 0.6)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 11, color: '#ffffffb3', fontFamily: 'monospace' }}>
          4-8 deps
        </span>
      </div>

      {/* Thick line row — 9+ deps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
        <svg width="30" height="8">
          <line
            x1="0"
            y1="4"
            x2="30"
            y2="4"
            stroke="rgba(150, 200, 255, 0.7)"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 11, color: '#ffffffb3', fontFamily: 'monospace' }}>
          9+ deps
        </span>
      </div>
    </div>
  );
}
