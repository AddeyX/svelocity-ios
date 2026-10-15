import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { planNative, selectSimulator, verifyNativeSummary } from '../src/native.js';

const device = '11111111-1111-4111-8111-111111111111';
const older = '22222222-2222-4222-8222-222222222222';
const tablet = '33333333-3333-4333-8333-333333333333';
const cli = (...args: string[]) => spawnSync(process.execPath, [resolve('dist/src/cli.js'), ...args], {
  encoding: 'utf8', timeout: 15_000,
});

test('native plans keep generated/handwritten builds isolated and preserve paths with spaces', () => {
  const generated = planNative({ action: 'build', platform: 'macos' }, '/project with spaces', 'arm64');
  const reference = planNative({ action: 'build', platform: 'macos', variant: 'handwritten' }, '/project with spaces', 'arm64');
  const build = generated.commands[0]!;
  assert.equal(build.tool, 'xcodebuild');
  assert.ok(build.args.includes('/project with spaces/examples/native/SvelocityDemo.xcodeproj'));
  assert.ok(build.args.includes('platform=macOS,arch=arm64'));
  assert.notEqual(generated.appPath, reference.appPath);
  assert.match(generated.appPath, /generated\/native\/build\/macos\/generated\/Debug\/.*SvelocityGenerated.app$/);
  assert.match(reference.appPath, /handwritten\/Debug\/.*SvelocityHandwritten.app$/);
});

test('iOS build needs no simulator boot, while run installs and launches the selected app', () => {
  const build = planNative({ action: 'build', platform: 'ios' });
  assert.equal(build.commands.length, 1);
  assert.ok(build.commands[0]!.args.includes('generic/platform=iOS Simulator'));
  const run = planNative({ action: 'run', platform: 'ios', variant: 'handwritten', device });
  assert.deepEqual(run.commands.map(c => c.tool), ['xcrun', 'xcodebuild', 'xcrun', 'xcrun']);
  assert.deepEqual(run.commands[0]!.args, ['simctl', 'bootstatus', device, '-b']);
  assert.deepEqual(run.commands[2]!.args, ['simctl', 'install', device, run.appPath]);
  assert.deepEqual(run.commands[3]!.args, ['simctl', 'launch', '--terminate-running-process', device, 'dev.svelocity.demo.handwritten']);
  assert.ok(run.commands[1]!.args.includes(`platform=iOS Simulator,id=${device}`));
});

test('smoke tests select only their class and measurements require Release builds and fresh results', () => {
  const smoke = planNative({ action: 'test', platform: 'macos' }, '/repo', 'x64', 'first');
  assert.ok(smoke.commands[0]!.args.includes('-only-testing:SvelocityGeneratedUITests/NativeSmokeTests'));
  assert.ok(smoke.commands[0]!.args.includes('platform=macOS,arch=x86_64'));
  const performance = planNative({ action: 'benchmark', platform: 'macos' }, '/repo', 'x64', 'second');
  assert.equal(performance.configuration, 'Release');
  assert.ok(performance.commands[0]!.args.includes('-only-testing:SvelocityGeneratedUITests/NativePerformanceTests'));
  assert.notEqual(performance.resultBundle, smoke.resultBundle);
  assert.notEqual(performance.resultBundle, planNative({ action: 'benchmark', platform: 'macos' }).resultBundle);
  assert.throws(() => planNative({ action: 'benchmark', platform: 'macos', configuration: 'Debug' }), /Release/);
});

test('native request validation rejects ambiguous platforms, devices, configurations, and actions', () => {
  for (const request of [
    { action: 'test' }, { action: 'test', platform: 'watchos' },
    { action: 'build', platform: 'macos', device },
    { action: 'run', platform: 'ios', device: 'booted' },
    { action: 'run', platform: 'ios', device: '' },
    { action: 'build', platform: 'ios', configuration: 'Fast' },
    { action: 'build', platform: 'macos', variant: 'other' },
    { action: 'erase', platform: 'ios' },
  ]) assert.throws(() => planNative(request));
  assert.throws(() => planNative({ action: 'run', platform: 'ios' }), /needs --device/);
  assert.throws(() => planNative({ action: 'build', platform: 'macos' }, '/repo', 'sparc'), /architecture/);
});

test('simulator selection uses numeric runtime ordering, availability, and iPhone preference', () => {
  const inventory = { devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-1': [{ udid: older, name: 'iPhone Older', isAvailable: true }],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-10': [
      { udid: tablet, name: 'iPad Pro', isAvailable: true },
      { udid: device, name: 'iPhone Current', isAvailable: true },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [{ udid: older, name: 'iPhone Unavailable', isAvailable: false }],
    'com.apple.CoreSimulator.SimRuntime.tvOS-27-0': [{ udid: older, name: 'Apple TV', isAvailable: true }],
  } };
  assert.equal(selectSimulator(inventory).udid, device);
  assert.equal(selectSimulator(inventory, tablet).name, 'iPad Pro');
  assert.equal(selectSimulator(inventory, older).name, 'iPhone Older');
  assert.throws(() => selectSimulator({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-16-4': inventory.devices['com.apple.CoreSimulator.SimRuntime.iOS-26-1'] } }), /No available/);
  assert.throws(() => selectSimulator({ devices: {} }, device), /not an available/);
  assert.throws(() => selectSimulator({ devices: [] }), /inventory/);
});

test('native result verification rejects zero tests, skips, failures, wrong counts, and unknown schemas', () => {
  const passed = { passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0, totalTestCount: 1 };
  verifyNativeSummary(passed, 'test');
  verifyNativeSummary({ ...passed, passedTests: 2, totalTestCount: 2 }, 'benchmark');
  for (const summary of [
    {}, null, { ...passed, passedTests: 0 }, { ...passed, skippedTests: 1 },
    { ...passed, failedTests: 1 }, { ...passed, expectedFailures: 1 },
    { ...passed, totalTestCount: 2 }, { ...passed, passedTests: '1' },
  ]) assert.throws(() => verifyNativeSummary(summary, 'test'), /exactly 1 passed/);
  assert.throws(() => verifyNativeSummary(passed, 'benchmark'), /exactly 2 passed/);
});

test('native prepare generates the actual example and CLI dry-run executes no native tools', async () => {
  const prepared = cli('native', 'prepare');
  assert.equal(prepared.status, 0, prepared.stderr);
  const path = resolve('generated/native/Greeting.swift');
  assert.equal(await readFile(path, 'utf8'), await readFile('tests/fixtures/Greeting.swift', 'utf8'));
  const before = await stat(path);
  const result = cli('native', 'run', '--platform', 'ios', '--device', device, '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout) as { execution: string; commands: unknown[] };
  assert.equal(plan.execution, 'dry-run');
  assert.equal(plan.commands.length, 4);
  assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  assert.equal(cli('native', 'prepare', '--platform', 'macos').status, 2);
  assert.equal(cli('native', 'test', '--platform', 'macos', '--watch').status, 2);
  assert.equal(cli('check', 'examples', '--platform', 'macos').status, 2);
});

test('native execution fails clearly on non-Apple hosts instead of claiming a successful build', {
  skip: process.platform === 'darwin' ? 'Tests the non-Apple capability gate.' : false,
}, () => {
  const result = cli('native', 'build', '--platform', 'macos');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /require macOS and Xcode 16/);
  assert.doesNotMatch(result.stdout, /succeeded|Verified/);
});
