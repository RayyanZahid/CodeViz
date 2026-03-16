// Type declarations for d3-force-boundary v0.0.1
// No official types exist for this package; declarations derived from source.
// Source: https://github.com/john-guerra/d3-force-boundary

declare module 'd3-force-boundary' {
  import type { SimulationNodeDatum } from 'd3-force';

  export interface ForceBoundary<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void;
    initialize(nodes: NodeDatum[], random: () => number): void;
    x0(): number | ((d: NodeDatum) => number);
    x0(_: number | ((d: NodeDatum) => number)): this;
    x1(): number | ((d: NodeDatum) => number);
    x1(_: number | ((d: NodeDatum) => number)): this;
    y0(): number | ((d: NodeDatum) => number);
    y0(_: number | ((d: NodeDatum) => number)): this;
    y1(): number | ((d: NodeDatum) => number);
    y1(_: number | ((d: NodeDatum) => number)): this;
    strength(): number | ((d: NodeDatum) => number);
    strength(_: number | ((d: NodeDatum) => number)): this;
    border(): number | ((d: NodeDatum) => number);
    border(_: number | ((d: NodeDatum) => number)): this;
    hardBoundary(): boolean;
    hardBoundary(_: boolean): this;
  }

  export default function forceBoundary<NodeDatum extends SimulationNodeDatum>(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): ForceBoundary<NodeDatum>;
}
