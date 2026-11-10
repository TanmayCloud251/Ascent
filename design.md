# Ascent — Design Reference

**Project:** Ascent — an AI-powered, project-first coding education platform. Learners describe a project they want to build (direct prompt or guided form), and the platform teaches each concept exactly when it's needed to build the next screen/component of that real project. The learner writes the code themselves, guided by short lessons and hints, rather than the AI generating the code for them. By the end, the learner has both learned the material and has a finished, working version of what they asked for.

**Stage:** College-level prototype. No managed backend cost — LLM calls run on a shared developer key with usage caps, no paid database, client-side code execution sandbox.

This document is a reference for any LLM or designer picking up work on Ascent's UI. Each screen section below is written to be self-contained. Screenshots/mockup images for each screen can be added directly under their respective section headers.

---

## Global Design System

**Visual direction:** Cyberfunk-minimalist. Professional and restrained first, cyberpunk-adjacent second. Dark, high-tech aesthetic achieved through subtle neon accents, sharp geometry, and glow effects used sparingly. Avoid neon overload, busy scanline/glitch textures, gradient-heavy "AI SaaS" looks, and gamified visual language (no loud checkmark-green, no flame/badge icons, no celebratory pop-ups except at true project completion).

**Design tokens:**

- Background: near-black (`#0A0A0F` or similar), not pure black
- Accent: a single neon tone used sparingly across the whole app — electric cyan or violet — reserved for active/focus states, primary CTAs, and small interactive highlights. No gradients, no rainbow neon.
- Status colors: desaturated to fit dark mode — muted green for success/pass, coral/rose for error/fail, amber for in-progress/running. Never neon-bright or alarming.
- Typography: geometric sans (Inter, Geist, or similar) for UI text and prose; monospace (JetBrains Mono, Space Mono, or similar) reserved for code, file names, terminal content, and technical tags.
- Motion: subtle glow/pulse on active/focused elements only — no constant animation, no particle effects, no heavy transitions.
- Navbar (shared across Screens 1-5): minimal — wordmark "Ascent" on the left, 2-3 text links on the right, hairline low-opacity bottom border, no shadow.

**Budget/architecture constraints informing the UI:**

- No user-facing API key entry — Ascent runs on a shared developer key with soft usage caps built into the flow (e.g. screen-count caps), not hard paywalls.
- No managed database assumed for the prototype — project/module state is lightweight (SQLite or similar).
- Code execution is client-side (WebContainers/Sandpack-style sandbox).
- Desktop-first; mobile responsiveness is not a priority for the prototype.

---

## Screen 1 — Prompt / Form

**Purpose:** The entry point. The learner describes what they want to build, either via free text or a guided form (project type + tech stack).

**Layout:**

- Minimal navbar at top.
- Centered hero area: short one-line headline (e.g. "What are we building?").
- Large terminal/command-line-styled input field: dark field, thin glowing border on focus, blinking-cursor affordance, placeholder like `e-commerce app using React`.
- 4-5 suggestion chips below the input (e.g. "E-commerce app," "Social feed," "Streaming platform," "Portfolio site") — minimal outlined pills.
- Single primary CTA ("Continue" or arrow icon) in the accent color.
- Optional subtle live "detected stack" text below the input (e.g. "Detected: React, Node.js").
- Background mostly flat near-black, at most one subtle atmospheric element (faint grid, soft radial glow behind input).

**Interaction notes:** Almost nothing on screen besides navbar and the central input — minimalism is the point.

<!-- Screen 1 image here -->

---

## Screen 2 — Scope Confirmation

**Purpose:** Shows the AI's interpreted project plan (list of screens/features) back to the learner for confirmation/editing before any real generation work begins. Prevents wasted generation on a scope the learner didn't want, and is where "realistic v1" scope negotiation happens.

