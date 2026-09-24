
# Ascent — Database & Data Flow Reference

**Purpose of this document:** a complete reference to Ascent's data model, storage choices, and data flows, for any LLM or developer working on the backend. Reflects the prototype-stage architecture (near-zero cost, no managed infrastructure) as well as the entity design carried over from the original system design.

---

## Architecture context

- **Style:** modular monolith — one deployable backend service, internal modules cleanly separated (API layer, Project Planning, Generation Orchestrator, Content & Syllabus, Progress, Code Execution, Auth), so any module (most likely Code Execution) can be split out later without a rewrite.
- **Stage:** college-level prototype, not a funded product. The goal is near-negligible operating cost.
- **LLM calls:** run on a shared developer API key (no per-user credential collection). Soft usage caps are enforced at the point of generation (e.g. a screen-count cap on Screen 2) rather than billing per user.
- **Database:** no managed/paid database assumed. SQLite (or an equivalent embedded/free-tier store) is sufficient for prototype scale — the entities below are relational but small in volume per user.
- **Code execution:** client-side, in-browser sandbox (WebContainers/Sandpack-style). This keeps the Code Execution module close to free to run; no server-side sandboxed containers for the prototype.
- **Server-side test re-verification** (re-running tests server-side to prevent gaming completion): flagged as a known gap for the prototype. For now, client-side test results are trusted; this is an explicit, documented shortcut, not an oversight, and should be revisited if Ascent moves beyond prototype stage.
- **Caching:** generation results should be cached where reasonably possible (e.g. by prompt similarity/hash) to avoid redundant LLM calls for common project types — relevant given the zero-cost goal.

---

## Entities

### `User`

- Standard account fields (id, auth identity, created_at).
- Owns one or more `Project` records.

### `Project`

- `owner` → `User`
- `source_input` — the original prompt or form input the learner submitted (Screen 1)
- `tech_stack` — confirmed stack (tags), set/edited on Screen 2
- `status` — `draft` → `planning` → `active` → `complete`
  - `draft`: created on Screen 1, before scope confirmation
  - `planning`: Screen 2 confirmed, `pages` list finalized
  - `active`: learner is in the course flow (Screen 4)
  - `complete`: all planned pages finished
- `pages` — ordered list of `Page` records (see below); this ordered list is finalized when Screen 2 is confirmed, and can only be **appended to**, never reordered or have items inserted mid-list, once generation has started (this constraint is enforced here specifically to avoid disturbing already-completed pages' verification history — see Screen 6's "add a screen" behavior).
- `credentials` — project-level credentials collected just-in-time (see Credentials section below); attached to the Project, not to individual Modules, so a credential entered once (e.g. a database URI) is reusable across every later module that needs it.
- `skill_estimate` — per-topic hint-verbosity setting derived from the Screen 3 diagnostic (not a skip/gate flag — every module is reachable regardless of diagnostic result, this only tunes how much scaffolding is shown by default).

### `Page`

- Belongs to `Project`
- `name`, `description` — set/edited during Screen 2 scope confirmation
- `order_index` — position in the build sequence
- `generated_code`, `file_structure` — output of the Generation Orchestrator's page-generation call (the "Webpage" step)
- `status` — locked / in-progress / complete (drives the Screen 6 timeline node state)
- `components` — list of `Component` records identified from this page's generated output

### `Component`

- Belongs to `Page`
- Identified by the Generation Orchestrator's component-selection step (LLM-driven; this step is not a separate service, it lives inside the Generation Orchestrator module)
- Examples: Navbar, Hero, Footer, Sidebar — becomes the basis for one `Module`

### `Module`

