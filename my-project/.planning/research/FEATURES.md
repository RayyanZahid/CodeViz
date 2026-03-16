# Feature Research

**Domain:** Real-time architecture visualization for AI coding agents
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (most claims verified across multiple sources; AI agent supervision features are newer territory with fewer precedents)

---

## Context: What Makes This Product Unique

ArchLens serves a novel use case: a developer supervising an AI coding agent needs architectural situational awareness, not a static diagram tool. The reference tools (CodeScene, Sourcetrail, dependency-cruiser, Madge, CodeCity, AppMap, Structure101) were built for human developers reading code they wrote. ArchLens is built for humans watching AI write code. This shifts the feature priority dramatically — real-time streaming, automatic interpretation, and change narration matter more than manual diagram editing or team collaboration.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any architecture visualization tool must have. Missing these = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dependency graph rendering | Every visualization tool (Sourcetrail, dependency-cruiser, Madge, CodeSee) shows nodes and edges; this is the definition of "architecture visualization" | MEDIUM | Must render from parsed code, not manually defined |
| Zoom and pan navigation | Universal in all surveyed tools (Sourcetrail, IcePanel, Structurizr); interactive navigation is standard expectation since 2018 | LOW | Canvas/WebGL is required for smooth performance at 100+ nodes |
| Circular dependency detection | Madge, dependency-cruiser, IntelliJ IDEA, Structure101 all detect cycles; users expect this as minimum correctness signal | MEDIUM | Depth-first search on dependency graph; well-understood algorithm |
| Node click-to-inspect | Sourcetrail's "click to see usages and definitions" is the reference interaction; users expect drill-down on any node | LOW | Show affected files, dependencies, recent changes |
| Multiple abstraction levels | Sourcetrail, IcePanel (C4 model), CodeScene all support zoom from overview to component level; flat graphs don't scale mentally | MEDIUM | ArchLens uses architectural concepts, not file-level nodes |
| Real-time / live updates | The entire value proposition requires this; a static snapshot defeats the purpose for the AI agent supervision use case | HIGH | File watcher → parse → graph update within 1-2 seconds |
| Stable layout (no reshuffling) | Any tool that randomly re-layouts on every update is unusable as a live display; this is a hard UX requirement | HIGH | Must maintain node positions across updates |
| Persistent state across sessions | GenMyModel offers versioning; users expect to return and see their architecture, not start from scratch | MEDIUM | SQLite or similar local store |
| Color/visual encoding of metadata | CodeScene uses hotspot heatmaps, CodeCity uses building height; users expect metrics to be visually encoded, not buried in tables | MEDIUM | Color for activity level, size for scope, glow for active nodes |
| Export or shareable view | Every tool surveyed (Madge → SVG, dependency-cruiser → HTML, IcePanel → export) offers this; lack of export frustrates users | LOW | Screenshot or SVG export minimum; not critical for v1 |

### Differentiators (Competitive Advantage)

