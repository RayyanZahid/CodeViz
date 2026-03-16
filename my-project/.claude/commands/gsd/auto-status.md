---
name: gsd:auto-status
description: Inspect Auto GSD orchestration state, checkpoints, and recovery status
argument-hint: "[--project-dir <path>] [--reset] [--journal]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
Inspect the Auto GSD orchestration state for a project. Shows checkpoint status, recent journal entries, retry counts, and recovery options. Helps diagnose stuck projects and understand what happened during automated runs.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/auto-status.md
</execution_context>

<process>
Execute the auto-status workflow from @./.claude/get-shit-done/workflows/auto-status.md end-to-end.
Parse flags from arguments and pass to workflow.
</process>
