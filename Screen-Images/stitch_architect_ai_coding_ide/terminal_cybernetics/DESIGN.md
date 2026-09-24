---
name: Terminal Cybernetics
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#303038'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#5dffd2'
  on-secondary: '#00382b'
  secondary-container: '#00e3b6'
  on-secondary-container: '#00604b'
  tertiary: '#fff3ea'
  on-tertiary: '#472a00'
  tertiary-container: '#ffd19c'
  on-tertiary-container: '#855300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#43fece'
  secondary-fixed-dim: '#00e0b3'
  on-secondary-fixed: '#002118'
  on-secondary-fixed-variant: '#00513f'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
  gutter-mobile: 0.75rem
  gutter-desktop: 1rem
  sidebar-width: 16rem
  terminal-height-collapsed: 2.25rem
---

## Brand & Style

This design system embodies a modern, futuristic, developer-first engineering cockpit designed for an AI-native project environment. The aesthetic balances extreme utilitarian precision with deliberate cybernetic accents. It avoids playful toy-like metaphors in favor of feeling like an elite terminal-integrated IDE—purpose-built for engineers mastering complex software architecture.

Key tenets:
- **Utilitarian Density:** Tight, highly scannable layouts with zero ornamental clutter. Every pixel communicates status, hierarchy, or action.
- **Dark-Mode Native:** Engineered strictly for deep dark-mode environments to reduce cognitive fatigue during prolonged coding sprints.
- **Cybernetic Restraint:** High-impact electric cyan and neon mint accents applied sparingly to active cursors, focused states, and compiler milestones, standing out against quiet charcoal foundations.
- **Mechanical Rhythm:** Monospaced data displays paired with razor-sharp geometric typography for UI chrome, referencing industrial control panels, CI/CD runners, and telemetry graphs.

## Colors

The color palette is built on deep carbon tones to mimic hardware terminals, using narrow spectral accents to guide visual attention:

- **Canvas & Surfaces:**
  - Background Root: `#0A0A0F` (deep space charcoal canvas)
  - Surface Level 1: `#12121A` (primary card, sidebar, and container background)
  - Surface Level 2: `#1A1A24` (elevated panels, modals, and tooltips)
  - Surface Level 3: `#232332` (active tabs, floating utility panels, and hover states)
  - Subtle Border: `#232332` (crisp structural demarcation)
  - Active Border: `#00F0FF` (terminal focus and interactive highlights)

- **Accents:**
  - Primary (`#00F0FF`): Electric Cyan for active cursors, primary actions, and compilation highlights.
  - Secondary (`#0AE6B8`): Neon Teal for AI assistant feedback, completed nodes, and verified states.
  - Tertiary (`#F59E0B`): Amber for running builds, in-progress tests, and non-blocking warnings.

- **Status & Diagnostics:**
  - Error: `#F43F5E` (desaturated crimson for failed tests, syntax breaks, and stack traces)
  - Success: `#10B981` (muted emerald for passing suites and deploy readiness)
  - Warning: `#F59E0B` (amber for lint warnings and resource spikes)
  - Info / Ghost: `#64748B` (desaturated slate for metadata, time-stamps, and inactive indicators)

## Typography

The type hierarchy employs a strict functional partition: **Geist** handles human communication, navigational chrome, and long-form instructional prose, while **JetBrains Mono** governs the functional machine interface—file trees, code views, test suites, terminal streams, and system metrics.

- Use uppercase tracking (`letterSpacing: 0.06em`) for `label-sm` badges to simulate hardware readouts and micro-status tags.
- Code blocks must strictly enforce tab stop visualization and non-proportional alignment across all viewport scales.
- Never use bold weights for mono code blocks; syntax differentiation must rely on color tokens rather than stroke weight variations.

## Layout & Spacing

The layout is an adaptive IDE-style multi-pane workspace driven by an application-grid shell rather than a traditional continuous-scroll document layout:

- **Viewport Framework:** `100vw` by `100dvh` fixed shell with internal scrollable viewports. 
- **Pane Rhythm:** Docked panels rely on precise hairline dividers (`1px solid #232332`) rather than empty whitespace margins.
- **Compact Density:** Default spacing utilizes the 4px baseline, prioritizing dense informational packaging (`space-xs` through `space-md` for chrome and tree rows).
- **Responsive Adaptations:**
  - **Desktop (>= 1024px):** Tri-pane layout (Project Explorer / File Tree [16rem], Central Code & Workspace Editor [flexible 1fr], Interactive Terminal & AI Reviewer [22rem-30rem]).
  - **Tablet (768px - 1023px):** Collapsible side rails; primary focus locks to the active document with floating drawer docks.
  - **Mobile (< 768px):** Single-pane view with a bottom command bar; code editors zoom into full-width mode with touch-optimized horizontal tab bars.

