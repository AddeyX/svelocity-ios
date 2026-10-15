# Architecture decision records

ADRs record high-level choices and their rationale. Current design belongs in
[architecture notes](../arcitecture/README.md); implemented behavior belongs in
code and tests. Accepted decisions may precede implementation.

## Decisions

- [0001: Compile application logic to Swift](0001-compile-to-swift.md)
- [0002: Expose native capabilities through shared API bindings](0002-use-native-api-bindings.md)
- [0003: Share compatibility analysis across tools](0003-share-compatibility-analysis.md)
- [0004: Derive routes from folders](0004-use-folder-routing.md)

## When to write one

Use the [architecture decision skill](../../.agents/skills/architecture-decisions/SKILL.md)
when choosing or changing platform/runtime strategy, language semantics, subsystem
boundaries, or public contracts. Routine fixes and internal refactors do not need
ADRs. Record one decision per file and keep it short; do not copy implementation
plans, task logs, or API reference material into it.

Choose the next unused four-digit number and a descriptive filename. Use statuses
`Proposed`, `Accepted`, `Rejected`, or `Superseded`. A decision made within an
authorized task can be accepted without a separate approval ceremony. Leave
unresolved alternatives proposed; do not imply agreement that has not occurred.

```markdown
# NNNN: Decision title

Status: Proposed | Accepted | Rejected | Superseded
Date: YYYY-MM-DD

## Context
The problem and relevant constraints.

## Decision
The chosen direction, or the proposal if undecided, and why.

## Consequences
The main benefits, costs, and remaining limitations.

## References
Relevant design notes, code, or related ADRs.
```

When reversing an accepted decision, add a new ADR. Mark the old one superseded
and link both records without rewriting the old rationale. Add new records to the
index above and update affected design notes in the same change.
