# RoadForge Professional 60-Second Demonstration Production Report

This report documents the architectural redesign, automation pipeline, visual composition decisions, and quality verification for the RoadForge v0.2.0 master product demonstration video, preview GIF, and high-resolution thumbnail.

---

## 1. Production Overview

### Narrative
The demonstration communicates one core idea: **RoadForge transforms an idea into a structured, actionable development roadmap.**

Rather than a generic feature walkthrough or sped-up screen capture, the video presents a purposeful 60-second narrative in five acts:
1. **Act 1: The Idea (0.0s - 6.5s)**: Starting from the landing page, the user initiates roadmap creation, specifies the project title "Launching a Developer Tool", selects the blank template, and enters the workspace.
2. **Act 2: Structure (6.5s - 10.8s)**: Demonstrates genuine phase creation across all four lifecycle milestones: Planning, Development, Testing, and Release. The input replaces temporary placeholder text immediately upon typing.
3. **Act 3: Tasks and Subtasks (10.8s - 35.7s)**: Populates realistic engineering tasks across all phases, adds subtasks to core deliverables, marks milestones complete, and illustrates realtime progress updates.
4. **Act 4: Intelligence and Progress (35.7s - 48.7s)**: Demonstrates task complexity configuration (High/Low), tag taxonomy ("Core", "Engine", "Docs"), rich Markdown architecture principles, dependency linking with automated cycle prevention, amber "Blocked" indicator alerts, and automatic blocker clearance upon prerequisite completion.
5. **Act 5: The Result (48.7s - 59.8s)**: Highlights portable export capabilities (JSON and Markdown), provides a smooth overview of the fully organized 4-phase project, and concludes with a steady, restrained hold on the completed roadmap.

### Storyboard and Scene Timings

| Act | Scene | Timestamp Range | Cumulative Duration | Key Visual Actions |
|---|---|---|---|---|
| Act 1 | Hero & Roadmap Wizard | 0.00s - 6.55s | 6.55s | CTA click, title entry ("Launching a Developer Tool"), "Start simple" template selection |
| Act 2 | Multi-Phase Structure | 6.55s - 10.78s | 4.23s | Phase creation: Development, Testing, Release; Expand All columns |
| Act 3 | Deliverables & Subtasks | 10.78s - 35.72s | 24.94s | Task generation across all 4 phases, subtask breakdowns, subtask checkoffs with progress rings |
| Act 4 | Metadata & Dependencies | 35.72s - 48.66s | 12.94s | Complexity, tags, markdown notes, dependency link, blocked status, prerequisite completion unblock |
| Act 5 | Showcase & Beauty Hold | 48.66s - 59.77s | 11.11s | Export dialog inspection, smooth overview pan, steady beauty hold on complete roadmap |

**Total Master Duration:** 59.77 seconds (meets the 55-65 second requirement).

### Editing Decisions
- **Restrained Cursor**: Eliminated the legacy glowing orange circle. Replaced with a crisp SVG vector pointer (white fill, dark slate stroke, subtle drop shadow) paired with a gentle click ripple ring that radiates outward on mouse down.
- **Brisk Pacing**: Replaced sluggish 40-50ms character typing with 10-16ms purposeful typing, eliminating repetitive dead time while maintaining clear legibility.
- **Controlled Holds**: Kept pauses between 150ms and 500ms following key interactions so the eye can easily register status updates, progress rings, and badge transformations without visual lag.
- **Deliberate Ending**: Dedicated the final 5.2 seconds to a clean, unobstructed showcase of the complete four-phase roadmap.

---

## 2. Technical Details

### Viewport and HiDPI Rasterization
The previous recording ran in a standard 1920x1080 viewport where the 1080px workspace column occupied only 52.9% of the frame, leaving 447px of empty margin on each side and rendering 14px body text unreadable in embedded previews.

To solve this without artificial post-production upscaling:
- **Logical Viewport**: 1440x810 (16:9 aspect ratio).
- **Device Scale Factor**: 1.33333333 (HiDPI scaling factor: 1440 * 4/3 = 1920, 810 * 4/3 = 1080).
- **Physical Canvas**: Native 1920x1080 rendered directly by Blink/Chromium vector pipelines.
- **Horizontal Occupancy**: The roadmap column occupies 70.6% of the screen width (1354.7px physical width), striking an ideal balance between prominent roadmap focus and comfortable dark-theme canvas margins (276px on each side).
- **Text Legibility**: Text and UI controls are effectively 33% larger, ensuring every label, tag chip, and progress indicator remains crisp when scaled down to 800px width in GitHub README views.

### Master MP4 Encoding Specification

| Property | Target Specification | Actual Measured Value | Compliance |
|---|---|---|---|
| Duration | 55.0 - 65.0 seconds | 59.77 seconds | PASS |
| Dimensions | 1920x1080 | 1920x1080 | PASS |
| Aspect Ratio | 16:9 | 16:9 | PASS |
| Frame Rate | 30.0 FPS | 30.0 FPS (30/1) | PASS |
| Video Codec | H.264 (AVC) | H.264 High Profile (avc1) | PASS |
| Pixel Format | yuv420p | yuv420p | PASS |
| Bitrate | Quality-driven CRF | 668 kbps | PASS |
| File Size | High quality, reasonable size | 4.76 MB (4,996,281 bytes) | PASS |
| Fast Start | Moov atom at file start | Verified (moov atom at byte 36) | PASS |

