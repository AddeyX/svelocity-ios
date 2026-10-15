# Phased roadmap

**Status:** proposed sequence from the planning discussion. The initial compiler
slice exists; the phases below are not complete. Code and tests establish actual
support. This roadmap describes milestones, not language or API specifications.

The goal is native Apple applications authored in Svelte and TypeScript, with
Swift/SwiftUI defining the platform surface and no shipped JavaScript engine.
Grow coverage through increasingly capable applications on both iOS and macOS.
Each phase needs compiler support, shared diagnostics, and meaningful validation.

## Starting point

The [current subset](../README.md#current-subset) provides five native views,
string/Boolean state, assignment actions, conditional views, source generation,
CLI checking/watch mode, and language-server diagnostics. Native SDK typechecks
are configured for macOS CI; this Linux environment has not verified native
compilation, application behavior, or performance.

## 1. Prove native execution

**Progress:** the [native reference harness](arcitecture/native.md), build/run
commands, shared UI tests, and Release measurement sources are implemented.
Preparation and command planning are validated on Linux. Native project loading,
builds, UI runs, and measured baselines remain pending on macOS/Xcode.

Build minimal iOS and macOS app hosts, native build/run commands, UI smoke tests,
and equivalent handwritten SwiftUI examples. Establish the Apple-platform feedback
loop before expanding language coverage. Start with rebuild/relaunch behavior;
do not assume hot reload is available.

**Complete when:** generated apps launch on macOS and an iOS Simulator, button
actions visibly update state and conditional views, and reproducible startup,
memory, and UI-update baselines exist for generated and handwritten versions.

## 2. Establish component and language semantics

Add multiple files, component imports, props, callbacks, functions, numeric
semantics, records, arrays, keyed lists, and derived state in bounded increments.
Define ownership, identity, and lifecycle rules before adding effects and cleanup.
Track cross-file dependencies so diagnostics invalidate correctly after edits.

**Complete when:** a small application uses reusable components and editable
lists, preserves the intended state and identity, and reports incompatible code
consistently in compilation, CLI checks, and the editor.

## 3. Make native bindings extensible

Formalize binding descriptions and generated TypeScript declarations. Expand
initializers, modifiers, view-based content, native types/enums, and custom Swift
modules. Investigate extracting metadata from Swift tooling where mappings can
be faithful; keep unsupported API shapes explicit.

**Complete when:** a developer can expose an additional Swift API without editing
the compiler backend, with typed authoring support, platform checks, native
compilation, and useful diagnostics for unsupported shapes.

## 4. Build application navigation

Implement folder routing, layouts, typed parameters, navigation stacks, sheets,
tabs, split views, deep links, and state restoration. Include macOS windows and
menus. Decide file conventions and native presentation rules in ADRs as needed.

**Complete when:** the reference application navigates appropriately on iPhone
and Mac, including parameter validation, deep links, and restoration of supported
navigation state. Folder nesting must not silently choose presentation behavior.

## 5. Support real application workloads

Add asynchronous functions, errors, cancellation, actor boundaries, networking,
persistence, and native services. Expand compilation of compatible TypeScript
dependencies by reachable supported behavior. Build tools can run under Node;
runtime imports need faithful compilation or explicit native implementations.

**Complete when:** an application loads, edits, persists, and refreshes data,
handles failures and cancellation, and exercises native services without a
JavaScript runtime. Dependency compatibility and limitations are documented.

## 6. Make development productive

Package an editor extension; add completion, hover, symbol navigation, Swift-error
mapping, project scaffolding, incremental builds, simulator/device workflows,
and debugging improvements. Basic build/run support starts in phase 1, and
language-server diagnostics advance throughout every phase.

**Complete when:** a developer can create, run, diagnose, and modify an application
through a documented workflow, with errors connected to authored source and
predictable rebuild behavior.

## 7. Establish a production contract

Define compatibility and versioning policies, reproducible release builds,
performance regression gates, and the supported SDK matrix. Audit accessibility,
localization, memory behavior, and concurrency. Address these concerns as native
features are introduced; this phase consolidates their release criteria.

**Complete when:** a representative application passes the supported platform
matrix, agreed performance thresholds, and documented release criteria. Publish
an accurate feature/support matrix and a process for handling incompatible changes.

## Work across phases

- Add shared compatibility diagnostics alongside every supported feature; the
  editor and compiler must not develop separate semantic contracts.
- Validate generated Swift and observable native behavior on Apple platforms.
  Linux checks and successful source generation do not establish native readiness.
- Compare equivalent applications for startup, memory, and UI responsiveness;
  native compilation alone does not prove performance parity.
- Keep design notes concise and record substantive choices through the
  [ADR workflow](adr/README.md). Sequencing can change as implementation supplies
  evidence; this roadmap does not decide unresolved syntax or type semantics.

Native API coverage remains an ongoing track as Apple adds capabilities. Combine
reliable generated bindings with explicit mappings and native extensions; do not
treat this roadmap as a promise of automatic support for every Swift construct.

## Open planning choices

A small notes application is the suggested reference project: it can grow from
state and lists into routing, persistence, search, asynchronous work, and multiple
windows. The reference application has not been selected. Phase 1 is in progress;
its next gate is actual Apple-platform validation. Later tasks and estimates remain
to be determined.
