# 0002: Expose native capabilities through shared API bindings

Status: Accepted
Date: 2026-10-15

## Context

The authoring model should expose Swift and SwiftUI capabilities through Svelte.
Browser behavior does not define the target platform.

## Decision

Describe native APIs in a shared binding model used for TypeScript declarations,
compatibility analysis, and Swift generation. Include native types, views,
modifiers, bindings, callbacks, and platform constraints.

## Consequences

Tooling and generation can agree on exposed capabilities. Full Swift coverage
requires deliberate mappings, including difficult type and concurrency features.
The binding representation and authoring syntax remain open.

## References

- [Native bindings](../arcitecture/bindings.md)
