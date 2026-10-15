# Language server and continuous checking

**Status:** intended design; no project service or language server exists yet.

A persistent project service watches source, configuration, routes, and binding
descriptions. It checks the whole project at startup, maintains the dependency
graph, and rechecks affected files and dependents after edits. Clear stale
diagnostics when files change or disappear.

## One analysis engine

The compiler, command-line checker, watcher, and language server use the same
compatibility rules. The language server exposes diagnostics, completion, hover,
and navigation to editors. Command-line watch mode provides continuous feedback
without an editor; ordinary builds also enforce compatibility.

Diagnostics should identify the source location, the unsupported behavior, and a
possible supported alternative. Examples include browser DOM access, unsupported
JavaScript constructs, invalid native arguments, and APIs unavailable for a
configured platform or minimum OS version.

## Validation boundary

Fast source analysis does not replace Swift compilation. Report native compiler
errors separately and map them back to authored source where possible. Do not
claim a successful source check proves that the generated app builds or runs.

The editor protocol adapter, implementation library, diagnostic codes, and
incremental caching strategy remain open. Validate agreement between build and
editor diagnostics, including edits that affect other files.
See [ADR 0003](../adr/0003-share-compatibility-analysis.md).
