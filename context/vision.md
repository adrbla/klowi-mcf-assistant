# Vision – klowi-mcf-assistant

## Purpose

AI coach assistant supporting Chloë Cottrell's preparation for university lecturer (MCF) auditions in British studies. The assistant pairs domain expertise (audition formats, COS members, dossiers, prep material) with a Socratic coaching mode, quiz/sparring mode, briefing mode, and feedback/review mode.

## Users / Audience

- **Primary user**: Chloë Cottrell (the candidate). French-speaking by default, fluent in English.
- **Maintainer / PO**: Adrien B. (vibe coder, orchestrating Claude Code).

The assistant is single-tenant — built for one specific user, not designed for multi-user scale.

## Expected outcomes

- Deployed web app, accessible via URL by Chloë.
- Working text chat interface with persistent conversations (chats / sessions, granularity TBD).
- A coach system prompt that captures the role, tone, modes, COS profiles, and audition-specific knowledge — drawn from the briefing material and the private prep corpus.
- A simple, forkable codebase the PO can keep iterating on after the immediate use case.

## Objectives

- Ship a deployed MVP usable for live audition prep.
- Encode the coach's behavior (Socratic by default, quiz on demand, briefing on demand, review on submission) faithfully enough to be useful from day one.
- Keep the architecture simple — single-tenant, single-user, no over-engineering.

## Non-objectives

- Voice (TTS/STT) — out of scope for v1, may revisit later.
- Multi-user / multi-tenant infrastructure.
- Fine-grained analytics or progression tracking.
- Generic academic assistant beyond MCF audition prep.

## Constraints

- Solo development (PO + Claude Code, no other dev).
- MVP-grade quality bar; ship over polish.
- Anthropic API costs — favor prompt caching where applicable.
- Private content (`mcf/` symlink → Google Drive): never commit, never deploy raw files, never expose to the client. The system prompt is assembled server-side from this material.

## Stage

**MVP**

Stage definitions:
- **Exploration** — Testing an idea. Throwaway code, minimal overhead, no tests required.
- **Foundation** — Setting up the real architecture. Structural decisions matter, discuss before acting.
- **MVP** — Building toward a first usable deliverable. Balance speed and quality. May include first deployment. ← *current*
- **Growth** — Product in service, adding features. Stability, tests, and robustness become priorities.
- **Maintenance** — Stable product. Focus on fixes, refactors, dependency upgrades.

Stage is a signal, not a constraint — it sets default expectations for rigor, testing, and documentation but can always be discussed.
