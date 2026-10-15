# Language server and continuous checking

**Status:** [project watching](../../src/project.ts) and a
[stdio language server](../../src/language-server.ts) provide diagnostics using
the compiler's analyzer. Completion, hover, and navigation are planned.

The project service checks all workspace components at startup and watches source
edits. Components are currently independent: it rechecks edited files and rescans
directory changes, clearing stale diagnostics when files disappear. Open editor
content takes precedence over disk. Dependency, cache, and output directories are
excluded from discovery. Tracking configuration, route metadata, external binding
descriptions, and cross-component dependencies remains planned.

## One analysis engine

The compiler, command-line checker, watcher, and language server use the same
compatibility rules. The language server currently exposes diagnostics to editors.
Command-line watch mode provides continuous feedback without an editor; component
compilation also enforces compatibility.

Diagnostics should identify the source location, the unsupported behavior, and a
possible supported alternative. Examples include browser DOM access, unsupported
JavaScript constructs, invalid native arguments, and APIs unavailable for a
configured platform or minimum OS version.

## Validation boundary

Fast source analysis does not replace Swift compilation. Report native compiler
errors separately and map them back to authored source where possible. Do not
claim a successful source check proves that the generated app builds or runs.

The server uses the Language Server Protocol library and `SV_*` diagnostic
identifiers. Targets come from initialization options; changing targets currently
requires restarting the server. Dependency invalidation and broader language
tooling remain open. Integration tests exercise actual stdio diagnostics and disk
watching. See [ADR 0003](../adr/0003-share-compatibility-analysis.md).
