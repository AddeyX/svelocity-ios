# 0001: Compile application logic to Swift

Status: Accepted
Date: 2026-10-15

## Context

Svelocity aims to provide native Apple UI and native execution while allowing
developers to author applications in Svelte and TypeScript.

## Decision

Compile supported application logic to Swift and render through SwiftUI, without
a JavaScript engine in the shipped application. Node may run compilation and
build tools. Determine runtime dependency compatibility from the behavior actually
used, not its npm dependency category.

## Consequences

Generated code uses the native toolchain and remains inspectable. JavaScript and
Svelte semantics need explicit mappings; unsupported behavior must produce errors.
Native execution does not establish performance parity without measurement.

## References

- [Compiler design](../arcitecture/compiler.md)
