# Repository rules

These rules apply throughout this repository. Follow applicable user instructions
and any more specific `AGENTS.md` files; local guidance must preserve these rules.

## Read only what the task needs

Start with the relevant code and tests. Use these pointers to find design context;
do not read every document for every task. Follow additional links only when the
work crosses that boundary. Until implementation exists, treat design as intent.

- Architecture overview or work across subsystems -> [docs/arcitecture/README.md](docs/arcitecture/README.md).
- Phased planning, milestone scope, or completion criteria -> [docs/roadmap.md](docs/roadmap.md).
- Compiler, supported language, reactivity, or Swift generation -> [docs/arcitecture/compiler.md](docs/arcitecture/compiler.md).
- Swift APIs, native components, modifiers, or platform availability -> [docs/arcitecture/bindings.md](docs/arcitecture/bindings.md).
- Language server, diagnostics, or continuous checking -> [docs/arcitecture/language.md](docs/arcitecture/language.md).
- Routes, layouts, or native navigation -> [docs/arcitecture/routing.md](docs/arcitecture/routing.md).
- Architectural decisions or their rationale -> [docs/adr/README.md](docs/adr/README.md), then the relevant ADRs.
- Module/interface design, test seams, or deepening a module -> [.agents/skills/codebase-design/SKILL.md](.agents/skills/codebase-design/SKILL.md).
- Making or revising an architectural decision -> [.agents/skills/architecture-decisions/SKILL.md](.agents/skills/architecture-decisions/SKILL.md).

## Design boundaries

- Compile application logic to Swift and render with SwiftUI. Do not introduce a
  JavaScript engine or silently fall back to JavaScript in the shipped application.
- Let Swift and Apple frameworks define the native API surface. Do not assume
  browser DOM, CSS layout, or web lifecycle semantics exist on the target.
- Reject unsupported behavior with actionable diagnostics tied to source locations.
  Do not silently drop code, substitute behavior, or claim unsupported capabilities.
- Share compatibility analysis between compilation, command-line checks, watch mode,
  and the language server. Do not implement competing semantic rules in each tool.
- Check native APIs against the configured platforms and minimum OS versions.
- Judge imported runtime code by supported semantics, not its placement in
  `dependencies` or `devDependencies`. Build tools may execute under Node.
- Changes to these boundaries require an ADR using the decision skill. An ADR
  records a decision; it does not grant authority beyond the user's task.

## Implementation and verification

- Keep changes scoped to the task. Preserve unrelated work and existing public behavior.
- Preserve type, compatibility, and security checks. Do not suppress errors or weaken
  tests to make a change pass.
- Add or update meaningful tests for changed compiler behavior, diagnostics, bindings,
  and routing once those systems exist. Do not add boilerplate tests for prose edits.
- Run relevant existing checks. Report exactly what ran and distinguish failures,
  skips, and checks blocked by the environment. Native SwiftUI validation requires
  macOS and the appropriate Xcode SDKs; Linux checks do not establish that it works.
- Never commit credentials or put secret values in logs, docs, or examples.

## Documentation and decisions

- Code and tests are the truth about implemented behavior. Keep design notes short;
  distinguish intended behavior, implemented behavior, and open questions.
- Update the affected design note when its responsibilities or contracts change.
- Use the decision skill for changes to architecture, platform/runtime strategy,
  language semantics, subsystem boundaries, or public contracts. Record the ADR
  in the same change; routine fixes and internal refactors do not need one.
- Do not rewrite accepted ADRs to hide an old decision. Supersede them with a new
  ADR, preserving the old rationale and adding reciprocal links.
- Do not add speculative infrastructure, dependencies, or implementation merely
  to make the documentation look complete.
