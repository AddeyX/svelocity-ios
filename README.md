# svelocity-ios

An experimental compiler from a native subset of Svelte and TypeScript to SwiftUI.
Application logic becomes Swift; the shipped component needs no JavaScript engine.

## Develop

Requires Node 22 or newer. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run build
npm test
npm run svelocity -- check examples
npm run svelocity -- compile examples/Greeting.svelte --out generated/Greeting.swift
npm run svelocity -- check examples --watch
```

`check` returns 1 for incompatible code and 2 for invalid commands or filesystem
failures. `compile` writes only on success; an existing output is left unchanged
on failure. Generation does not run Xcode. Add the generated component to a native
app to display it; application packaging is not implemented yet.

## Current subset

See [Greeting.svelte](examples/Greeting.svelte) for an interactive example.

- Named native imports (including aliases) from `@svelocity/swiftui`, an intrinsic
  compiler module, not a separately installed npm package.
- `VStack`, `HStack`, `Text`, `Button`, and `Spacer`; numeric literal `spacing`,
  `minLength`, and `padding` where declared by the binding registry.
- String/Boolean literal constants, `let value = $state(literal)`, optional primitive
  type annotations, value references, Boolean negation, and state assignment actions.
- `{#if}` / `{:else if}` / `{:else}` with Boolean conditions. Text and button labels
  accept verbatim text and string/Boolean interpolation; whitespace is preserved.

Other constructs produce diagnostics. Runtime package imports, user components,
numeric state, effects, two-way bindings, CSS, DOM APIs, and routes are not supported.
Generated component names must begin with an uppercase ASCII letter; `--name`
overrides the filename. Target defaults are iOS 17 and macOS 14. Supplying `--ios`
and/or `--macos` selects only those platforms and minimum versions.

## Language server

Configure an LSP client for Svelte files to launch:

```sh
node /absolute/path/to/svelocity-ios/dist/src/language-server.js --stdio
```

It checks workspace files at startup, watches disk edits, and checks unsaved editor
changes through the same analyzer as the compiler. Optional initialization options:
`{"targets":[{"platform":"ios","minimumVersion":"17.0"}]}`. Completion, hover,
and symbol navigation are not implemented yet. Generate native TypeScript
declarations with `npm run svelocity -- bindings --out generated/native.d.ts`.

## Validation

`npm run check` checks the compiler's TypeScript. `npm test` covers generation,
unsupported constructs, source locations, CLI behavior, file watching, and the
language server over stdio. On macOS with Xcode, it also typechecks generated views
against the macOS and iOS Simulator SDKs; these two checks are skipped on Linux.
CI is configured for Linux and macOS. Native application behavior and performance
still need runtime validation.

[Architecture](docs/arcitecture/README.md) · [Decisions](docs/adr/README.md) · [Roadmap](docs/roadmap.md)
