@AGENTS.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**NPR Dashboard**

A visual, deal-centric dashboard for Carrie Davis (COO of UTS/STM) that unifies five deal tracks — Title, Lending, Deal Desk, Consulting, Partnership — into one view. Every screen is built around the two questions Carrie answers all day: *where is this file?* and *whose turn is next?* The dashboard is the source of truth for stage, people-on-file, and tasks; it pulls signals from Gmail, ClickUp, and GHL without attempting two-way sync; and it lets Carrie trigger templated follow-up emails (with optional "polish in Mike's voice" via Anthropic API) directly from each file.

**Core Value:** **Carrie can glance at the dashboard and know within 5 seconds what needs her attention today.**

That's the one thing that must work. Everything else — integrations, LLM polish, ClickUp seed import, Kanban views — serves this core.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
