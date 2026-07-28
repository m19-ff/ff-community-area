# Phaser 2D Game Template — AI Development Rules 

## Core Architecture: Next.js + Isolated SOP (Kit-First)

This template is built on **Next.js (App Router)** and **Phaser 3**. Development must follow these engineering standards to ensure SSR safety and module isolation.

> [!CAUTION]
> **ESM Import Rule**: In the Next.js environment, the `phaser` package has no default export.
> ❌ `import Phaser from 'phaser';`
> ✅ `import * as Phaser from 'phaser';`

---

### Project Structure

```
src/
├── app/                    ← Next.js core (routing, layout, global styles)
│   ├── layout.tsx          ← Root layout (Metadata, Fonts)
│   ├── page.tsx            ← Game entry page
│   └── globals.css         ← Global styles (Rich Aesthetics)
│
├── components/             ← React components
│   └── GameWrapper.tsx     ← SSR-safe game wrapper (dynamic, ssr: false)
│
├── game/                   ← Phaser development zone (core logic)
│   ├── boot.ts             ← Game bootstrapper (config, scene registration)
│   ├── config.ts           ← Game config constants
│   ├── scenes/             ← Native scene classes
│   └── entities/           ← Physics entity classes
│
├── store/                  ← Zustand state management (useGameStore.ts)
├── ui/                     ← React HUD components (must include 'use client')
└── kit/                    ← Core toolkit (BaseScene, Input, Textures) ✅ Use first
```

---

## Skill System

> 🚨 **Mandatory**: Before any Phaser-related development, you must load the `native-phaser-gamedev` SKILL for routing guidance.

This template uses a **Hub + Specialized Skill** layered system:

| Skill | Responsibility | When to Load |
|-------|---------------|-------------|
| **`native-phaser-gamedev`** | **Hub Router** — Defines the 6-phase workflow and stage orchestration | Single entry point for any dev task |
| **`game-template-sop`** | **Template SOP** — Directory structure, Kit API usage, gotchas | When creating a new game or integrating Kit |
| **`assets-generate`** | **Pixel Asset Engine (Pixel Lab)** — 4/8-direction rotation, animation generation | When producing high-quality pixel assets |
| **`sprite-pipeline`** | **Sprite Pipeline** — Normalization, preview, sync to repo | When processing and syncing all visual assets |
| **`game-ui-frontend`** | **Game UI/HUD Design** — DOM overlay, motion effects, React patterns | When designing HUD or menu systems |
| **`game-playtest`** | **QA Testing** — Workflow, checklists, report standards | Pre-delivery validation |
| **`game-architecture`** | **Architecture Decisions** — Simulation/render separation, input mapping | When refactoring or designing complex systems |
| **`phaser-gamedev`** | **Phaser 3 API Reference** — General API guidance | When implementing specific logic details |

---

## 6-Phase Standard Development Workflow

Regardless of task size, you must identify which phase you are in:

1. **Phase 1: Setup (Project Skeleton)**
   - Use `game-template-sop`. Output a shell project with `boot.ts` and a blank canvas.
2. **Phase 2: Blueprint (Architecture Design)**
   - Use `game-architecture`. Define scenes, entity inventory, input mapping.
3. **Phase 3: Prototype (Core Gameplay)**
   - Use `phaser-gamedev`. **Kit-First** implementation of the core loop (placeholders allowed).
4. **Phase 4: Assets (Asset Production)**
   - Use `assets-generate` (Pixel Lab) + `sprite-pipeline`. Replace placeholders with high-quality normalized assets.
5. **Phase 5: Shell (UI & Menus)**
   - Use `game-ui-frontend`. Build React HUD, title menu, pause screen.
6. **Phase 6: QA (Testing & Validation)**
   - Use `game-playtest`. Execute checklist, ensure `npm run build` passes.

---

## Visual Quality Baseline

- **No colored blocks**: Raw unfinished placeholder images or crude color blocks are strictly forbidden in final delivery.
- **Asset-First**: All entities (characters, items, tiles, backgrounds) must be produced and normalized through `assets-generate` or `sprite-pipeline`. **Procedural drawing (ensureTexture) must not be used as the visual representation in production code.**
- **Quality mindset**: Phase 4 is a mandatory milestone — delivery is forbidden until assets are finalized.

---

## Golden Rules

1. **Kit-First Mandate**: 
   - ✅ Must extend `BaseScene` (from `@/kit/BaseScene`).
   - ✅ Must use `UnifiedInput` for input handling.
   - ✅ Must use `useGameStore` for Phaser-React state synchronization.
2. **Rendering Precision**:
   - `pixelArt: true`, `antialias: false`, `roundPixels: true`.
   - HiDPI adaptation: Refer to the DPR/Zoom approach in `game-template-sop`.
3. **SSR Safety**:
   - UI components must have `'use client';` at the top.
   - Game entry must use `next/dynamic` to disable SSR.
4. **🚀 Moving Platform Pattern**:
   - Must use **Dynamic** physics bodies with `immovable: true` and `allowGravity: false`.
   - Must be driven by **`body.setVelocity`**.

---

## References

- **Hub entry**: `native-phaser-gamedev` SKILL
- **Asset engine**: `assets-generate` SKILL
- **Asset sync**: `sprite-pipeline` SKILL
- **Core toolkit**: `src/kit/BaseScene.ts`, `src/kit/input.ts`
- **Default port**: `http://localhost:13000`
