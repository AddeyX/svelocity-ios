# 0004: Derive routes from folders

Status: Accepted
Date: 2026-10-15

## Context

Applications need discoverable route organization while presenting native Apple
navigation rather than depending on browser infrastructure.

## Decision

Derive a typed route model from the application's folder structure and connect
destinations to SwiftUI navigation. Keep native presentation choices explicit.

## Consequences

Routes can be discovered and checked during development. Folder nesting alone
does not define stack, sheet, tab, or split-view behavior. Exact file conventions,
parameter rules, and presentation configuration remain open.

## References

- [Routing design](../arcitecture/routing.md)
