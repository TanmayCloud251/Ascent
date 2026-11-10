# Implementation Plan — "Ascent": AI-Powered Project-First Coding Education Platform

## 1. Executive Summary & Core Rules

"Ascent" is a project-first, AI-driven computer science education platform where learners build real, production-grade applications screen-by-screen and component-by-component.

### Non-Negotiable Hard Rules
1. **Zero Mock Data & Zero Hardcoded Lessons**: All course syllabi, specifications, lessons, tasks, and evaluations are generated at runtime via structured Gemini API calls (`gemini-2.5-flash`).
2. **Deterministic Persistence**: Every project, screen, module, test result, and user code state is persisted using a swappable `StorageService` abstraction (default: `LocalStorageAdapter`). Refreshing the browser loses zero progress.
3. **Structured Outputs & Schema Validation**: All Gemini outputs use `responseMimeType: "application/json"` with JSON schemas and client/server Zod validation. If validation fails, the service retries once before surfacing a user-friendly error state with a "Retry" button.
4. **Near-Zero Operating Cost (Lazy + Caching)**: Syllabi and module contents are generated **only when the learner unlocks and opens that specific step**. Generated content is permanently cached in storage so no LLM call is ever repeated.
5. **Zero API Key UI**: API keys are handled securely server-side via `process.env.GEMINI_API_KEY`.
6. **Slice-by-Slice Delivery**: We are building **Slice 1 only** in this phase. Once Slice 1 is verified and approved, we proceed to Slices 2 through 6 sequentially.

---

