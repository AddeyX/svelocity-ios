# Folder routing

**Status:** folder-based routing is decided; exact file conventions and native
presentation rules are still proposed. No router is implemented yet.

Derive routes from a folder tree and generate typed route identities, parameters,
and native destinations. This is an application navigation model; it does not
require a browser, DOM, or web server.

An illustrative convention, not yet a supported file format:

```text
src/routes/
  +layout.svelte
  +page.svelte
  settings/
    +page.svelte
  projects/
    [id]/
      +page.svelte
```

## Boundaries and open questions

Use SwiftUI navigation structures for native presentation. A folder hierarchy
defines destinations and nesting; it cannot alone choose between stacks, sheets,
tabs, and split views. Presentation declarations and platform differences need
explicit rules.

File names, parameter types, layout ownership, route state preservation, deep
links, and presentation configuration remain open. Future checks must cover route
generation and actual native navigation behavior.
See [ADR 0004](../adr/0004-use-folder-routing.md).
