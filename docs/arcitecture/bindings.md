# Native bindings

**Status:** an initial [TypeScript registry](../../src/bindings.ts) drives native
validation, Swift calls, and generated authoring declarations. An external binding
format and metadata extraction are not implemented.

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

The first bindings cover stacks, text, buttons, and spacers. Attributes map to
declared initializer parameters or the `padding` modifier. Labels accept verbatim
text and string/Boolean expressions. See the registry for exact availability and
arguments; `@svelocity/swiftui` is an intrinsic import, not a published npm module.

The external format, metadata extraction, overloads, richer modifiers, and two-way
bindings remain open. Custom Swift modules are a candidate extension mechanism.
See [ADR 0002](../adr/0002-use-native-api-bindings.md) and the
[initial subset](../adr/0005-start-with-an-explicit-native-subset.md).
