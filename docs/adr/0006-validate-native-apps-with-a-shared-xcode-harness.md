# 0006: Validate native apps with a shared Xcode harness

Status: Accepted
Date: 2026-10-15

## Context

Source generation and SDK typechecks do not establish observable native behavior
or performance. Phase 1 needs comparable iOS Simulator and macOS applications.

## Decision

Keep a small Xcode project with generated and handwritten SwiftUI app targets,
a shared app host, and per-variant UI test targets using the same test sources.
Generate the Svelte view into ignored output before invoking Xcode. Provide a
repository reference-harness command for preparation, building, running, smoke
tests, and measurements; this is not yet a general application packager.

Use Release builds for measurement, keep fresh XCTest result bundles and run
metadata, and verify actual passed test counts. Collect baselines before deciding
regression thresholds. Keep native execution dependent on macOS and Xcode.

## Consequences

Both implementations exercise the same host, UI expectations, and measurement
procedure without an additional project generator. Native results remain required
before claiming Phase 1 complete. Simulator measurements are platform baselines,
not physical-device performance claims; interaction measurements include UI
automation overhead. More general app configuration and packaging remain future work.

## References

- [Native development](../arcitecture/native.md)
- [Phase 1](../roadmap.md#1-prove-native-execution)
