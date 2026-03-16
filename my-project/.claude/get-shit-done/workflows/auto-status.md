<purpose>
Inspect the Auto GSD orchestration state for a project. Shows checkpoint status, recent journal entries, retry counts, token usage, and recovery options. Helps diagnose stuck projects and understand what happened during automated runs.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_args">
**Parse arguments:**

```
PROJECT_DIR="."
RESET_FLAG=false
JOURNAL_FLAG=false

if arguments contain "--project-dir <path>"; then
  PROJECT_DIR=<path>
fi
if arguments contain "--reset"; then
  RESET_FLAG=true
fi
if arguments contain "--journal"; then
  JOURNAL_FLAG=true
fi
```

Resolve `DB_PATH` to `{PROJECT_DIR}/.auto-gsd/agent.db`.
</step>

<step name="check_database">
**Check if database exists:**

```bash
ls {PROJECT_DIR}/.auto-gsd/agent.db 2>/dev/null
```

If no database found:
```
No Auto GSD database found at {PROJECT_DIR}/.auto-gsd/agent.db

This project hasn't been run through Auto GSD yet, or the database was deleted.
To start: npx tsx src/main.ts --idea <path> --project-dir {PROJECT_DIR}
Or bootstrap: npx tsx src/main.ts --bootstrap --project-dir {PROJECT_DIR}
```
Stop here if no database.
</step>

<step name="checkpoint_status">
**Query checkpoint status:**

```bash
sqlite3 {DB_PATH} "SELECT project_id, current_phase, current_gsd_phase_number, total_gsd_phases, completed_phases, status, idea_document_path FROM orchestration_state ORDER BY id DESC LIMIT 5;"
```

Display as formatted table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Auto GSD Status: {project_id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:     {status} (in_progress | complete | failed)
Phase:      {current_gsd_phase_number} / {total_gsd_phases}
FSM State:  {current_phase}
Completed:  {completed_phases}
Idea Doc:   {idea_document_path}
```

**Interpret status:**
- `in_progress` + valid phase = **Resumable**. Running again will pick up where it left off.
- `complete` = **Done**. All phases finished successfully.
- `failed` = **Failed**. Check journal for error details.
- No `in_progress` rows = **Clean slate**. Next run starts fresh.
</step>

<step name="recent_activity">
**Query recent journal entries:**

```bash
sqlite3 -header {DB_PATH} "SELECT id, kind, phase, substr(decision, 1, 80) as decision, timestamp FROM journal ORDER BY id DESC LIMIT 15;"
```

Display as timeline:

```
## Recent Activity

 ID  | Timestamp           | Kind            | Phase          | Decision
-----|---------------------|-----------------|----------------|----------------------------------
 45  | 2026-02-27 10:30:00 | PHASE_COMPLETE  |                | Project complete: all 5 phases...
 44  | 2026-02-27 10:29:55 | SDK_CALL        | verify-work-5  | Invoked: /gsd:verify-work 5...
 ...
```
</step>

<step name="retry_analysis">
**Check retry counts per phase:**

```bash
sqlite3 {DB_PATH} "SELECT phase, COUNT(*) as retries FROM journal WHERE kind='RETRY' GROUP BY phase ORDER BY retries DESC;"
```

If any retries exist:
```
## Retry History

Phase              | Retries | Max Allowed: 3
-------------------|---------|
execute-phase-3    | 2       | (1 remaining)
plan-phase-2       | 1       | (2 remaining)
```

If no retries: `No retries recorded — clean run.`
</step>

<step name="error_check">
**Check for errors and escalations:**

```bash
sqlite3 {DB_PATH} "SELECT kind, phase, decision, context FROM journal WHERE kind IN ('ERROR', 'ESCALATION') ORDER BY id DESC LIMIT 5;"
```

If errors exist:
```
## Errors & Escalations

[ERROR] Phase: discuss-phase-3
  AI Product Owner failed, falling back to synthetic context
  Context: {"error": "claude -p timed out after 120000ms"}

[ESCALATION] Phase: execute-phase-4
  Unrecoverable error after 3 retries
```
</step>

<step name="token_summary">
**Check token/cost usage (if available):**

```bash
sqlite3 {DB_PATH} "SELECT phase, SUM(json_extract(context, '$.costUsd')) as cost, SUM(json_extract(context, '$.numTurns')) as turns FROM journal WHERE kind='SDK_CALL' GROUP BY phase ORDER BY cost DESC;"
```

If data exists:
```
## Token Usage

Phase              | Cost (USD) | Turns
-------------------|------------|------
new-project        | $0.23      | 45
execute-phase-1    | $0.18      | 32
plan-phase-1       | $0.12      | 20
...
Total:             | $0.89      | 142
```
</step>

<step name="journal_detail">
**If --journal flag is set, show full journal:**

```bash
sqlite3 -header {DB_PATH} "SELECT * FROM journal ORDER BY id;"
```

Display all entries with full context JSON.
</step>

<step name="reset_flow">
**If --reset flag is set:**

Ask for confirmation:

```
This will mark all in-progress checkpoints as failed, allowing a fresh start.
The journal history is preserved.

Are you sure? (yes/no)
```

If confirmed:
```bash
sqlite3 {DB_PATH} "UPDATE orchestration_state SET status='failed' WHERE status='in_progress';"
```

Verify:
```bash
sqlite3 {DB_PATH} "SELECT COUNT(*) FROM orchestration_state WHERE status='in_progress';"
```

Expected: `0`

```
Checkpoint reset complete. Next run will start fresh.
Journal history preserved for debugging.
```
</step>

<step name="recommendations">
**Based on analysis, provide actionable recommendations:**

**If in_progress checkpoint exists:**
```
Next Step: Run `npx tsx src/main.ts --idea {idea_path} --project-dir {project_dir}` to resume from Phase {N}.
```

**If failed with retries exhausted:**
```
Next Step: Investigate the error above, fix the issue, then either:
  1. /gsd:auto-status --reset  (start fresh)
  2. Fix and re-run (will resume from failed phase)
```

**If failed due to budget exceeded:**
```
The project hit its cost budget limit.
To continue: re-run with a higher --budget value, or remove the budget cap.
```

**If complete:**
```
Project finished successfully. {completed_phases} phases completed.
```

**If AI Product Owner errors:**
```
The AI Product Owner had issues generating CONTEXT.md.
Check: echo "test" | claude -p --output-format text
If claude CLI isn't working, fix that first.
```
</step>

</process>

<output_format>
Always show: checkpoint status, recent activity (last 5), retry summary, and errors.
Only show token usage if SDK_CALL entries exist.
Only show full journal if --journal flag.
Only run reset if --reset flag.
End with actionable recommendation.
</output_format>