**Flow logic:** If the original prompt was clear and specific, skip straight to the checklist. If ambiguous, show one short clarifying question first (single centered question, 2-4 short answer options styled like Screen 1's suggestion chips), then show the checklist based on the answer.

**Layout:**

- Short header (e.g. "Here's what we'll build").
- Editable list of planned screens/features, one row per page (name, one-line description, ✕ remove affordance) — styled as a clean, low-contrast bordered list, not heavy cards.
- "+ Add a screen" input below the list, same minimal style.
- Tech stack row below the list: small editable outlined tags/pills in monospace font.
- Quiet scope indicator line (e.g. "8 screens planned") — informational, not a warning or limit bar. A soft cap (~10-12 screens) discourages scope bloat without hard-blocking or exposing token/cost math to the learner.
- Primary CTA: "Looks good, let's build" — the single most visually dominant element on the screen.
- Secondary "Start over" link — muted, sends back to Screen 1 if the whole plan is off-base.

**Backend tie-in:** Confirming this screen finalizes the `Project.pages` list (names + order) and moves `Project.status` from `draft` to `planning`.

<!-- Screen 2 image here -->

---

## Screen 3 — Prerequisites / Diagnostic

**Purpose:** Calibrates hint depth per topic (not a skip/gate mechanism), and gives the learner a quiet, informational preview of what the project will need later (e.g. a database) — nothing is collected or set up on this screen. No API-key or credential entry happens here (or anywhere upfront) — the platform's own LLM key is a shared developer key, and project-level credentials (like a database) are deferred to Screen 4, just-in-time.

**Layout:**

- Short header (e.g. "Quick check before we start").
- 1-2 short multiple-choice diagnostic questions per prerequisite technology (derived from the confirmed stack), shown one at a time, centered — reuses the Screen 2 clarifying-question visual pattern. Keep total to ~4-6 questions even for a multi-technology stack. A slim, low-contrast progress label (e.g. "Question 2 of 5").
- "What you'll need later" preview list below/after the diagnostic: small muted-text rows with simple icons (e.g. "MongoDB — you'll connect a database when we get there"). Lowest-contrast content on the screen — informational only, no input fields.
- Primary CTA: "Start building" — moves into Screen 4.

**Backend tie-in:** Diagnostic results populate a per-user skill estimate used to tune hint verbosity in module content. No `Credential` records are created on this screen.

**Open implementation note:** Diagnostic questions can be a small hand-maintained static question bank per common technology rather than dynamically LLM-generated, to keep this screen effectively free to run.

<!-- Screen 3 image here -->

---

## Screen 4 — Course / IDE Screen (core screen)

**Purpose:** Where the learner spends most of their time — reads a short concept lesson, then writes real code for the current module (a project component, e.g. Navbar, Hero, Footer) against a persistent, accumulating codebase, with live editor, terminal, running preview, and test verification.

**UX reference:** This screen's interaction model should feel like VS Code — resizable/collapsible panels (not a fixed grid), a slim activity/icon rail on the far left, a file-explorer-style tree view, a tabbed editor area, and a bottom status/output strip. Apply minimalism to UI chrome (borders, dividers, spacing discipline) rather than to content density — this screen is allowed to be information-dense the way a professional IDE is.

**Layout:**

- **Far-left icon rail** (narrow, VS Code activity-bar style): Modules (default), Files, Hints — icon-only, subtle active-state highlight.
- **Sidebar panel** (driven by icon rail selection):
  - *Modules view (default):* current page's components with nested subtopics; current module highlighted with accent glow, completed modules dimmed. Includes a "View full roadmap" link at the bottom (routes to Screen 6).
  - *Files view:* VS Code-style file tree of the accumulating project codebase.
  - *Hints view:* collapsed hint list for the current module, each hint revealed on click with a visible "cost" indicator.
- **Theory/lesson drawer** (toggleable, slides in/out — not a permanently docked column): current module's concept explanation, syntax references, and a searchable list at the top to jump back to earlier modules' theory content.
- **Main editor area** (dominant, tabbed): open file tabs, plus a "Terminal" tab and a "Preview" tab (running app) — largest region on screen by far.
- **Bottom verification strip** (persistent, VS Code status-bar style): current test status (not run / running / pass / fail) in desaturated status colors, with a "Run Tests" action in the accent color. On repeated failures, escalate by auto-suggesting the hint panel rather than leaving the learner stuck.

**Interaction notes:**

- Codebase and workspace state persist per-Project across modules and pages — not reset per module.
- Just-in-time credentials: when a module first needs a real credential (e.g. a database connection), an inline panel appears in the theory drawer explaining why it's needed, with an option to use an auto-provisioned sandbox instead of the learner's own account.
- On test pass, use a subtle non-intrusive success state (module dims in the sidebar, list advances) rather than a modal or celebration animation — save stronger celebration for full project completion.
- Desktop-first; not designed for mobile in the prototype.

<!-- Screen 4 image here -->

---

## Screen 5 — Resume / Project Picker

**Purpose:** Not a linear flow step — a login-landing point. If a returning learner has exactly one active project, skip this screen entirely and route straight back into Screen 4 at their last state. This screen only appears for learners with multiple projects, or none.

**Layout:**

- Short header (e.g. "Your projects").
- Grid/list of project cards, one per in-progress or completed project: project name/title (inferred from original prompt), simple progress indicator (plain text fraction, e.g. "5 of 8 screens," or a thin progress line — no charts or heatmaps here), last-active time. Low-contrast by default, accent-colored hover/glow to indicate clickability. Clicking anywhere on a card opens that project (Screen 4, restored state).
- "+ New project" card/affordance, styled distinctly (outlined/dashed or button), routes to Screen 1.
- Empty state (zero projects): no cards, centered calm prompt (e.g. "You haven't started a project yet") with "+ New project" as the sole focus.

**Backend tie-in:** Requires resume-state fields on `ProgressRecord` (at minimum: last active module id, last open file) for the "skip straight back in" case to work correctly.

<!-- Screen 5 image here -->

---

## Screen 6 — Roadmap / Syllabus

**Purpose:** Full-project overview, reached from Screen 4 via a "view full roadmap" link (not a linear flow step). Shows progress across all planned pages, supports appending new screens/features mid-project, and displays a learning streak and activity calendar.

**Layout:**

- Header row: short heading (e.g. "Your roadmap") with a quiet "back to course" link back into Screen 4.
- **Progress timeline** (primary content): vertical or horizontal timeline of nodes, one per planned page, connected by a thin low-contrast line — linear, not a branching graph, since build order has no real branching. Three node states: upcoming (dimmed outline), in-progress (accent glow/pulse — the clear focal point), complete (muted/dimmed, not bright green). Nodes expandable to reveal that page's modules without navigating away.
- **"+ Add a screen"** affordance positioned only at the end of the timeline — communicates by placement alone that new pages can only be appended, not inserted between existing ones (avoids disturbing already-completed pages' order/verification records). Reuses the Screen 2 add-item input pattern. Same soft-cap logic as Screen 2 applies.
- **Streak + activity section** (secondary, below/beside the timeline): understated streak counter (e.g. "12 day streak," accent color on the number only, no flame/badge icons); a GitHub-style contribution calendar grid, square opacity/intensity in the accent color indicating activity level per day, no activity = near-empty square. Visually subordinate to the timeline — smaller, lower weight, a reference glance rather than a hero element.

<!-- Screen 6 image here -->

---

## Cross-screen notes

- Screens 1, 2, 3, and 5 share the same minimal-list/card visual language (low-contrast rows, accent-colored active/hover states, one dominant CTA per screen) — reuse components across them rather than inventing new patterns per screen.
- Screen 2's clarifying-question component is reused as-is for Screen 3's diagnostic questions.
- Screen 4 is deliberately the outlier in density (IDE-grade UI) — this is intentional, not a departure from the design system, since it should feel like a professional dev tool once the learner is actually building.
- No credential/API-key entry exists anywhere in the flow for the prototype version — this was a deliberate simplification from an earlier design pass, kept here as context in case it's revisited for a funded/production version.
