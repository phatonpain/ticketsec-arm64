# TicketSec Arm64 — AI Studio Context Package

## Purpose

This folder contains a complete, self-contained design brief for external
prototyping tools (Google AI Studio, Figma-to-code, Stitch, etc.).

Everything needed to redesign the TicketSec UI from scratch is here.
No file outside this folder needs to be read.

## Files

| # | File | What it contains | Read when |
|---|---|---|---|
| 1 | `00_PROJECT_BRIEF.md` | Project summary, stack, user, differentiator (Honesty Contract), endpoints | First |
| 2 | `01_DESIGN_TOKENS.md` | Complete color, type, spacing, radius, shadow, chart, and z-index token list | Second — reference while designing |
| 3 | `02_COMPONENT_SPECS.md` | Specs for TopBar, KPI blocks, triage table, ticket detail, charts, command palette, empty state, event log | Third |
| 4 | `03_DATA_MODEL.md` | `/predict` request/response schema, category list, 5 real ticket examples, rate limits, errors | Fourth |
| 5 | `04_VIEW_SPECS.md` | Layout grids for Command Center, Analytics, and Ticket Detail views | Fifth |
| 6 | `05_STATES_AND_HONESTY.md` | Loading/empty/error/offline state matrix and Honesty Contract rules | Sixth |
| 7 | `06_PROTOTYPE_PROMPT.md` | Ready-to-paste prompt for Google AI Studio or similar | Seventh — use to generate prototype |
| 8 | `MANIFEST.md` | This index | Anytime |

## How to feed the package to an external tool

### Option A — single concatenated paste

Copy the files in order (00 → 06) into one prompt, then append the prompt block
from `06_PROTOTYPE_PROMPT.md`. Most tools handle this if under their context
limit.

### Option B — file-by-file upload

Upload each `.md` file as a separate context document and instruct the tool:

> "Read these files in order: 00_PROJECT_BRIEF.md, 01_DESIGN_TOKENS.md,
> 02_COMPONENT_SPECS.md, 03_DATA_MODEL.md, 04_VIEW_SPECS.md,
> 05_STATES_AND_HONESTY.md, then execute the prompt in
> 06_PROTOTYPE_PROMPT.md."

### Option C — zip and upload

Zip the entire `docs/ai-studio-context/` folder and upload it. The tool can
read all files and use `MANIFEST.md` as the index.

## Autoconsistency rules

- All colors/spacing/type values come from `01_DESIGN_TOKENS.md`.
- All component anatomy comes from `02_COMPONENT_SPECS.md`.
- All example data comes from `03_DATA_MODEL.md`.
- All view layouts come from `04_VIEW_SPECS.md`.
- All state behavior comes from `05_STATES_AND_HONESTY.md`.
- `06_PROTOTYPE_PROMPT.md` references only the files above.

## Source references (for traceability, not required for the prototype)

| Concept | Source file in repo |
|---|---|
| Constitution & rules | `AGENTS.md` |
| Visual design constitution | `DESIGN_BRIEF.md` + `src/styles/tokens.css` |
| Quality rubric | `RUBRIC.md` |
| Mission phases | `docs/advanced-arsenal/MASTER_MISSION_v2.md` |
| Codebase map | `audit/STATE_MAP_v4.md` |
| Backend API | `app/main.py` |
| Ticket examples | `model/test_set.jsonl` |

## Unknowns

- `audit/STATE_MAP_v2.md` does not exist; `audit/STATE_MAP_v4.md` was used instead.
- `backend/app/main.py` does not exist; the backend lives at `app/main.py`.
- `backend/app/schemas/ticket.py` does not exist; schemas are inline in `app/main.py`.
- `backend/app/services/mock_data.py` does not exist; mock data comes from `model/test_set.jsonl`.
