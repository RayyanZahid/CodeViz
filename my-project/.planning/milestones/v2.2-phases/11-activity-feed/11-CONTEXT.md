# Phase 11: Activity Feed - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Live streaming of architectural events as natural-language entries with colored dots and relative timestamps in the existing ActivityFeed panel. The panel UI shell already exists from v1.0 — this phase wires it to real data, adds file-modification entries from graph deltas, and pipes risk events into the feed.

Key existing infrastructure:
- `ActivityFeed.tsx` — collapsible panel with colored dots, relative timestamps, monospace text
- `inferenceStore.ts` — `applyInference()` processes events, creates ActivityItems, batches same-node events within 2s, caps at 50
- `eventSentence.ts` — `toSentence()` converts ArchitecturalEvent to natural language
- `EventCorroborator` — fires corroborated architectural events (threshold=2)
- `RiskDetector` — fires risk signals immediately
- WebSocket broadcast with file-to-component ID translation (v2.0 fix)

</domain>

<decisions>
## Implementation Decisions

### Event completeness
- Feed shows BOTH corroborated architectural events AND file-level changes from graph deltas
- File-level changes sourced from graph delta messages (nodesAdded, nodesRemoved, edgesAdded, edgesRemoved) — NOT directly from file watcher
- A file edit that changes no exports/imports won't appear in the feed (graph delta must fire)
- Batched per component: "Parser modified — 3 files changed" (one entry per component per batch window, using existing 2s batching)

### Dot colors
- Green (#22c55e): component creation
- Blue (#3b82f6): dependency changes (added, removed, split, merge)
- Orange: risk events (new — see below)
- White/gray (#94a3b8): file modifications (routine changes, visually quieter)

### Risk events in feed
- Risks appear in BOTH the Risk Panel AND the Activity Feed (dual display)
- Feed entry is informational only — not clickable. Users click the Risk Panel for actions (highlight, mark-reviewed)
- Short summary format: "Critical: Circular dependency detected" or "Warning: Boundary violation: Parser → Database"
- Severity prefix in text (Critical/Warning), plus the orange dot color
- Only first detection of a new risk shows in feed (use existing fingerprint dedup to avoid duplicates)

### Claude's Discretion
- Sentence style and format for file-modification entries (guided by existing eventSentence.ts patterns)
- Whether relative timestamps tick live via interval or only update on new events
- Exact batching window tuning (currently 2s — may adjust)
- Feed cap (currently 50 items — may adjust)

</decisions>

<specifics>
## Specific Ideas

- idea-v2.md shows example sentences: "Parser modified — 2 files changed", "New dependency: Inference Engine → Database", "Graph Engine created"
- The existing eventSentence.ts has terser sentences ("foo created", "foo → depends on bar") — these can be enhanced to match the richer format
- Risk feed entries should be clearly distinguishable from architectural events via the orange dot + severity prefix

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-activity-feed*
*Context gathered: 2026-03-16*
