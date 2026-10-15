import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { arch, cpus, machine, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, positionAt } from './index.js';

type Action = 'build' | 'run' | 'test' | 'benchmark';
type Platform = 'ios' | 'macos';
type Variant = 'generated' | 'handwritten';
type Configuration = 'Debug' | 'Release';
export interface NativeRequest {
  action: string;
  platform?: string;
  variant?: string;
  configuration?: string;
  device?: string;
  dryRun?: boolean;
}
interface Options {
  action: Action;
  platform: Platform;
  variant: Variant;
  configuration: Configuration;
  device?: string;
}
export interface NativeCommand { tool: string; args: string[] }
export interface NativePlan extends Options {
  scheme: string;
  appPath: string;
  artifactDirectory: string | null;
  resultBundle: string | null;
  commands: NativeCommand[];
}
export interface Simulator { udid: string; name: string; runtime: string }

const repository = fileURLToPath(new URL('../../', import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const generatedFile = (root: string): string => join(root, 'generated/native/Greeting.swift');

function normalize(request: NativeRequest): Options {
  const { action, platform, device } = request;
  const variant = request.variant ?? 'generated';
  const configuration = request.configuration ?? (action === 'benchmark' ? 'Release' : 'Debug');
  if (action !== 'build' && action !== 'run' && action !== 'test' && action !== 'benchmark') {
    throw new Error('Native action must be prepare, build, run, test, or benchmark.');
  }
  if (platform !== 'ios' && platform !== 'macos') throw new Error('Native commands require --platform ios or macos.');
  if (variant !== 'generated' && variant !== 'handwritten') throw new Error('Native variant must be generated or handwritten.');
  if (configuration !== 'Debug' && configuration !== 'Release') throw new Error('Native configuration must be Debug or Release.');
  if (action === 'benchmark' && configuration !== 'Release') throw new Error('Benchmarks require Release builds for both variants.');
  if (device !== undefined && (platform !== 'ios' || !uuid.test(device))) throw new Error('--device requires an iOS Simulator UDID.');
  return { action, platform, variant, configuration, ...(device !== undefined ? { device } : {}) };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Select only available iOS 17+ devices; never fall through to watchOS/tvOS. */
export function selectSimulator(inventory: unknown, requested?: string): Simulator {
  if (!record(inventory) || !record(inventory.devices)) throw new Error('Invalid simctl device inventory.');
  const candidates: Array<Simulator & { version: number[] }> = [];
  for (const [runtime, devices] of Object.entries(inventory.devices)) {
    const match = /\.iOS-(\d+)(?:-(\d+))?(?:-(\d+))?$/.exec(runtime);
    if (!match || Number(match[1]) < 17 || !Array.isArray(devices)) continue;
    for (const device of devices) {
      if (!record(device) || device.isAvailable !== true || typeof device.udid !== 'string'
        || !uuid.test(device.udid) || typeof device.name !== 'string') continue;
      candidates.push({ udid: device.udid, name: device.name, runtime, version: match.slice(1).map(v => Number(v ?? 0)) });
    }
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a.version[i] !== b.version[i]) return b.version[i]! - a.version[i]!;
    }
    return Number(b.name.startsWith('iPhone')) - Number(a.name.startsWith('iPhone')) || a.name.localeCompare(b.name);
  });
  const selected = requested ? candidates.find(d => d.udid.toLowerCase() === requested.toLowerCase()) : candidates[0];
  if (!selected) throw new Error(requested
    ? `Simulator ${requested} is not an available iOS 17+ device.`
    : 'No available iOS 17+ Simulator. Install an iOS runtime in Xcode, then retry.');
  return { udid: selected.udid, name: selected.name, runtime: selected.runtime };
}

