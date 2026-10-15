# Architecture

Svelocity lets developers author native Apple applications using Svelte and
TypeScript. Swift and SwiftUI define the platform capabilities exposed to that
authoring language. Native performance is the goal; measurements must establish it.

**Status:** intended design. The repository currently has no compiler, native
support library, language server, or application. Code and tests will establish
what actually works. These notes describe boundaries, not an implementation spec.

```text
Svelte + TypeScript + native API descriptions + route files
                         |
              Parsing and type analysis
                         |
            Shared compatibility analysis <--- CLI / watcher / language server
                         |
             Typed intermediate representation
                         |
                Swift / SwiftUI generation
                         |
          Apple toolchain + Swift support library
```

Node hosts compilation and build tools. Shipped application logic executes as
Swift, without a JavaScript engine. SwiftUI owns rendering and view updates.

- [Compiler](compiler.md): supported semantics, reactivity, intermediate representation, generation.
- [Bindings](bindings.md): exposing Swift APIs and platform constraints.
- [Language tooling](language.md): continuous analysis and editor feedback.
- [Routing](routing.md): folders, typed routes, and native presentation.
- [ADRs](../adr/README.md): high-level decisions and their rationale.

Still open: initial language coverage, binding format, modifier and binding syntax,
tool versions, deployment targets, and native navigation presentation conventions.
Decide these when implementation requires them, recording material choices in ADRs.