- Belongs to `Component`
- `concept_content` — theory/overview text, syntax references, subtopics (shown in Screen 4's theory drawer)
- `exercise` — the hands-on implementation task for this component
- `verification_test` — the automated test that gates completion, run client-side (and, when implemented, re-verified server-side)
- `hints` — ordered list of progressively-revealing hints (Screen 4's Hints panel); each reveal is tracked as a "cost" against the learner's attempt, not just content

### `ProgressRecord`

- `User` × `Module` composite
- `status` — not-started / in-progress / complete
- `attempts` — count of test runs
- `completed_at`
- `hints_revealed` — which hints were opened for this module, for the "cost" indicator in the Hints panel
- **Resume-state fields** (added to support Screen 5's "skip straight back in" behavior): `last_active_module_id`, `last_open_file` at the Project level (or denormalized onto the most recent ProgressRecord) — this is the minimum needed for a returning learner with one active project to be routed directly back into Screen 4 at their previous state. Scroll/cursor position is an optional nice-to-have, not required for the prototype.

### `ActivityLog` (new — supports Screen 6's streak and calendar)

- `User` × date, one row (or aggregated count) per active day
- Used to compute: current streak (consecutive active days), and the GitHub-style activity calendar (per-day activity intensity) shown on Screen 6
- A day counts as "active" based on any meaningful action — e.g. a module completed, a test run, or a minimum session duration; the exact threshold is a product decision, not fixed here, but should be defined once so streak logic is consistent
- This is a lightweight table — a simple day + count pair is sufficient at prototype scale, no need for granular event logging beyond what the calendar needs

### `Credential` (conceptual — may be a sub-object on `Project` rather than its own table at prototype scale)

- Project-scoped, not module-scoped
- Populated **just-in-time**, the first time a module actually needs it (e.g. a database connection string), never collected upfront
- For the prototype, the default path is an **auto-provisioned sandbox credential** (e.g. a throwaway embedded/SQLite-backed sandbox database per project) rather than requiring the learner to create an external account — consistent with the zero-setup-friction goal. The learner can optionally supply their own real credential (e.g. their own Mongo Atlas URI) instead, but this is never required to proceed.
- Ascent's own LLM key is explicitly **not** part of this table — it's a shared developer-level key for the whole app, not a per-project or per-user credential.

*(Syllabus is not its own table — it's a derived view: the ordered list of Modules across all of a Project's Pages, used to render Screen 6's timeline and Screen 4's module sidebar.)*

---

## Data flow by screen

**Screen 1 (Prompt):** Creates `Project` with `status: draft`, `source_input` set. No generation happens yet.

**Screen 2 (Scope Confirmation):** Triggers an LLM call (Generation Orchestrator) to infer a `Page` list from `source_input`. Learner edits are applied client-side to this proposed list before confirmation. On confirm: `Page` records are created in order, `Project.tech_stack` is set, `Project.status` → `planning`. This is the point where the soft screen-count cap is enforced, before any further generation cost is incurred.

**Screen 3 (Prerequisites):** Diagnostic answers (ideally drawn from a static question bank, not a fresh LLM call, to stay near-zero-cost) populate `Project.skill_estimate`. The "what you'll need later" preview is read-only, informational — it reads from `Page`/`Component` data already implied by the confirmed tech stack, but writes nothing.

**Screen 4 (Course/IDE) — the main loop:**

1. Generation Orchestrator generates the current `Page`'s code (`2.0` in the original DFD) — only the next page in order, not all pages upfront (lazy generation, consistent with the "full roadmap shown upfront, lesson detail generated lazily" decision).
2. Component Selector step identifies `Component` records from that page's output (`3.0`).
3. One `Module` is generated per `Component` (`4.0`), each with concept content, exercise, verification test, and hints.
4. The learner works in the persistent, accumulating codebase (workspace state tied to `Project`, not reset per Module) — file tree and editor reflect all code generated so far across the whole project, not just the current module.
5. On "Run Tests," `Module.verification_test` runs client-side (server-side re-run planned but not yet implemented at prototype stage); result updates `ProgressRecord`.
6. When a module first needs a project-level credential, the just-in-time `Credential` flow triggers, writing to `Project.credentials`.
7. `ActivityLog` is updated for the current day on meaningful learner actions.
8. On completing all of a `Page`'s modules, `Page.status` → complete, and the loop triggers generation of the next `Page` (`6.0`, "On Completion" in the original DFD) — or, if all planned pages are done, `Project.status` → `complete`.

**Screen 5 (Resume):** Reads `ProgressRecord`'s resume-state fields to route a returning learner with exactly one active `Project` straight back into Screen 4 at their last module/file. With multiple projects (or none), reads a lightweight summary per `Project` (name, completion fraction, last-active timestamp) to render the picker — no heavy aggregation needed at prototype scale.

**Screen 6 (Roadmap):** Reads the derived Syllabus view (all `Page`/`Module` records for the `Project`, with status) to render the timeline. Reads `ActivityLog` to compute streak and render the activity calendar. The "+ Add a screen" action appends a new `Page` record at the end of `Project.pages` (highest `order_index` + 1) and triggers its generation — explicitly disallowed from inserting before existing pages, to avoid invalidating already-completed pages' order or verification history.

---

## Known gaps / explicitly deferred (flagged, not solved, at this stage)

- **Server-side verification** of test results — currently client-side only; needed before completion status can be trusted at anything beyond prototype/demo scale.
- **LLM cost/rate-limit management at scale** — the shared-key model works for a prototype's traffic but has no per-user throttling beyond the Screen 2 soft cap; would need real rate-limiting if usage grows.
- **Non-React/JS tech stacks** — the client-side sandbox (WebContainers) is Node-based; supporting other stacks would need a different execution strategy, not just a data-model change.
- **Streak/activity threshold definition** — "what counts as an active day" needs to be fixed as a single rule before `ActivityLog` logic is implemented, to keep streak calculation consistent.