/** A reviewable command plan. Constructing it does not execute tools or write files. */
export function planNative(request: NativeRequest, root = repository, hostArch: string = process.arch, runId: string = randomUUID()): NativePlan {
  const options = normalize(request);
  const { action, platform, variant, configuration, device } = options;
  if (platform === 'ios' && action !== 'build' && !device) {
    throw new Error('An iOS run/test/benchmark plan needs --device <UDID>; execution on macOS can select one automatically.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('Invalid native result identifier.');
  if (hostArch !== 'arm64' && hostArch !== 'x64') throw new Error(`Unsupported native host architecture: ${hostArch}.`);
  const scheme = variant === 'generated' ? 'SvelocityGenerated' : 'SvelocityHandwritten';
  const derived = join(root, 'generated/native/build', platform, variant, configuration);
  const appPath = join(derived, 'Build/Products', configuration + (platform === 'ios' ? '-iphonesimulator' : ''), scheme + '.app');
  const isTest = action === 'test' || action === 'benchmark';
  const artifactDirectory = isTest ? join(root, 'generated/native/results', platform, variant, action, runId) : null;
  const resultBundle = artifactDirectory ? join(artifactDirectory, 'tests.xcresult') : null;
  const destination = platform === 'macos'
    ? `platform=macOS,arch=${hostArch === 'arm64' ? 'arm64' : 'x86_64'}`
    : device ? `platform=iOS Simulator,id=${device}` : 'generic/platform=iOS Simulator';
  const commands: NativeCommand[] = [];
  if (platform === 'ios' && action !== 'build') {
    commands.push({ tool: 'xcrun', args: ['simctl', 'bootstatus', device!, '-b'] });
  }
  const args = [
    '-project', join(root, 'examples/native/SvelocityDemo.xcodeproj'), '-scheme', scheme,
    '-configuration', configuration, '-destination', destination, '-destination-timeout', '60',
    '-derivedDataPath', derived,
  ];
  if (isTest) args.push(
    '-parallel-testing-enabled', 'NO', '-test-timeouts-enabled', 'YES',
    '-maximum-test-execution-time-allowance', '120', '-resultBundlePath', resultBundle!,
    `-only-testing:${scheme}UITests/${action === 'test' ? 'NativeSmokeTests' : 'NativePerformanceTests'}`,
  );
  commands.push({ tool: 'xcodebuild', args: [...args, isTest ? 'test' : 'build'] });
  if (action === 'run') {
    if (platform === 'ios') commands.push(
      { tool: 'xcrun', args: ['simctl', 'install', device!, appPath] },
      { tool: 'xcrun', args: ['simctl', 'launch', '--terminate-running-process', device!, `dev.svelocity.demo.${variant}`] },
    );
    else commands.push({ tool: 'open', args: ['-n', appPath] });
  }
  return { ...options, scheme, appPath, artifactDirectory, resultBundle, commands };
}

/** A successful runner exit is insufficient: verify the selected tests really passed. */
export function verifyNativeSummary(summary: unknown, action: 'test' | 'benchmark'): void {
  const expected = action === 'test' ? 1 : 2;
  if (!record(summary) || summary.passedTests !== expected || summary.failedTests !== 0
    || summary.skippedTests !== 0 || (summary.expectedFailures !== undefined && summary.expectedFailures !== 0)
    || (summary.totalTestCount !== undefined && summary.totalTestCount !== expected)) {
    throw new Error(`Native ${action} did not report exactly ${expected} passed test(s) with no failures, skips, or expected failures. Inspect summary.json and the .xcresult bundle.`);
  }
}

export class NativeProcessError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function execute(command: NativeCommand, capture = false): string {
  const result = spawnSync(command.tool, command.args, {
    cwd: repository, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw new Error(`Cannot run ${command.tool}: ${result.error.message}. Select a full Xcode installation with xcode-select.`);
  if (result.status !== 0) throw new NativeProcessError(result.status ?? 1,
    `${command.tool} failed (${result.signal ?? result.status}).${capture && result.stderr ? '\n' + result.stderr.trim() : ''}`);
  return result.stdout ?? '';
}

async function prepare(): Promise<void> {
  const sourceFile = join(repository, 'examples/Greeting.svelte');
  const source = await readFile(sourceFile, 'utf8');
  const compiled = compile(source, 'Greeting.svelte');
  if (!compiled.swift) throw new Error(compiled.diagnostics.map(d => {
    const location = positionAt(source, d.start);
    return `${sourceFile}:${location.line + 1}:${location.character + 1} ${d.code}: ${d.message}`;
  }).join('\n'));
  await mkdir(join(repository, 'generated/native'), { recursive: true });
  await writeFile(generatedFile(repository), compiled.swift);
}

async function sourceHashes(): Promise<Record<string, string>> {
  const paths = [
    'examples/Greeting.svelte', 'generated/native/Greeting.swift',
    'examples/native/HostApp.swift', 'examples/native/HandwrittenGreeting.swift',
    'examples/native/UITests/NativeSmokeTests.swift', 'examples/native/UITests/NativePerformanceTests.swift',
    'examples/native/UITests/UITestSupport.swift',
    'examples/native/SvelocityDemo.xcodeproj/project.pbxproj',
    'examples/native/SvelocityDemo.xcodeproj/xcshareddata/xcschemes/SvelocityGenerated.xcscheme',
    'examples/native/SvelocityDemo.xcodeproj/xcshareddata/xcschemes/SvelocityHandwritten.xcscheme',
  ];
  const hashes: Record<string, string> = {};
  for (const path of paths) hashes[path] = createHash('sha256').update(await readFile(join(repository, path))).digest('hex');
  return hashes;
}

export async function runNative(request: NativeRequest): Promise<void> {
  if (request.action === 'prepare') {
    if (request.platform !== undefined || request.variant !== undefined || request.configuration !== undefined
      || request.device !== undefined || request.dryRun) {
      throw new Error('native prepare takes no additional options.');
    }
    await prepare();
    console.log(`Prepared ${generatedFile(repository)} (native tools not run)`);
    return;
  }
  const options = normalize(request);
  if (request.dryRun) {
    console.log(JSON.stringify({ execution: 'dry-run', generatedSource: generatedFile(repository), ...planNative(options) }, null, 2));
    return;
  }
  if (process.platform !== 'darwin') {
    throw new Error('Native build/run/tests require macOS and Xcode 16+. Use native prepare or --dry-run on Linux.');
  }
  const xcode = execute({ tool: 'xcodebuild', args: ['-version'] }, true).trim();
  const version = /^Xcode (\d+)/m.exec(xcode);
  if (!version || Number(version[1]) < 16) throw new Error('Native validation requires full Xcode 16+ and its SDKs.');
  let simulator: Simulator | null = null;
  if (options.platform === 'ios' && (options.action !== 'build' || options.device)) {
    simulator = selectSimulator(JSON.parse(execute({ tool: 'xcrun', args: ['simctl', 'list', 'devices', 'available', '--json'] }, true)), options.device);
    options.device = simulator.udid;
  }
  const id = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '') + '-' + randomUUID();
  const plan = planNative(options, repository, process.arch, id);
  await prepare();
  let metadata: Record<string, unknown> | null = null;
  if (plan.artifactDirectory) {
    await mkdir(plan.artifactDirectory, { recursive: true });
    metadata = {
      ...plan, startedAt: new Date().toISOString(), outcome: 'running',
      xcode, host: {
        processArchitecture: arch(), hardwareArchitecture: machine(), cpu: cpus()[0]?.model,
        memoryBytes: totalmem(), kernel: release(), node: process.version,
        macOS: execute({ tool: 'sw_vers', args: ['-productVersion'] }, true).trim(),
      }, simulator,
      sdkVersion: execute({ tool: 'xcrun', args: ['--sdk', options.platform === 'ios' ? 'iphonesimulator' : 'macosx', '--show-sdk-version'] }, true).trim(),
      sources: await sourceHashes(),
      measurements: options.action === 'benchmark'
        ? 'Five iterations each: launch-to-responsive; interaction clock time and application memory. Raw metrics are in tests.xcresult. No regression thresholds are configured.'
        : null,
    };
    await writeFile(join(plan.artifactDirectory, 'run.json'), JSON.stringify(metadata, null, 2) + '\n');
  }
  try {
    for (const command of plan.commands) {
      console.log(`Native: ${command.tool} ${command.args.join(' ')}`);
      execute(command);
    }
    if (plan.resultBundle && plan.artifactDirectory) {
      if (!(await stat(plan.resultBundle)).isDirectory()) throw new Error('No XCTest result bundle was produced.');
      const raw = execute({ tool: 'xcrun', args: ['xcresulttool', 'get', 'test-results', 'summary', '--path', plan.resultBundle] }, true);
      await writeFile(join(plan.artifactDirectory, 'summary.json'), raw);
      verifyNativeSummary(JSON.parse(raw), options.action as 'test' | 'benchmark');
    } else if (!(await stat(plan.appPath)).isDirectory()) throw new Error('Native build produced no application bundle.');
    if (metadata && plan.artifactDirectory) {
      metadata.outcome = 'passed';
      metadata.finishedAt = new Date().toISOString();
      await writeFile(join(plan.artifactDirectory, 'run.json'), JSON.stringify(metadata, null, 2) + '\n');
    }
  } catch (cause) {
    if (metadata && plan.artifactDirectory) {
      metadata.outcome = 'failed';
      metadata.error = (cause as Error).message;
      metadata.finishedAt = new Date().toISOString();
      await writeFile(join(plan.artifactDirectory, 'run.json'), JSON.stringify(metadata, null, 2) + '\n');
    }
    throw cause;
  }
  console.log(plan.artifactDirectory ? `Verified native ${options.action}. Results: ${plan.artifactDirectory}`
    : options.action === 'run' ? `Launched ${plan.appPath}. Use native test to verify UI behavior.`
    : `Built ${plan.appPath}`);
}
