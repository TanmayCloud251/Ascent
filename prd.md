
# Ascent — Product Requirements Document

**Status:** College-level prototype in active design. No production/funded scope yet.

---

## 1. Overview

**Ascent** is an AI-powered, project-first coding education platform. A learner describes what they want to build — a direct prompt ("e-commerce site using React") or a guided form (project type + tech stack) — and the platform plans and delivers a course that teaches each concept exactly when it's needed to build the next piece of that specific project. By the end, the learner has both learned the material and has a finished, working version of what they asked for.

**Problem it solves:** "Tutorial hell" — people follow generic tutorials, everything makes sense in the moment, and they still can't build something of their own afterward. Tying every lesson to a piece of a project the learner actually chose gives each concept a concrete reason to exist.

**Core mechanic:** Teach-then-build, not build-then-explain. The learner writes the implementation themselves, guided by a concept lesson, rather than the AI generating code first and explaining it after. This is slower per concept but produces more durable learning, and is a deliberate stance against the more common "AI builds it, then explains what it built" pattern used by close competitors.

---

## 2. Competitive landscape

- **CodeCrafters** — learners rebuild real infrastructure (Redis, Git, SQLite, etc.) from scratch in their own editor, with Git-based submission and automated feedback. Built for experienced engineers; fixed menu of famous systems, not open-ended project selection.
- **Boot.dev** — backend-focused (Python/Go), gamified, Socratic AI tutor that hints instead of answering; some existing AI-personalization (custom challenge generation, difficulty tuned to learner history).
- **Codecademy "AI Builder"** — closest existing analog. Describe a project, AI generates a working prototype immediately, then reverse-engineers a personalized curriculum from that generated code. Positioned against pure "vibe coding" tools (Lovable, v0). Key difference from Ascent: Codecademy builds first and teaches second; Ascent teaches first and builds second.

**Open gap Ascent targets:** no existing product combines (1) big, named, ambitious "systems" projects — not just small toy apps — with (2) a teach-then-build sequence where the learner writes the code, and (3) fully open-ended project selection.

**Where durable differentiation is likely to come from:** not the prompt-to-curriculum generation step itself (fast becoming table stakes across the category), but the execution environment, the pedagogy quality baked into sequencing and hints, and a real deployed project as the end state instead of a certificate.

---

## 3. Target user

**Open question, not yet locked.** Two candidate framings with different product implications:

- **Complete beginner** — bigger, slower product; requires more scaffolding, likely needs the "yes/no self-report" style prerequisites gate reconsidered carefully (see Section 6) since beginners systematically overestimate what they know.
- **Someone who knows a language but has never shipped a real project end-to-end** — sharper, narrower product; can move faster, tolerate more IDE-density (see Screen 4), and benefit most from the project-first structure specifically.

This is flagged as the single highest-leverage open decision — it affects scope, depth, onboarding difficulty, and go-to-market more than any other choice in this document.

---

## 4. Core product decisions (already made)

- Teach-then-build sequencing — learner writes the code, not the AI.
- Screen-by-screen course structure (organized by visible product screens, not abstract topics).
- Hints-before-answers; automated tests gate module completion (anti-tutorial-hell guardrail).
- Vertical-slice sequencing — something ugly-but-complete working early, deepened over time.
- Within-screen difficulty ladder: hardcoded render → real state/API → edge cases and robustness.
- Scope negotiation is required — "streaming platform" means a realistic learning-scoped v1, not literally Netflix; this negotiation is handled explicitly on Screen 2.
- Full roadmap shown upfront (learner sees the whole planned journey), with lesson detail generated lazily per screen so pacing can adapt.
- No credential or API-key collection anywhere in the prototype flow — Ascent runs on a shared developer LLM key; project-level credentials (e.g. a database) are deferred to just-in-time, inside the course screen, defaulting to an auto-provisioned sandbox rather than requiring the learner's own account.
- Diagnostic prerequisite checks (multiple-choice, not self-report) tune hint verbosity per topic — they never gate or skip content outright.

---

## 5. Budget & scope constraints (prototype stage)

- No funds to manage a full AI system, managed databases, or paid infrastructure — Ascent is explicitly scoped as a college-level prototype first, not a funded product.
- Token usage kept low: LLM generation runs lazily (one page at a time, not the whole project upfront), with a soft cap on planned-screen count enforced at Screen 2 to prevent runaway generation cost.
- No managed/paid database — a lightweight embedded store (e.g. SQLite) is sufficient at prototype scale.
- Code execution is entirely client-side (WebContainers/Sandpack-style sandbox) — avoids server-side sandboxed containers.
- Server-side test re-verification (anti-gaming measure) is explicitly deferred for the prototype; client-side test results are trusted for now, as a documented shortcut.
- Desktop-first; mobile responsiveness is not a prototype priority.

---

## 6. End-to-end user flow

