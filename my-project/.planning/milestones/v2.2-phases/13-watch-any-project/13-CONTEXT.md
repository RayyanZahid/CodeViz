# Phase 13: Watch Any Project - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can point ArchLens at any directory via a UI input and immediately begin watching it without restarting the server. Supports ARCHLENS_WATCH_ROOT env var for initial directory. Changing the directory clears the graph and triggers a fresh scan. The tool must work correctly on external projects, not just the ArchLens codebase itself.

</domain>

<decisions>
## Implementation Decisions

### Directory input placement & style
- Input lives in the top bar / header area, always visible (like a browser address bar)
- Always shows the currently watched directory path; click/focus to edit
- Submit via Enter key or a "Watch" confirmation button (both supported)
- If ARCHLENS_WATCH_ROOT env var is set, pre-fill the input and auto-start watching on load

### Transition & loading experience
- Canvas clears instantly when switching directories, then rebuilds incrementally
- Nodes appear incrementally as the scan discovers components (live, responsive feel)
- Dual loading indicators: spinner/message centered on the empty canvas AND a subtle indicator near the directory input in the top bar
- Sidebar panels (risk list, activity feed, inspector) clear but show contextual empty states like "Scanning new project..." rather than going blank

### Validation & error feedback
- Server-side validation only — path is sent to the server, which checks existence and readability
- Invalid paths show inline error text directly below the input field (red, form-validation style)
- If directory exists but has no parseable source files, show a warning but keep the watcher active (files may appear later)
- User can submit a new directory path even while a scan is in progress — cancels current scan and starts fresh

### Claude's Discretion
- Exact top bar layout and spacing
- Loading spinner style and animation
- Input field styling details (border, focus states, placeholder text)
- How incremental node layout stabilization works (force-directed settling)
- Scan cancellation mechanism internals

</decisions>

<specifics>
## Specific Ideas

- Directory input should feel like a browser URL bar — always showing where you are, easy to change
- Incremental node appearance gives a "live scanning" feel rather than staring at a blank screen
- Panels showing "Scanning new project..." keeps the UI informative during transitions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-watch-any-project*
*Context gathered: 2026-03-16*
