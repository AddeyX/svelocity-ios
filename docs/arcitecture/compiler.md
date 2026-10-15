# Compiler

**Status:** initial subset implemented in [analysis](../../src/analyze.ts),
[TypeScript checking](../../src/typecheck.ts), and [Swift generation](../../src/swift.ts).
The typed intermediate representation is in [types](../../src/types.ts).

The compiler runs under Node and emits Swift application logic and SwiftUI views.
Use Svelte parsing and TypeScript analysis as front-end tools. Svelte's normal web
output is not the native backend.

## Responsibilities

- Resolve components and reachable application imports; distinguish build-time
  execution from code that must ship in the application.
- Analyze supported expressions, functions, types, and reactive constructs using
  the same compatibility analyzer as the language tools.
- Lower validated behavior to a typed intermediate representation, preserving
  original source locations for diagnostics.
- Generate Swift state models, SwiftUI views, and native calls described by the
  [binding system](bindings.md). A small Swift library may provide shared behavior.
- Pass generated output to the Apple toolchain for native compilation and validation.

The `compile` command stops at source generation. The separate
[native harness](native.md) prepares the reference view and invokes Xcode to build
or test the demo apps; actual native execution is still unverified in this Linux task.

## Semantic contract

Support a defined subset of TypeScript and Svelte. Type annotations alone do not
make JavaScript behavior compatible with Swift. Specify value semantics, state
ownership, identity, derived values, bindings, effects, and asynchronous behavior
before claiming support. Diagnose unsupported constructs rather than changing
their meaning or introducing a JavaScript fallback.

Evaluate runtime imports by reachable supported behavior, not npm dependency
categories. Build plugins can execute in Node and supply generated inputs without
shipping their implementation. Browser APIs have no implicit native implementation.

## Validation and open questions

Eventually validate translation behavior, source diagnostics, and generated code,
then build and exercise representative apps on macOS with Xcode. Compare startup,
allocations, and UI updates with equivalent handwritten SwiftUI before making
performance claims.

The [README](../../README.md) lists the implemented subset. Broader language
semantics, a native support library, and application packaging remain open. See
[ADR 0001](../adr/0001-compile-to-swift.md) and the
[initial subset](../adr/0005-start-with-an-explicit-native-subset.md).
