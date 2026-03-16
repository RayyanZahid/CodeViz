Master Prompt



You are a principal software architect and full-stack engineer. Your task is to design and implement a real-time architecture visualization system for AI coding agents.



The system must visualize, in real time, what an AI coding agent is building, but at a human-meaningful architectural level, not a file or function level.



The visualization must be 2D, structured, stable, and intelligible.



The goal is architectural situational awareness for humans supervising high-speed AI coding agents.



The system should feel like air traffic control for software architecture.



Core Problem



Coding agents can write code faster than humans can read.



Humans supervising these systems need to see:



• what the agent is trying to accomplish

• which parts of the system are being modified

• how the architecture is evolving

• whether risky architectural changes occur



The system must therefore visualize intent, structure, and architectural impact, not raw code edits.



Key Design Principle



Never visualize raw file changes directly.



Instead transform low-level code edits into architectural events.



Pipeline:



agent events

→ code change detection

→ structural analysis

→ architectural interpretation

→ visualization update



Visualization Requirements



The visualization must be:



• 2D

• stable

• structured

• readable at a glance

• not cluttered



Do NOT build a generic graph viewer.



Instead build an intelligent architecture map.



Graph Abstraction Level



Nodes represent:



system

services

containers

subsystems

major modules

databases

queues

external APIs

infrastructure components



Edges represent:



calls

reads/writes

publishes/subscribes

depends on

owns



Do NOT represent:



functions

individual classes

file level nodes (unless zoomed)



Visualization Layout Rules



The layout must remain stable.



Use semantic zones:



LEFT

frontend / clients



CENTER LEFT

API layer



CENTER

services / domain logic



RIGHT

data stores



OUTER RING

external systems



BOTTOM

infrastructure / queues / workers



New nodes should appear near related nodes.



The entire graph should never reshuffle.



Nodes must maintain sticky coordinates.



Only perform local layout adjustments.



Real-Time Behavior



The map must update in real time.



Use:



filesystem watchers

agent event hooks

websocket streaming



When code changes:



1 detect modified files

2 parse affected modules

3 update dependency graph incrementally

4 infer architectural impact

5 update visualization



Architectural Events



Translate code changes into events such as:



component created

component split

component merged

dependency added

dependency removed

boundary violation

data flow change

cross-cutting concern introduced



Example:



New service created

AuthService



Dependency added

API → AuthService



Service split

PaymentService → PaymentService + BillingService



Activity Layer



Overlay live activity onto the architecture map.



Active components should:



glow

pulse

show progress indicators



Recent architectural changes should animate briefly.



Risk Detection



Add heuristics that detect architectural risk signals.



Examples:



circular dependency introduced

controller accessing database directly

excessive fan-out dependency

cross-boundary access

untyped or untested modules



These should appear as alerts.



Interface Layout



The UI should contain four main regions.



Architecture Canvas



Main 2D map of the system.



Only major components.



Active regions highlighted.



Activity Feed



Natural language architectural updates.



Example:



Claude created AuthMiddleware

Claude split PaymentService into BillingService

Claude introduced Redis cache



Risk Panel



Architectural warnings.



Example:



API now directly accessing database

Circular dependency detected



Intent Panel



Displays current agent objective.



Example:



Goal

Implement JWT authentication



Subtasks

create middleware

add login endpoint

integrate session store



System Architecture



Backend responsibilities:



agent event ingestion

file change detection

AST parsing

dependency graph generation

architectural inference

event streaming



Frontend responsibilities:



graph rendering

layout engine

live event animations

interaction and zoom

heatmaps



Suggested Technology Stack



Backend



Node.js or Python

Tree-sitter for parsing

incremental dependency graph

SQLite or Postgres initially

WebSocket event streaming



Frontend



React

Canvas or WebGL rendering

D3 or custom layout engine



Rendering must support thousands of nodes smoothly.



Data Model



GraphNode



id

type

label

position

zone

metadata



GraphEdge



source

target

type



ArchitecturalEvent



timestamp

eventType

description

affectedNodes

riskLevel



AgentIntent



goal

subtasks

progress



Required Features



Real-time architecture updates

stable graph layout

architectural event stream

activity highlighting

risk detection

time-lapse replay



The user must be able to scrub through system evolution over time.



Milestones



Phase 1

Graph engine

basic architecture extraction

2D rendering



Phase 2

agent event integration

real-time updates

activity overlays



Phase 3

architectural inference

risk detection



Phase 4

time travel architecture playback



Deliverables



Produce:



system architecture diagram

data schema

backend architecture

frontend architecture

implementation plan

first working prototype



Write production-quality code.



Keep the system modular.



Critical Design Constraints



The visualization must prioritize:



clarity

stability

semantic meaning



Avoid:



spaghetti dependency graphs

rapid layout reshuffling

file-level noise

overly detailed nodes



Humans must understand the system within seconds of looking at it.



Ultimate Objective



Create a system that allows humans to supervise AI-driven software construction.



A person should be able to glance at the screen and instantly know:



what the AI is building

where it is working

how the architecture is evolving

whether anything dangerous happened.