## 2. System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    Ascent Client (React 19)                           |
|  +--------------------+  +----------------------+  +-------------------------------+  |
|  | Screen 1: Landing  |  | Screen 2: Spec Review|  | Global Profile & Session Nav |  |
|  | (Prompt + Stack)   |  | (Clarifications)     |  | (Active User Profile)         |  |
|  +---------+----------+  +-----------+----------+  +---------------+---------------+  |
|            |                         |                             |                  |
|            +-------------------------+-----------------------------+                  |
|                                      |                                                |
|                             [ AppContext & Hooks ]                                    |
|                                      |                                                |
|                   +------------------+------------------+                             |
|                   |                                     |                             |
|        [ StorageService (Interface) ]          [ llmService (Client) ]                |
|                   |                                     |                             |
|          LocalStorageAdapter                   POST /api/llm/* proxy                  |
|          (Swappable for Cloud/DB)                       |                             |
+---------------------------------------------------------|-----------------------------+
                                                          | HTTP
+---------------------------------------------------------v-----------------------------+
|                                  Express Backend (server.ts)                          |
|  - POST /api/llm/generate-spec (Gemini 2.5 Flash, structured schema + retry)           |
|  - Rate-limiting, structured Pino/Winston logging, server-side GEMINI_API_KEY auth     |
+---------------------------------------------------------------------------------------+
```

---

## 3. Data Models & Schemas

### TypeScript Interfaces & Zod Validation (`src/types/ascent.ts`)

```typescript
export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatarSeed: string;
  tier: 'tier1' | 'tier2' | 'tier3'; // guided | architectural | autonomous
  streakDays: number;
  lastActive: string; // ISO date
  createdProjectsCount: number;
}

export interface ProjectSpec {
  appName: string;
  tagline: string;
  summary: string;
  targetAudience: string;
  primaryFeatures: string[];
  techStack: {
    runtime: 'React 19' | 'Vanilla DOM';
    styling: string;
    stateManagement: string;
    backendSim: string;
  };
  architectureHighlights: string[];
  clarifyingQuestions?: {
    id: string;
    question: string;
    options: string[];
    selectedAnswer?: string;
  }[];
}

export interface ScreenPlanItem {
  id: string;
  order: number;
  screenName: string;
  description: string;
  estimatedModulesCount: number;
  keyComponents: string[];
  status: 'locked' | 'active' | 'done';
}

export interface Project {
  id: string;
  userId: string;
  userPrompt: string;
  spec: ProjectSpec;
  screens: ScreenPlanItem[];
  currentScreenIndex: number;
  status: 'draft_spec' | 'spec_confirmed' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ModuleCheck {
  id: string;
  description: string;
  codeSnippetTarget?: string;
}

export interface Module {
  id: string;
  screenId: string;
  order: number;
  title: string;
  conceptSummary: string; // 2-3 short conceptual sentences
  taskInstructions: string; // What the learner must build
  targetFile: string; // e.g. "src/components/StatsCard.tsx"
  starterCode: string; // Runnable code with // TODO: ASCENT_TASK [Step X]
  solutionCode?: string; // Stored securely for tutor validation
  checks: ModuleCheck[];
  hints: string[]; // Progressive reveals
  status: 'locked' | 'unlocked' | 'in_progress' | 'passed';
  userCode: string;
}

export interface ProjectMemory {
  projectId: string;
  fileTree: string[];
  techStack: string;
  namingConventions: string[];
  decisionsMade: string[];
}
```

---

## 4. Storage Abstraction Layer (`src/services/storageService.ts`)

To allow future database migration without rewriting UI or business logic, all reads and writes flow through a unified `StorageService` interface:

```typescript
export interface StorageService {
  // User Profile
  getCurrentUser(): UserProfile;
  saveCurrentUser(user: UserProfile): void;

  // Projects
  getProjects(userId: string): Project[];
  getProjectById(projectId: string): Project | null;
  saveProject(project: Project): void;
  deleteProject(projectId: string): void;

  // Project Memory & Cache
  getProjectMemory(projectId: string): ProjectMemory | null;
  saveProjectMemory(memory: ProjectMemory): void;
  getCachedLLMResponse<T>(cacheKey: string): T | null;
  setCachedLLMResponse<T>(cacheKey: string, data: T): void;
}
```

**Implementation (`LocalStorageAdapter`)**:
- Uses prefixed keys (`ascent_v2:user`, `ascent_v2:projects`, `ascent_v2:cache:*`).
- Validates JSON parse safely.
- Auto-initializes an instant guest developer profile: `"Lead Developer" (@builder)` with Tier 2 ("Architectural guidance").
- Full export / import utility for student data backup.

---

## 5. Scope of Slice 1 (Current Target)

### Objective
Deliver a functioning, zero-mock, persistent onboarding and specification creation pipeline:
1. **User Profile & Persistence Initialization**: Instant guest profile with seamless storage persistence.
2. **Screen 1: Landing & Idea Prompt (`LandingPrompt.tsx`)**:
   - Clean dark cyberpunk terminal aesthetic (`#0A0A0F`, `#00F0FF`, monospace font, high-contrast typography).
   - "What do you want to build?" prompt with quick clickable starter ideas (e.g. *SaaS AI Analytics Platform*, *Real-Time Collaborative Canvas*, *Developer Terminal Portfolio*, *Fintech Wealth Tracker*).
   - Tech stack toggles (React 19 vs Vanilla DOM; Tailwind CSS v4; Zustand/State; TypeScript).
   - Form submission invokes `/api/llm/generate-spec` with real Gemini structured outputs.
3. **Screen 2: Interactive Spec Review (`SpecReview.tsx`)**:
   - Displays real Gemini-generated project specification (`appName`, `summary`, `targetAudience`, `primaryFeatures`, `techStack`, `architectureHighlights`).
   - Interactive clarifying questions generated by Gemini for ambiguous project aspects (e.g. "Should authentication require OAuth or email magic links?").
   - Learners can answer/customize questions or regenerate with tweaks.
   - "Confirm Spec & Save Project" action: Persists the project to `StorageService` and unlocks the transition to Slice 2.
4. **Backend LLM Endpoint (`server.ts` & `src/services/llmService.ts`)**:
   - `POST /api/llm/generate-spec` invoking `gemini-2.5-flash` with strict JSON schema:
     ```json
     {
       "appName": "string",
       "tagline": "string",
       "summary": "string",
       "targetAudience": "string",
       "primaryFeatures": ["string"],
       "techStack": { "runtime": "string", "styling": "string", "stateManagement": "string", "backendSim": "string" },
       "architectureHighlights": ["string"],
       "clarifyingQuestions": [
         { "id": "string", "question": "string", "options": ["string"] }
       ]
     }
     ```
   - Auto-retry on schema failure.
   - Error banner with actionable "Retry Generation" on network or quota failure.
   - Client-side caching of generated specs to avoid redundant API charges.

---

## 6. Slices 2–6 Roadmap (Future Phases)

*Note: Work on Slices 2–6 will only start after Slice 1 is verified and approved.*

- **Slice 2: Screen Plan & Syllabus Generation (`generateScreenPlan` & `generateSyllabus`)**:
  - Breakdown of the project into 4–6 ordered visual screens.
  - Project Overview hub showing active roadmap, screen cards, and syllabus status.
- **Slice 3: Modular IDE Workspace (`generateModuleContent`)**:
  - Live Monaco/CodeMirror code editor with starter files.
  - Socratic short lesson and clear task directives.
  - Sandboxed Babel live preview with Tailwind rendering and virtual module resolution.
- **Slice 4: Pedagogical Validation & Socratic Mentor**:
  - AST / regex check runner + Gemini `reviewSubmission` for deep code analysis.
  - Progressive hint drawer with points/energy model.
  - Updating `ProjectMemory` with learner decisions and exportable files.
- **Slice 5: Screen Completion Flow & Next Screen Generation**:
  - Screen celebratory summary modal.
  - Contextual prompt feeding previous code files into next screen syllabus generation.
- **Slice 6: Long-Term Roadmap & Learner Activity**:
  - Streak tracker, contribution heatmap, and one-click GitHub / ZIP project exporter.

---

## 7. Verification & Acceptance Criteria for Slice 1

1. **Storage Persistence**:
   - Creating a project on Screen 1 and navigating to Screen 2 persists the project in `StorageService`.
   - Refreshing the browser on Screen 2 retains all generated spec fields, user selections, and profile state.
2. **Gemini Live Integration**:
   - Submitting an arbitrary custom prompt (e.g. *"A decentralized solar energy trading marketplace for microgrids"*) calls Gemini and produces a tailored, specific spec with relevant features and architecture highlights.
   - No mock data fallbacks used; genuine error handling with a retry button on network issues.
3. **Spec Clarifications**:
   - Learners can toggle options for the clarifying questions, and confirming the spec locks the finalized spec into project state.
4. **Code Quality & Build Health**:
   - `compile_applet` and `lint_applet` pass with 0 TypeScript/ESLint errors.
   - Strict CSS/Tailwind design tokens adherence.

---

*Awaiting your feedback and confirmation to proceed with the implementation of Slice 1.*
