# 0005: Start with an explicit native authoring subset

Status: Accepted
Date: 2026-10-15

## Context

The first compiler needs an executable contract shared by generation and live
diagnostics. Broad JavaScript or Swift coverage cannot be inferred from syntax.

## Decision

Start with Svelte 5 parsing and TypeScript analysis in a single Node package.
Import supported views from `@svelocity/swiftui`. Use attributes for native
initializer arguments and an explicit set of modifiers. Initially support string
and Boolean constants and `$state`, assignment actions, and conditional views.
Use Swift `String`, `Bool`, and view-owned `@State`; reject other script semantics.
Use native numeric literals only for layout arguments, avoiding an implicit
TypeScript-number conversion contract. Text is verbatim, without localization.

Provide shared source analysis through compilation, CLI watch mode, and language
server diagnostics. Default to iOS 17 and macOS 14, with explicit target overrides.

## Consequences

The first slice can produce interactive SwiftUI without a runtime bridge. Package
imports, component composition, richer types, effects, and routes remain unsupported
until implemented deliberately. The initial binding syntax is experimental.

## References

- [Compiler](../arcitecture/compiler.md)
- [Native bindings](../arcitecture/bindings.md)
- [Language tools](../arcitecture/language.md)
