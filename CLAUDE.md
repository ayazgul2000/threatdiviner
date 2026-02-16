# ThreatDiviner Threat Modeling — Claude CLI Instructions

---

## ⚠️ HIGHEST PRIORITY — CHECKPOINT COMPLETION PROTOCOL ⚠️

**THIS IS A STRICT CONTROL. DO NOT SKIP ANY STEP.**

After completing ANY checkpoint, you MUST execute these steps in exact order:

1. Generate repomix output: `npx repomix --output repomix-output.xml`
2. Zip the file and place in `.claude/ThreatModel/`:
   ```bash
   powershell -Command "Compress-Archive -Path 'repomix-output.xml' -DestinationPath '.claude/ThreatModel/repomix-output.zip' -Force"
   ```
3. Ensure `CHECKPOINT.md` is updated in `.claude/ThreatModel/CHECKPOINT.md`
4. Commit and tag the checkpoint
5. **RUN THE TRIGGER SCRIPT**: `python test_claude_trigger.py`

**The zip file MUST be named `repomix-output.zip` and MUST be in `.claude/ThreatModel/` folder, overwriting any previous version.**

**DO NOT proceed to the next checkpoint until ALL steps are complete.**

---

## MANDATORY: Read Before Any Action

You MUST read and follow these specification documents in `.claude/ThreatModel/` before writing ANY code:

1. **08_rules.md** — Code constraints, forbidden patterns, checkpoint protocol (§11)
2. **09_implementation_plan.md** — 42 granular checkpoints, phase dependencies, acceptance criteria

Only after reading those, reference as needed:
- 00_overview.md — Product vision, integration points
- 01_product_context.md — User stories, personas
- 02_functional_spec.md — Feature specifications
- 03_technical_spec.md — Architecture, existing schema, NEW tables only
- 04_data_models.md — XML/YAML schemas, mapping configs
- 05_ui_screens.md — UI layouts, states, test cases
- 06_user_flows.md — Step-by-step flows, error handling
- 07_admin_console.md — Admin UI, feed sync, 3-schema pattern
- 10_gap_analysis.md — Existing codebase vs new features

---

## CRITICAL RULES

### 0. READ BEFORE WRITING CODE — MANDATORY
**CRITICAL: You are strictly forbidden from generating code until you have:**
1. Read `08_rules.md` in this session
2. Read `09_implementation_plan.md` in this session
3. Read the relevant spec documents for the checkpoint you are implementing

**If you have not read these documents in THIS session, read them immediately before doing anything else.**

**NEVER invent checkpoints.** Only implement checkpoints that exist in `09_implementation_plan.md`. If a checkpoint is not in that document, it does not exist. Do not add "next checkpoints" to CHECKPOINT.md unless they are explicitly defined in the implementation plan.

### 1. No Hardcoding
- Sample data in specs is ILLUSTRATIVE ONLY
- NEVER seed tables with hardcoded values
- Tables start EMPTY — data comes from Admin UI or Feed Sync
- If you see "50 shapes" or "25 risks" in specs, build the SYSTEM that manages N items dynamically

### 2. Use Existing Codebase
- This is NOT a greenfield project
- Read existing Prisma schema, services, controllers FIRST
- Extend existing models (ThreatModel, Threat, ThreatModelComponent)
- Use `tenantId` (not `orgId`) — match existing conventions
- Reuse existing patterns (auth, audit, AI provider, Jira integration)

### 3. Checkpoint Protocol (08_rules.md §11)
After EACH checkpoint deliverable:
```
1. Complete the deliverable
2. APPEND to .claude/ThreatModel/CHECKPOINT.md (use --- separator)
3. Run: repomix --output .claude/ThreatModel/repomix-output.xml (REPLACE)
4. Git add, but RESET the checkpoint files:
   git add -A
   git reset .claude/ThreatModel/CHECKPOINT.md
   git reset .claude/ThreatModel/repomix-output.xml
5. Commit: git commit -m "Checkpoint X.Y: [description]"
6. Tag: git tag -a vX.Y.0 -m "Checkpoint X.Y: [description]"
7. Push: git push origin main --tags
8. Output: "CHECKPOINT vX.Y.0 COMPLETE — Files ready in .claude/ThreatModel/"
9. FULL STOP — Do NOT proceed to next checkpoint
```

### 4. Version Format
- `v{phase}.{checkpoint}.0` — e.g., v2.1.0 = Phase 2, Checkpoint 1
- Fix suffix: `v2.1.0.fix1` if rework needed

---

---

## WORKFLOW

1. Read 08_rules.md completely
2. Read 09_implementation_plan.md — find current checkpoint
3. Read CHECKPOINT.md — check for FIX instructions
4. **READ THE RELEVANT SPEC DOCS FOR THIS CHECKPOINT** — Before implementing ANY checkpoint, read the spec documents that apply:
   - UI work → Read 05_ui_screens.md, 06_user_flows.md
   - Data models → Read 04_data_models.md, 03_technical_spec.md
   - Features → Read 02_functional_spec.md
   - Do NOT implement from assumptions — implement from specifications
5. Implement ONLY that checkpoint's deliverables
6. Run tests, verify working
7. Execute checkpoint protocol (above)
8. STOP and wait for approval

---

## FORBIDDEN

- ❌ **Writing code before reading 08_rules.md and 09_implementation_plan.md in this session**
- ❌ **Inventing checkpoints that don't exist in 09_implementation_plan.md**
- ❌ Skipping to future checkpoints
- ❌ Combining multiple checkpoints
- ❌ Hardcoding sample data
- ❌ Using `orgId` (use `tenantId`)
- ❌ Creating tables that already exist
- ❌ Proceeding without checkpoint approval
- ❌ Using `any` types in TypeScript
- ❌ Console.log in production code
- ❌ Skipping tests

---

## FILE LOCATIONS

| File | Purpose |
|------|---------|
| `.claude/ThreatModel/*.md` | Specification documents |
| `.claude/ThreatModel/CHECKPOINT.md` | Append checkpoint summaries here |
| `.claude/ThreatModel/repomix-output.xml` | Replace with fresh repomix each checkpoint |
| `apps/api/prisma/schema.prisma` | Existing + new tables |
| `apps/dashboard/src/components/threat-modeling/` | UI components |
| `apps/api/src/threat-modeling/` | Backend services |

---

## START

```
Read .claude/ThreatModel/08_rules.md now.
Then read .claude/ThreatModel/09_implementation_plan.md.
Then check .claude/ThreatModel/CHECKPOINT.md for current state.
Implement the next checkpoint only.
STOP after checkpoint protocol complete.
```
