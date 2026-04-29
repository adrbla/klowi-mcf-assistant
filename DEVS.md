# DEVS.md – Working with Claude & context files

> **Solo mode**: this project is currently developed by a single person (Adrien) acting as both PO and developer, paired with Claude Code. The workflow below still applies — it's lightweight enough for solo and keeps a clean trail for the day a second contributor joins.

## 1. What this is for

This project uses the **Nexus** — a lightweight set of context files (`CLAUDE.md`, `DEVS.md`, `context/*.md`) that give AI assistants and humans a shared, persistent view of the project: vision, decisions, backlog, and session history.

This project is set up so that:

- You can use AI (Claude Code, Cursor, Kiro, etc.) as a **pair programmer**.
- The project's **state and decisions** live in a small set of text files (`context/…`) that stay in sync with the work.
- As a developer, you **do not have to write documentation by hand**: the assistant drafts it, you review.

Goal: a PO (or future contributor) can open the repo at any time, load it into an AI coding assistant, and immediately understand what happened recently, which decisions were made, and what's currently in the backlog.

***

## 2. The files that matter

- `CLAUDE.md` — Instructions for the AI assistant (role, stack, constraints, links to context files).
- `context/vision.md` — Why this project exists, for whom, main constraints.
- `context/journal.md` — Narrative session log in **reverse chronological order** (newest entry first). The "what happened" record.
- `context/decisions.md` — Important architectural/product decisions extracted from the journal. The "why we chose this" record.
- `context/backlog.md` — Now / Next / Later list of tasks and ideas.
- `context/tech-stack.md` — Languages, frameworks, tools, conventions. Auto-generated on first session, kept up to date by the assistant.
- `context/architecture.md` — High-level shape and open architectural questions.
- `context/references/CONTEXT-COACH.md` — Initial coach briefing; starting point for the system prompt design (not the final prompt).

`context/vision.md` declares a **project stage** (Exploration → Foundation → MVP → Growth → Maintenance) that sets default expectations for rigor, testing, and documentation. The stage evolves; propose an update in a journal entry when the project moves to the next phase.

You are not expected to maintain these manually. Instead, you use the assistant to generate updates at the right times.

***

## 3. How it works in practice

### At the start of a dev session

1. Pull the latest changes.
2. Skim, in order:
   - `CLAUDE.md`
   - Last one or two entries in `context/journal.md`
   - Recent items in `context/decisions.md`
   - The "Now" section in `context/backlog.md`
3. Open Claude Code in the project root and give it a first message.

   **First session** (`tech-stack.md` is still a placeholder):

   > "You're working in the klowi-mcf-assistant repo. Read `CLAUDE.md`, then `context/vision.md`, `context/journal.md`, `context/decisions.md`, and `context/backlog.md`. This is your first session — follow the 'First session on this project' workflow in `CLAUDE.md`."

   **Subsequent sessions**:

   > "You're working in this repo. Read `CLAUDE.md`, then `context/vision.md`, `context/journal.md` (latest entry), `context/decisions.md`, and `context/backlog.md`. Summarize the current state in a few bullets and propose 2–3 concrete tasks from the Now backlog for this session."

This gives you a quick mental model and a suggested plan.

***

### During the session

Use the assistant as you normally would:

- Ask for help designing or implementing features.
- Get code suggestions, refactors, tests, etc.
- Discuss trade-offs before bigger architecture or product decisions.

You are not required to touch the context files while coding. The structured step is at the end.

***

### At the end of a session: "close the loop"

When you reach a meaningful stopping point (feature implemented, spike done, decision made), run a **meta-prompt** to update the context files.

Reusable prompt:

> "We're wrapping up this dev session. Based on our conversation and the changes we made, do the following:
> 1) Prepend a new section at the top of `context/journal.md` (below the title) summarizing what we did, what changed, and any risks or open questions for the PO.
> 2) If we made any real decisions, add or update entries in `context/decisions.md` (date, context, decision, alternatives, consequences).
> 3) Update `context/backlog.md`: mark what's done in Now, and add or adjust Now/Next/Later tasks for follow-up work.
> 4) If there are open questions for someone not present (PO or a future dev), add an 'Open questions' section to the journal entry, tagged by audience.
> Show me the exact edits you propose for each file so I can review."

Then:
- The assistant drafts the new sections / changes.
- You skim them, tweak if needed, and apply them.

This way:
- `journal.md` stays a narrative of what actually happened.
- `decisions.md` tracks the important choices.
- `backlog.md` reflects the real state of work.

If the project has a deployment target, deploy after the context updates are committed. Push to GitHub last (always after context files are up to date).

***

## 4. Guidelines and expectations

- **You are not the documentation writer.**  
  Trigger the meta-prompt at the end of a session, sanity-check the generated updates, commit them with your code.

- **Be honest in the journal.**  
  Include what you tried, what worked / didn't, unknowns or technical risks worth surfacing.

- **Keep decisions meaningful.**  
  Only record decisions that matter (API design, architecture, libraries, trade-offs that might be revisited).  
  You can ask the assistant: "From this journal entry, is there any decision worth adding to `context/decisions.md`?"

- **Let the backlog stay high-level.**  
  Not every micro-task needs to be tracked. Focus on features, follow-ups, debt, and experiments.

- **Privacy.**  
  `mcf/` is a symlink to private Google Drive content. Never include raw `_prep/` content in client-side bundles, never push it to the remote, never quote large excerpts in committed prompts.

***

## 5. Example end-of-session flow

1. You finish wiring the streaming chat endpoint and commit your changes.
2. You tell the assistant:

   > "We just wired the streaming chat endpoint with server-side system prompt assembly (static concat for now). Draft updates for `context/journal.md`, `context/decisions.md`, and `context/backlog.md` per the project workflow."

3. The assistant outputs:
   - A new journal section describing what happened and any open questions (e.g. "prompt caching not wired yet").
   - A decision entry (e.g. "static concat chosen over RAG for v1, alternatives noted").
   - Backlog edits (mark "streaming endpoint" done, add "wire prompt caching" and "tighten error handling" tasks).
4. You review, adjust if something is wrong, and apply.

The PO can later open the repo, read those files, and immediately understand what shipped and what remains.

***

If anything in this workflow feels heavy or unclear in day-to-day usage, note it in a journal entry so we can adjust the prompts and expectations.
