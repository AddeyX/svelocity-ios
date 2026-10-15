# Native bindings

**Status:** intended design; no binding format or generator exists yet.

Swift and Apple frameworks define the available platform features. Expose those
features through Svelte components and typed functions. Full Swift capability
coverage is a direction, not an existing compatibility guarantee.

## Shared API descriptions

A binding description must capture the information needed by both TypeScript
declarations and Swift generation:

- Native types, enums, functions, and supported generic or protocol constraints.
- Views, initializers, modifiers, and child content.
- State bindings, callbacks, asynchronous operations, and concurrency constraints.
- Platform availability, minimum OS versions, and required native configuration.

Use the same descriptions for editor assistance, compatibility analysis, and code
generation. Do not infer support for a native API merely because its name appears
in a generated TypeScript declaration. Swift compilation remains authoritative
for native type checking.

## Boundaries and open questions

SwiftUI controls rendering. Browser DOM or CSS behavior is not implied by Svelte
syntax. Unsupported API shapes require diagnostics until a faithful mapping exists.

The description format, metadata extraction, overload handling, modifier syntax,
and two-way binding syntax remain open. Custom Swift modules are a candidate
extension mechanism; their exposure and configuration still need a decision.
See [ADR 0002](../adr/0002-use-native-api-bindings.md).
