# 0003: Share compatibility analysis across tools

Status: Accepted
Date: 2026-10-15

## Context

Developers need continuous feedback about incompatible Svelte, TypeScript, and
native API use. Builds must enforce the same compatibility contract.

## Decision

Use one compatibility analyzer for compilation, command-line checks, watch mode,
and the language server. A persistent project service checks the full project at
startup and affected dependencies after changes, reporting source diagnostics.

## Consequences

Editors and builds share semantic rules. The service must track dependencies and
invalidate stale results. Native compiler checks still require the Apple toolchain;
language server success alone does not prove native build success.

## References

- [Language tooling](../arcitecture/language.md)