Features that set ArchLens apart. These align directly with the core value: architectural situational awareness for AI-supervised development.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural-language activity feed | No existing tool narrates architecture changes in plain English in real time. CodeScene shows metrics and CodeScene ACE writes refactoring suggestions, but nothing describes "UserService now depends on PaymentGateway" as it happens | HIGH | Requires architectural event classification + template-based narration; avoid LLM dependency for latency reasons |
| Architectural event detection | Translating raw file changes into events (component created, dependency added, service split) is absent from all static tools; most just re-render the graph | HIGH | This is the core intelligence layer; transforms diffs into architecture-level semantics |
| Semantic zone layout | No surveyed tool uses fixed semantic zones (frontend left, API center, data right). Sourcetrail auto-places; IcePanel requires manual positioning; CodeScene uses treemap. Fixed zones give immediate orientation | HIGH | Pre-assigned coordinates by detected role; new nodes auto-assign to zone |
| Activity overlay (glow/pulse on active nodes) | Most tools are static diagrams; AppMap records runtime behavior but doesn't animate it live. Showing "where the agent is working right now" is novel | MEDIUM | CSS animation on WebSocket events; computationally cheap but architecturally novel |
| Time-travel replay | Gource visualizes git history as video, but not structured architecture evolution. CodeScene shows trend charts. GenMyModel has "time machine." None support scrubbing architecture state like a timeline | HIGH | Requires persisting graph snapshots at each event; state reconstruction from event log |
| Intent inference panel | Inferring agent objectives from file change patterns (naming, groupings, commit messages) is entirely absent from existing tools — this is new territory | HIGH | Heuristic-based classification; names like "auth", "payment", "route" give strong signals |
| Agent-agnostic file-watcher input | Most tools require IDE plugins (AppMap, CodeSee), Git integration (CodeScene), or build system hooks. ArchLens works with any agent via filesystem events | MEDIUM | chokidar or native FSEvents; no agent-specific API needed |
| Risk heuristics panel | CodeScene detects risk from git history; NDepend and Structure101 detect structural risk. ArchLens can detect it in real time as the agent builds, not as a post-hoc analysis | HIGH | Circular deps, boundary violations, excessive fan-out — trigger on graph update events |
| Incremental parsing (not full rebuild) | Tree-sitter supports incremental parsing natively; Madge and dependency-cruiser do full scans. Incremental is required for sub-2-second latency on large codebases | HIGH | Tree-sitter incremental API; only reparse changed files |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create scope creep, complexity, or misalignment with the core use case.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Manual node drag-and-drop positioning | Users of draw.io and Structurizr expect to manually arrange diagrams; feels natural | Defeats semantic zone layout (ArchLens's key differentiator); introduces conflict between user position and system-derived position; adds complex state management for position override tracking | Semantic zones handle positioning deterministically; click-to-inspect handles user curiosity about a node |
| Team collaboration / multi-user | Every enterprise tool (IcePanel, CodeScene, GenMyModel) emphasizes "real-time collaborative"; seems like obvious next step | ArchLens is a single-user local app; adding multi-user requires auth, conflict resolution, backend infrastructure — scope explosion for v1; the use case is one developer supervising one agent | Keep as localhost single-user; multi-user is a v2+ consideration if there is product-market fit |
| IDE extension / editor integration | AppMap, CodeSee, CodeScene all have VS Code plugins; users expect IDE integration | Requires maintaining separate extension packages per IDE; creates fragility against IDE version changes; the browser-based approach is agent-agnostic by design | Local web app running alongside editor is the correct architecture; no IDE lock-in |
| AI-generated architectural suggestions | CodeScene ACE, vFunction offer AI refactoring recommendations; users want the tool to tell them what to do | Requires LLM calls which add latency, cost, and reliability risk; the core value is observation/awareness, not prescription; blurs focus | Intent inference (what the agent is doing) is enough; architectural recommendations are out of scope for v1 |
| Full UML / C4 model diagram support | Structurizr, IcePanel, Enterprise Architect use standard notations; users familiar with C4 expect it | UML and C4 are manually-authored; ArchLens auto-derives from code, which doesn't map cleanly to C4's manually-curated hierarchy; trying to fit inferred graphs into C4 model creates inaccurate representations | Use ArchLens's own abstraction layer (systems, services, subsystems, data stores); optionally export as C4-like notation post-v1 |
| Cloud deployment / SaaS | Every commercial tool (CodeScene, IcePanel, CodeSee) is SaaS; developers are used to SaaS tools | Cloud deployment requires auth, data security compliance for sensitive code, backend infrastructure, billing — all distract from core product; local code should not leave developer's machine | Localhost web app is the correct security posture for code visualization; cloud deployment only after explicit user demand |
| Mobile support | Progressive web apps and mobile are standard expectations | Architecture visualization requires large screen real estate; mobile layout adds responsive design complexity for no practical benefit (nobody monitors AI agents from mobile) | Desktop web only; explicit out-of-scope decision documented in PROJECT.md |
| Git history analysis | CodeScene's entire differentiator is behavioral analysis from git history; users expect this in any code analysis tool | Git history analysis is retrospective; ArchLens's value is real-time prospective observation; adding git history conflates two different products; git parsing is complex and slow | Activity feed and time-travel replay provide the temporal dimension from live data, not git history |
| Specific agent integrations (Claude Code hooks, Cursor API) | Dedicated integrations seem like they would give richer data | Creates maintenance burden for each agent; breaks the agent-agnostic positioning; agents change their APIs frequently | File-watcher input captures all agent activity without any integration; works forever without maintenance |

---

## Feature Dependencies

```
[File System Watcher]
    └──feeds──> [Tree-sitter Incremental Parser]
                    └──produces──> [Dependency Graph Model]
                                        ├──enables──> [Circular Dependency Detection]
                                        ├──enables──> [Risk Heuristics Panel]
                                        ├──enables──> [Semantic Zone Layout]
                                        │                   └──enables──> [Activity Overlay]
                                        └──enables──> [Architectural Event Detection]
                                                            ├──enables──> [Natural-Language Activity Feed]
                                                            ├──enables──> [Intent Inference Panel]
                                                            └──enables──> [Time-Travel Replay]
                                                                              └──requires──> [Persistent Graph State]

[WebSocket Streaming]
    └──required by──> [Real-Time Canvas Update]
                            └──requires──> [Stable Layout Engine]
                                               └──requires──> [Semantic Zone Layout]

[Node Click-to-Inspect]
    └──requires──> [Dependency Graph Model]

[Zoom and Pan Navigation]
    └──requires──> [Canvas/WebGL Renderer]
```

### Dependency Notes

- **Dependency Graph Model requires Tree-sitter Parser:** The graph is built from parsed ASTs; without parsing there is no graph. Tree-sitter must be implemented before any visualization feature.
- **Semantic Zone Layout requires Dependency Graph Model:** Zones are determined by detected component role (detected from file paths, module names, framework patterns); this classification depends on having a parsed graph.
- **Stable Layout Engine requires Semantic Zone Layout:** Zone assignment provides the anchor coordinates that prevent reshuffling; implementing stable layout before zones would require a different (less meaningful) stability mechanism.
- **Time-Travel Replay requires Persistent Graph State:** Replay works by loading past graph snapshots; if state is not persisted, replay is impossible. Persistence must precede replay.
- **Natural-Language Activity Feed requires Architectural Event Detection:** The feed narrates events; events must be classified before narration can be generated.
- **Risk Heuristics Panel requires Dependency Graph Model:** Circular dep detection and fan-out analysis are graph algorithms; requires the graph to exist first.
- **Activity Overlay requires WebSocket Streaming:** Glow/pulse effects are triggered by live events pushed from backend; polling is too slow for smooth animation.
- **Intent Inference Panel requires Architectural Event Detection:** Intent is inferred from patterns of events; needs at least a stream of classified events to analyze.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — sufficient to validate the core value proposition: "glance at screen, understand what the AI agent is building."

- [ ] **File system watcher** — without this, nothing works; this is the input to everything
- [ ] **Tree-sitter incremental parser (TypeScript/JavaScript + Python)** — covers the most common AI-assisted development languages
- [ ] **Dependency graph model with incremental updates** — the foundational data structure
- [ ] **Semantic zone layout with stable node coordinates** — the key UX innovation; zones (frontend/API/services/data/infra) provide instant orientation
- [ ] **Canvas/WebGL renderer with zoom and pan** — must handle 100+ nodes smoothly; DOM-based rendering fails at scale
- [ ] **WebSocket streaming (backend to frontend)** — required for live updates
- [ ] **Real-time activity overlay (glow/pulse on active nodes)** — the single most impactful visual feature; tells developer exactly where agent is working
- [ ] **Natural-language activity feed** — narrates architectural changes; core differentiator; validates the "without reading code" value claim
- [ ] **Architectural event detection** — backbone of the activity feed and risk panel
- [ ] **Risk heuristics panel (circular deps, boundary violations, fan-out)** — safety net; catches architectural mistakes as agent makes them
- [ ] **Click-to-inspect node details** — lets developer drill down when activity feed raises a question
- [ ] **Persistent graph state** — so visualization survives process restarts

### Add After Validation (v1.x)

Features to add once core concept is working and users confirm value.

- [ ] **Time-travel replay** — trigger: users ask "can I review what the agent built during this session?" Persistence is already in place; replay UI is the only addition.
- [ ] **Intent inference panel** — trigger: users find activity feed helpful but want higher-level summary of agent objectives; add when event stream is mature enough to classify patterns
- [ ] **Export (SVG/screenshot)** — trigger: users want to share architecture maps with team; add when core visualization is stable

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Go and Rust language support** — defer: Tree-sitter has grammars for both; add when user demand confirms need
- [ ] **Expanded risk detection (performance bottlenecks, security boundary violations)** — defer: requires deeper domain expertise; v1 heuristics are sufficient for initial value
- [ ] **Multi-session comparison (architectural diff between two time points)** — defer: time-travel establishes the foundation; comparison is a separate UX problem
- [ ] **Plugin/extension API for custom event handlers** — defer: internal event system must stabilize first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File system watcher | HIGH | LOW | P1 |
| Tree-sitter incremental parser | HIGH | MEDIUM | P1 |
| Dependency graph model | HIGH | MEDIUM | P1 |
| Semantic zone layout | HIGH | HIGH | P1 |
| Canvas/WebGL renderer + zoom/pan | HIGH | HIGH | P1 |
| WebSocket streaming | HIGH | LOW | P1 |
| Activity overlay (glow/pulse) | HIGH | LOW | P1 |
| Natural-language activity feed | HIGH | MEDIUM | P1 |
| Architectural event detection | HIGH | HIGH | P1 |
| Risk heuristics panel | HIGH | MEDIUM | P1 |
| Click-to-inspect node details | MEDIUM | LOW | P1 |
| Persistent graph state | HIGH | MEDIUM | P1 |
| Time-travel replay | MEDIUM | HIGH | P2 |
| Intent inference panel | MEDIUM | HIGH | P2 |
| Export (SVG/screenshot) | LOW | LOW | P2 |
| Go/Rust language support | MEDIUM | MEDIUM | P3 |
| Multi-session architectural diff | MEDIUM | HIGH | P3 |
| Plugin/extension API | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | CodeScene | Sourcetrail | dependency-cruiser / Madge | AppMap | ArchLens Approach |
|---------|-----------|-------------|---------------------------|--------|-------------------|
| Dependency graph | System maps, change coupling maps | Full symbol graph (functions, classes, files) | Module-level graph, directory grouping | Dependency graph from runtime capture | Architectural-concept graph (services, subsystems, stores) |
| Real-time updates | Batch analysis on commit/PR; not live | Static index; re-index on demand | Static CLI scan; no live mode | Records sessions; not streaming live | Streaming live via file watcher + WebSocket |
| Natural language narration | None | None | None | None | Activity feed narrating each architectural event |
| Circular dep detection | Via change coupling analysis | Indirect via graph traversal | Explicit feature (Madge's primary feature) | Not highlighted | Real-time detection on graph update |
| Risk detection | Hotspots, knowledge silos, bus factor | None | dependency-cruiser: custom rule enforcement | None | Fan-out, boundary violations, circular deps in real time |
| Layout stability | Treemap (changes shape over time) | Force-directed (unstable) | Graphviz auto-layout (static output) | Force-directed | Fixed semantic zones; sticky node coordinates |
| Zoom/pan | Yes | Yes (WASD + mouse wheel) | No (static image output) | Yes (in IDE plugin) | Yes (Canvas/WebGL) |
| Time-travel replay | Trend charts; no graph replay | None | None | Session replay (runtime) | Graph state replay across sessions |
| Agent/automation support | IDE plugin for AI refactoring | No | CI integration for boundary enforcement | No | First-class; entire product is for AI agent supervision |
| Intent inference | None | None | None | None | Inferred from change patterns (v1.x) |
| Deployment model | SaaS (cloud) | Desktop app (archived) | CLI tool (local) | IDE plugin | Local web app (localhost) |

---

## Sources

- **CodeScene product page**: https://codescene.com/product/behavioral-code-analysis — Behavioral code analysis, hotspot maps, change coupling, system maps (MEDIUM confidence, official source)
- **CodeScene architectural analysis blog**: https://codescene.com/blog/architectural-analysis-simplified-and-growing-programming-language-support — 2025 architectural analysis improvements (MEDIUM confidence)
- **Sourcetrail GitHub**: https://github.com/CoatiSoftware/Sourcetrail — Archived in 2021; community forks active; feature documentation in DOCUMENTATION.md (HIGH confidence, official source)
- **dependency-cruiser vs Madge comparison**: https://github.com/sverweij/dependency-cruiser/issues/203 — Maintainer comparison; rule enforcement vs simplicity tradeoff (HIGH confidence, primary source)
- **Madge circular dependency detection**: https://deepwiki.com/pahen/madge/4.4-circular-dependency-detection — Implementation details of DFS algorithm (MEDIUM confidence)
- **AppMap documentation**: https://appmap.io/docs/appmap-docs.html — Runtime architecture maps, sequence diagrams, IDE plugin features (MEDIUM confidence, official source)
- **IcePanel top 9 visual modelling tools**: https://icepanel.io/blog/2025-09-02-top-9-visual-modelling-tools-for-software-architecture — Feature comparison of IcePanel, Enterprise Architect, Visual Paradigm, Archi, GenMyModel (MEDIUM confidence)
- **Microsoft Architecture Review Agent**: https://techcommunity.microsoft.com/blog/educatordeveloperblog/stop-drawing-architecture-diagrams-manually-meet-the-open-source-ai-architecture/4496271 — Fan-in/fan-out metrics, SPOF detection (MEDIUM confidence)
- **vFunction architecture governance**: https://vfunction.com/blog/introducing-architecture-governance/ — Microservices sprawl governance, real-time sequence diagrams (MEDIUM confidence)
- **NDepend features**: https://www.ndepend.com/features/ — Dependency matrix, custom rules, code metrics (MEDIUM confidence, official source)
- **Structure101 acquired by SonarSource 2024**: https://pitchbook.com/profiles/company/652356-37 — Architecture enforcement tool now part of SonarSource (MEDIUM confidence)
- **Agentic coding trends**: https://www.teamday.ai/blog/complete-guide-to-agentic-coding-2026 — Active monitoring, oversight requirements for AI coding agents (LOW-MEDIUM confidence, single source)
- **Augment Code enterprise features**: https://www.augmentcode.com/guides/top-ai-coding-tools-2025-for-enterprise-developers — 200k token context, architecture-level understanding (MEDIUM confidence)

---

*Feature research for: Real-time architecture visualization for AI coding agents (ArchLens)*
*Researched: 2026-03-15*