1. **Prompt (Screen 1):** learner enters a free-text prompt or picks guided form options (project type + tech stack).
2. **Scope Confirmation (Screen 2):** AI proposes a plan (list of screens/features + tech stack); learner edits/confirms before anything locks. If the original prompt was ambiguous, one clarifying question is asked first. Confirming this screen finalizes the project's page list and locks in scope.
3. **Prerequisites (Screen 3):** short multiple-choice diagnostic per prerequisite technology (tunes hint depth, doesn't gate access); a quiet, read-only preview of what the project will need later (e.g. "you'll connect a database when we get there") — nothing is collected yet.
4. **Course / IDE (Screen 4):** the core loop. The AI generates the next screen's code, identifies its teachable components (Navbar, Hero, Footer, etc.), and generates one learning module per component. The learner reads a short lesson, writes the implementation themselves in a persistent, accumulating codebase, and runs tests to complete each module. On completing all modules for a page, the loop generates the next page, repeating until the project is complete.
5. **Resume (Screen 5):** on login, a returning learner with one active project is routed straight back into Screen 4 at their last state; with multiple projects (or none), a lightweight project picker is shown instead.
6. **Roadmap (Screen 6):** accessible from Screen 4 at any time — full progress timeline across all planned pages, plus a learning streak and GitHub-style activity calendar. Supports appending new screens/features to the end of the plan mid-project (never inserting between existing pages, to avoid disturbing completed pages' history).

---

## 7. Screen-by-screen summary

*(Full visual/UX specification lives in `design.md`; this is a functional summary.)*

| Screen                  | Purpose                            | Key mechanic                                                                    |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| 1 — Prompt             | Capture what to build              | Free text or guided form                                                        |
| 2 — Scope Confirmation | Lock a realistic v1 scope          | Editable AI-proposed screen list; optional clarifying question                  |
| 3 — Prerequisites      | Calibrate hint depth               | Short diagnostic (not self-report); informational-only credential preview       |
| 4 — Course/IDE         | Core teach-then-build loop         | VS Code-like editor, theory drawer, test verification, just-in-time credentials |
| 5 — Resume             | Route returning learners correctly | Auto-resume for one project; picker for multiple/none                           |
| 6 — Roadmap            | Show overall progress              | Linear timeline, append-only scope changes, streak + activity calendar          |

**Design system:** dark, cyberfunk-minimalist, professional-first — see `design.md` for full visual specification and per-screen design prompts.

---

## 8. Architecture summary

*(Full entity/data-flow specification lives in `database.md`; this is a functional summary.)*

- **Style:** modular monolith — one deployable service, internally separated into API layer, Project Planning, Generation Orchestrator, Content & Syllabus, Progress, Code Execution, and Auth modules. Boundaries are drawn so Code Execution (most likely candidate) can be split into its own service later without a rewrite.
- **Key entities:** `User`, `Project`, `Page`, `Component`, `Module`, `ProgressRecord`, `ActivityLog`; Syllabus is a derived view over Modules, not its own table.
- **LLM usage:** all generation calls (page generation, component selection, module generation) are centralized in the Generation Orchestrator, run on a shared developer key, with cost-control points at Screen 2 (soft cap) and via lazy per-page generation rather than generating the whole project upfront.
- **Credentials:** project-scoped, collected just-in-time inside Screen 4, defaulting to auto-provisioned sandbox resources rather than requiring learner-supplied accounts.

---

## 9. Known gaps / explicitly deferred

- **Server-side verification** of test results — client-side only for now; needed before completion status is trustworthy beyond demo scale.
- **LLM rate-limiting at scale** — the shared-key model has no per-user throttling beyond the Screen 2 soft cap.
- **Non-React/JS tech stacks** — the client-side sandbox (WebContainers) is Node-based; other stacks need a different execution strategy.
- **Streak/activity-day definition** — needs a single fixed rule (e.g. "a module completed or a test run") before `ActivityLog` logic is implemented.
- **Mid-project deviation beyond scope changes** — Screen 6 handles appending new screens, but not other kinds of learner deviation from the plan (e.g. wanting to change an already-completed page).

---

## 10. Open questions (not yet decided)

1. **Primary target user** — complete beginner vs. someone who knows a language but hasn't shipped a real project end-to-end. Highest-leverage open decision (see Section 3).
2. **Fully generative vs. curated content library vs. hybrid** for lesson content — drives most of the remaining engineering estimate.
3. **Does a screen's module bundle its own backend, or start on mock data** and wire up the real backend later? Currently leaning mock-first.
4. **Explicit "project setup" step** before screen 1's module (routing/state/styling decisions), vs. folding it into the first screen's module. Currently leaning toward making it explicit.

---

## 11. Suggested next steps

- Settle the target-user question first (Section 3/10.1) — it affects scope, depth, and go-to-market more than any other open item.
- Decide the content-generation architecture (generative vs. curated vs. hybrid — 10.2).
- Prototype one screen's module end-to-end (one page, one component, one generated lesson) to validate that the teach-then-build loop actually feels good before building the full pipeline.
- Finalize the streak/activity-day definition before implementing `ActivityLog`.

---

## Related documents

- `design.md` — full visual design system and per-screen UI specification
- `database.md` — full entity model and per-screen data flow
- Individual screen design prompts (`ascent-screen1-prompt.md` through `ascent-screen6-prompt.md`) — used to generate each screen's visual mockup
