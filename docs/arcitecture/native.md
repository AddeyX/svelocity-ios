# Native reference harness

**Status:** app hosts, command plans, UI tests, and measurement sources are in the
repository. Linux validates preparation and planning. Xcode project loading, native
builds, UI behavior, and measurements still require Apple-platform execution;
Phase 1 is not complete without that evidence.

## Shape

[The Xcode project](../../examples/native/SvelocityDemo.xcodeproj/project.pbxproj)
has `SvelocityGenerated` and `SvelocityHandwritten` app targets for macOS and iOS,
with a UI test target for each. A [shared host](../../examples/native/HostApp.swift)
selects the view at compilation. The handwritten view mirrors
[Greeting.svelte](../../examples/Greeting.svelte); both use the same UI test sources.
The project is a checked-in property list, with no project-generator dependency.

[The native command module](../../src/native.ts) prepares the view, selects a
destination, builds, launches, and verifies XCTest results. It is a repository
reference harness, not a general app scaffolder or packager. Generated Swift lives
in `generated/native/Greeting.swift`; Xcode reads that ignored file directly.

Requires Node 22+, a Mac with full Xcode 16+ selected through `xcode-select`, and
an available iOS 17+ Simulator for iOS execution. The targets use Swift 6, macOS 14,
and iOS 17. UI execution requires a working desktop/Simulator session. The harness
uses local ad hoc signing; physical devices and distribution signing are not covered.

## Prepare and review on Linux

```sh
npm run build
npm run svelocity -- native prepare
npm run svelocity -- native build --platform ios --dry-run
npm run svelocity -- native test --platform macos --dry-run
```

Preparation runs the real compiler. Dry runs emit JSON command plans without
writing generated files or executing Apple tools. iOS run/test/benchmark dry runs
need an explicit Simulator UDID because Linux cannot discover Apple devices.

## Build and run on a Mac

```sh
npm ci
npm run build
npm run svelocity -- native run --platform macos
npm run svelocity -- native run --platform ios
npm run svelocity -- native run --platform macos --variant handwritten
```

Use `build` instead of `run` to produce only an app bundle. Variants default to
`generated`; builds default to Debug. iOS builds can use a generic Simulator
destination without booting a device. Other iOS actions select an available device
on the newest installed iOS runtime, preferring an iPhone. Override with
`--device` and a UDID from `xcrun simctl list devices available`. The harness does
not shut down other simulators. A successful launch command does not verify UI behavior.

Refresh via `native prepare` before opening the shared schemes directly in Xcode.
Rebuild/relaunch is the development loop; hot reload is not implemented.

## Smoke tests and baselines

Run the same procedure for both variants on the same host and destination:

```sh
set -e
for native_platform in macos ios; do
  for native_variant in generated handwritten; do
    npm run svelocity -- native test --platform "$native_platform" --variant "$native_variant"
    npm run svelocity -- native benchmark --platform "$native_platform" --variant "$native_variant"
  done
done
```

The smoke test verifies initial content, activates the button, checks the alternate
content, then switches back. The shared test helper clicks on Mac and taps on iOS.
Benchmarks require Release and collect five iterations of launch-to-responsive,
and five iterations of interaction clock time plus application memory metrics.
Interaction timing includes UI automation and accessibility observation overhead.
Repeated launches are not a cold-cache startup claim; Simulator results do not
establish physical-device performance. No project regression thresholds are set yet.

Fresh results go to
`generated/native/results/<platform>/<variant>/<test-or-benchmark>/<run-id>/`:

- `tests.xcresult`: authoritative test details, logs, and raw XCTest metrics.
- `summary.json`: the current run's `xcresulttool` summary.
- `run.json`: outcome, commands, configuration, host/Xcode/SDK details, Simulator
  selection, and source hashes for reproducibility.

The runner requires exactly one passed smoke test or two passed measurement tests,
with no failures, skips, or expected failures. Unknown summaries and zero-test runs
fail. It preserves native process exit codes and never reuses a result bundle.
Inspect metrics in Xcode; compare matched hardware, SDKs, configurations, and sources
before drawing conclusions. Baseline numbers remain uncollected in this Linux task.

## CI and remaining gate

[CI](../../.github/workflows/ci.yml) runs source tests on Linux/macOS and native
smoke tests plus Release measurements for both variants on each Apple platform.
Each platform's variants share a runner; result bundles and metadata are uploaded
even after failures when available. CI configuration is not proof that these jobs
have run or passed.

Phase 1 remains open until real macOS and Simulator runs pass and their baselines
are reviewed. See [ADR 0006](../adr/0006-validate-native-apps-with-a-shared-xcode-harness.md)
and the [roadmap](../roadmap.md).