### Preview GIF Specification

| Property | Target Specification | Actual Measured Value | Compliance |
|---|---|---|---|
| Dimensions | Approx 800x450 | 800x450 | PASS |
| Duration | 8.0 - 12.0 seconds | 9.00 seconds | PASS |
| Frame Rate | 10 - 12 FPS | 12.0 FPS | PASS |
| Palette Optimization | Lanczos scale + two-pass palettegen | 128 colors, Bayer dithering | PASS |
| File Size | Under 4.5 MB | 1.54 MB (1,614,132 bytes) | PASS |
| Content | High-impact intelligence highlight | Dependency linking, Blocked badge, unblocking | PASS |

### Thumbnail Specification

| Property | Target Specification | Actual Measured Value | Compliance |
|---|---|---|---|
| Dimensions | 1920x1080 | 1920x1080 | PASS |
| Format | PNG | PNG (8-bit/color RGB) | PASS |
| Timestamp | Completed beauty hold | Extracted at 56.5s | PASS |
| File Size | Sharp high-resolution frame | 285.2 KB | PASS |

---

## 3. Quality Verification and Assertions

### Pre-Recording and In-Flight Assertions
The automation script executes programmatic assertions during execution:
1. **Phase Creation Assertion**: Confirmed exact text matching for each newly created phase (`Development`, `Testing`, `Release`). Verified that the input field replaced the initial `New phase` placeholder cleanly without concatenation.
2. **All Phases Assertion**: Verified array equality against `['Planning', 'Development', 'Testing', 'Release']`.
3. **Console Log Auditing**: Captured browser console events. Confirmed zero JavaScript runtime exceptions.
4. **State Transitions**: Validated that linking "Publish initial release candidate" to "Run Playwright end-to-end tests" produced the expected amber Blocked indicator, and completing the prerequisite task cleared the blocked state in real time.

### Playback and Readability Inspection
- Frame captures across all acts (3s, 8s, 12s, 25s, 42s, 50s, 56s) were extracted and inspected.
- Verified that text contrast complies with Anvilary design tokens.
- No address bars, browser developer tools, debug overlays, or personal credentials are recorded.
- Visual pacing allows viewers to follow each mouse interaction and read task descriptions comfortably.

---

## 4. Reproducibility

The production workflow is modularized into two distinct stages and driven by a top-level orchestrator:

1. **Stage 1: Authentic Automation (`tools/demo/record-demo-raw.mjs`)**:
   - Locates an available ephemeral port.
   - Spawns the standalone production server (`apps/frontend/scripts/serve-standalone.mjs`).
   - Launches headless Chromium via Playwright at 1440x810 with DPR 1.33333333.
   - Injects custom SVG cursor styling.
   - Executes the scripted user actions and assertions.
   - Records raw WebM footage and outputs `scene-manifest.json`.

2. **Stage 2: Postproduction Assembly (`tools/demo/assemble-demo.mjs`)**:
   - Transcodes raw video to master MP4 (1920x1080 30FPS H.264, CRF 18, Fast Start).
   - Extracts the 1920x1080 PNG thumbnail from the beauty hold scene.
   - Generates the 800x450 looping preview GIF with two-pass palette optimization.
   - Runs `ffprobe` validation across all outputs.

3. **Master Entrypoint (`tools/demo/produce-demo.mjs`)**:
   - Can be run end-to-end with:
     ```bash
     node tools/demo/produce-demo.mjs
     ```
   - Alternatively, `node tools/demo/record-demo.mjs` delegates directly to this pipeline.

### Prerequisites
- Node.js >= 22
- pnpm 9.15.9
- ffmpeg >= 6.0 and ffprobe
- Chromium (installed via `@playwright/test`)

---

## 5. Environment Isolation and Git Details

### Worktree Isolation
To prevent any interference with concurrent work (specifically the public roadmap viewer on `feat/public-roadmap-embed`), this work was completed in a dedicated Git worktree:
- **Worktree Path**: `/home/alteixeira20/Projects/Anvilary-Tools/RoadForge-demo`
- **Feature Branch**: `feat/professional-product-demo`
- **Starting Revision**: `1face3fb53bd00c6933f85dd3fb5dd75ad670e15` (on `main`)
- **Server Ports**: Ephemeral port selection via `availablePort()`; no collisions with active developer instances.
- **Data Boundary**: Disposable browser sessions; no persistent server databases or user tokens modified.

### Artifacts Delivered
- `docs/media/roadforge-product-demo.mp4` (Master 59.8s video)
- `docs/media/roadforge-demo-preview.gif` (9.0s 800x450 looping preview)
- `docs/media/roadforge-demo-thumbnail.png` (1920x1080 showcase frame)
- `tools/demo/record-demo-raw.mjs` (Isolated Playwright capture script)
- `tools/demo/assemble-demo.mjs` (FFmpeg transcode and asset pipeline)
- `tools/demo/produce-demo.mjs` (Master orchestration script)
- `tools/demo/record-demo.mjs` (Forwarding entrypoint)
- `docs/architecture/roadforge-professional-demo-production-report.md` (Production documentation)