## Elevation & Depth

Visual hierarchy is constructed through **tonal stacking, hair-line borders, and targeted luminescent glows** rather than traditional drop shadows:

- **Level 0 (Canvas Base):** `#0A0A0F` flat background for the root viewport.
- **Level 1 (Docked Containers):** `#12121A` paired with a `1px solid #232332` border. No drop shadows.
- **Level 2 (Popovers, Flyouts, Diagnostics):** `#1A1A24` overlay with `1px solid #232332` and an ambient shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.7)`.
- **Active Glow Elevation:** Applied exclusively to focused inputs, selected nodes, and active CI/CD execution steps using a localized neon bloom:
  - Cyan Glow: `box-shadow: 0 0 0 1px #00F0FF, 0 0 12px rgba(0, 240, 255, 0.25)`
  - Mint Glow: `box-shadow: 0 0 0 1px #0AE6B8, 0 0 12px rgba(10, 230, 184, 0.25)`
- **Glass Integration:** Modals and bottom command bars apply `backdrop-filter: blur(12px)` over `#12121A` with 85% alpha (`#12121AD9`).

## Shapes

This design system uses a strict **Soft (0.25rem / 4px)** geometry to preserve an industrial, high-precision technical instrument feel:

- Standard controls, buttons, toolbars, and inputs strictly adhere to `0.25rem` (4px) radii.
- Outer structural card containers and modular IDE panels use `0.5rem` (8px).
- Badges, status pills, and test strips maintain crisp `0.25rem` boundaries. Fully circular pill shapes are forbidden to prevent a soft, consumer-app aesthetic.

## Components

### Buttons
- **Primary:** Background `#00F0FF`, text `#0A0A0F`, font `JetBrains Mono` 12px medium, tracking `0.02em`. Hover: `#33F3FF` with subtle neon glow (`0 0 8px rgba(0, 240, 255, 0.4)`).
- **Secondary / Outline:** Background `#12121A`, text `#E2E8F0`, border `1px solid #232332`. Hover: border `#00F0FF`, text `#00F0FF`.
- **Terminal Ghost:** Transparent background, text `#94A3B8`. Hover: background `#1A1A24`, text `#F8FAFC`.

### Chips & Badges
- **Status Badges:** JetBrains Mono 10px uppercase, padding `2px 6px`, border-radius `2px`.
  - Pass: Background `rgba(16, 185, 129, 0.12)`, text `#10B981`, border `1px solid rgba(16, 185, 129, 0.25)`.
  - Fail: Background `rgba(244, 63, 94, 0.12)`, text `#F43F5E`, border `1px solid rgba(244, 63, 94, 0.25)`.
  - Pending: Background `rgba(245, 158, 11, 0.12)`, text `#F59E0B`, border `1px solid rgba(245, 158, 11, 0.25)`.

### Inputs & Terminal Prompts
- Background `#0A0A0F`, border `1px solid #232332`, text `#F8FAFC`, typography `JetBrains Mono` 13px. Focus state: border `#00F0FF`, subtle cyan box glow. Caret: solid `#00F0FF` with a 1s pulse animation.

### Checkboxes & Radios
- Size `14px x 14px`, border `1px solid #232332`, background `#0A0A0F`, radius `2px`. Checked state: background `#00F0FF`, foreground icon `#0A0A0F`.

### Cards & Panels
- Background `#12121A`, border `1px solid #232332`, radius `6px`. Panel headers use `#161622`, height `32px`, font `Geist` 12px medium, bottom border `1px solid #232332`.

### CI/CD Test Strips & Node Graphs
- **Test Strip:** Linear matrix row (`#12121A`), height `28px`, separated by hairline vertical rules. Leading status: 6px circular LED indicator (blinking amber for running, steady green for passed).
- **Graph Nodes:** Rectangles of `#1A1A24` bordered with `#232332`. Active processing node features an animated SVG border dash keyed to `#00F0FF`.