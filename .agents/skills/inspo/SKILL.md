---
name: inspo
description: >-
  Search real-world website designs, component patterns, palettes, design systems, and page flows
  using the Inspo MCP server. Use whenever designing, building, or refining web UI, selecting
  visual styles, typography ramps, or looking for high-quality production UI references.
---

# Inspo: Real-World Web Design & UI Inspiration

Inspo provides access to a curated archive of real-world website designs, design systems, component patterns, and page flows via the Inspo MCP server.

Use Inspo before and during UI development to ground interfaces in proven visual design, typography, spacing, and component architecture.

---

## Core MCP Tools & When to Use Them

### 1. `recommend` (Start Here for New UI)
Orchestrates design decisions from a high-level UI brief.
- **When to use**: Starting a new page, feature, or project.
- **Output**: Returns a macrostructure recommendation (e.g. `bento-grid`, `split-screen`), 5 real-world exemplars, matching reference components, and a color palette suggestion.

### 2. `search_screens`
Search the visual archive using natural language, style tags, and industry filters.
- **Filters**:
  - `style`: `minimalism`, `editorial`, `brutalism`, `glassmorphism`, `swiss`, `maximalism`, `playful`, `dark-mode`, `monochrome`, `vintage`, `futurist`
  - `industry`: `saas`, `developer-tools`, `ai`, `fintech`, `agency`, `consumer-tech`, `ecommerce`, `education`, `portfolio`, etc.
  - `macrostructure`: `bento-grid`, `canvas`, `cards-stack`, `carousel-focus`, `editorial-spread`, `hero-centric`, `split-screen`, `storytelling`, etc.

### 3. `get_design_system`
Retrieves a complete `DESIGN.md` for a captured site.
- **When to use**: You want to adopt a cohesive typography ramp, CSS variable tokens, color roles, and spacing hierarchy from a reference site.

### 4. `find_components` & `find_reference_components`
Find production examples of specific UI elements:
- Categories: `hero`, `nav`, `pricing`, `features`, `cta`, `footer`, `testimonial`, `logo-cloud`, `faq`, `stat`
- Use `get_reference_jsx` with the component ID to fetch clean, copy-pasteable canonical JSX.

### 5. `find_by_color`
Find sites using a specific brand or accent color using perceptual OKLAB distance.
- **When to use**: A design prompt specifies a primary hex color and you need complementary palette inspiration.

### 6. `get_site_pages`
Explore multi-page site architecture and page flow sequencing (e.g. Landing → Features → Pricing → Docs).

---

## Recommended Workflow

```
1. Brief Analysis ────► recommend(brief)
                            │
                            ▼
2. Architecture   ────► find_examples_for_macrostructure / search_screens
                            │
                            ▼
3. Design System  ────► get_design_system(slug) -> extract CSS tokens & fonts
                            │
                            ▼
4. Components     ────► find_reference_components / get_reference_jsx(type, id)
                            │
                            ▼
5. Implementation ────► Integrate into codebase with project-specific styling
```

---

## Configuration Reference

- **MCP Endpoint**: `https://inspomcp.dev/api/mcp` (Streamable HTTP)
- **Stdio Alternative**: `npx -y inspo-mcp`

