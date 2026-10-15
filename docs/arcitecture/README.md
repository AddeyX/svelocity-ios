# Architecture

Svelocity lets developers author native Apple applications using Svelte and
TypeScript. Swift and SwiftUI define the platform capabilities exposed to that
authoring language. Native performance is the goal; measurements must establish it.

**Status:** a first compiler slice, CLI watcher, and language-server diagnostics
are implemented. Native application hosts, routing, component composition, and
broader language support remain planned. Code and tests establish actual support;
these notes describe boundaries rather than an implementation spec.

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
              Apple toolchain (external)
```

Node hosts compilation and build tools. Shipped application logic executes as
Swift, without a JavaScript engine. SwiftUI owns rendering and view updates.

- [Compiler](compiler.md): supported semantics, reactivity, intermediate representation, generation.
- [Bindings](bindings.md): exposing Swift APIs and platform constraints.
- [Language tooling](language.md): continuous analysis and editor feedback.
- [Routing](routing.md): folders, typed routes, and native presentation.
- [ADRs](../adr/README.md): high-level decisions and their rationale.

The [initial subset decision](../adr/0005-start-with-an-explicit-native-subset.md)
defines the first authoring contract. Still open: broader language semantics,
external binding format, richer modifier and binding syntax, native extension
modules, and navigation presentation. Record material choices in ADRs as needed.
