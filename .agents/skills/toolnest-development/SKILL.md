---
name: toolnest-development
description: Guide implementation of ToolNest features with consistent architecture and task reporting.
---

# ToolNest Development

Before work, read `AGENTS.md`, `docs/PROJECT_BLUEPRINT.md`, and relevant feature source. Keep the app account-only, light-themed, mobile-friendly. For every feature, identify whether processing runs in the browser or the restricted Python worker. Build the vertical slice, validate edge cases, test, and report gaps. Do not create OpenAPI artifacts. Keep code clean and small. Never call a feature production-ready merely because it renders.
