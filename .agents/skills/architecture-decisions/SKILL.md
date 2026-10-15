---
name: architecture-decisions
description: Use when a task proposes, makes, implements, or revises an architectural decision about platform/runtime strategy, language semantics, subsystem boundaries, native bindings, routing contracts, or public interfaces. Record or update a concise ADR as part of that work. Routine fixes and internal refactors do not trigger this skill.
---

# Record an architectural decision

Use repository-root-relative paths below. Follow `AGENTS.md` and read
`docs/adr/README.md` for the template and decision index.

1. Read the design note and existing ADRs relevant to the decision. Inspect related
   code and tests when they exist; do not treat intended design as implemented.
2. Identify the actual choice, its reason, and its main consequences. An ADR is
   needed for a new or changed architectural contract, not every implementation
   detail. If an existing ADR already covers an unchanged choice, reference it
   instead of creating a duplicate.
3. Use `Accepted` when the choice is made within the authorized task. Use `Proposed`
   for an unresolved proposal, and keep open alternatives explicit. Ask only when
   missing information or authority blocks the work; do not add an approval gate
   merely because an ADR is needed.
4. Inspect existing filenames and choose the next unused four-digit number. Write
   `docs/adr/NNNN-short-title.md` using the README template. Keep one high-level
   decision per file, with short context, decision, consequences, and references.
   Do not include implementation plans, speculative guarantees, or task transcripts.
5. If replacing an accepted choice, create a new ADR that links to the old one.
   Mark the old record `Superseded` and add a link to its replacement, preserving
   the original context and rationale. Keep implementation status separate from
   decision status.
6. Update `docs/adr/README.md` and affected `docs/arcitecture/` notes in the same
   change. Include code changes only when the user's task authorizes them.
7. Check numbering, statuses, links, and agreement with the actual change. Report
   which ADR was added or superseded and any remaining uncertainty.

The initial accepted ADRs record the project architecture discussion. Future ADRs
must record decisions actually made, not invent agreement or supported features.
