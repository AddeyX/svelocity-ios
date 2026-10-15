#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { defaultTargets, generateDeclarations, validateTargets } from './bindings.js';
import { compile } from './index.js';
import { NativeProcessError, runNative } from './native.js';
import { ProjectService } from './project.js';
import { positionAt } from './types.js';
import type { CompilerOptions, Diagnostic, Target } from './types.js';

const help = `Usage:
  svelocity check <file-or-directory> [--watch] [--ios 17.0] [--macos 14.0]
  svelocity compile <file.svelte> --out <file.swift> [--name Component] [target flags]
  svelocity bindings --out <native.d.ts>
  svelocity native prepare
  svelocity native <build|run|test|benchmark> --platform <ios|macos>
    [--variant generated|handwritten] [--configuration Debug|Release]
    [--device <Simulator-UDID>] [--dry-run]

Without target flags, check both iOS 17 and macOS 14.
Supplying target flags selects only the supplied platforms.
Compile generates source; it does not invoke Xcode or prove native build success.
Native commands operate on the repository's reference app harness. Execution
requires macOS and Xcode 16+; prepare and dry runs are available on Linux.
`;

function report(file: string, source: string, diagnostics: Diagnostic[]): void {
  for (const item of diagnostics) {
    const position = positionAt(source, item.start);
    console.error(`${file}:${position.line + 1}:${position.character + 1} ${item.code}: ${item.message}`);
  }
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' }, watch: { type: 'boolean' },
      out: { type: 'string' }, name: { type: 'string' },
      ios: { type: 'string' }, macos: { type: 'string' },
      platform: { type: 'string' }, variant: { type: 'string' },
      configuration: { type: 'string' }, device: { type: 'string' }, 'dry-run': { type: 'boolean' },
    },
  });
  if (values.help) { console.log(help); return; }
  const [command, input, ...extra] = positionals;
  if (extra.length || !command) throw new Error(help);
  if (command === 'native') {
    if (!input || values.out !== undefined || values.name !== undefined || values.watch !== undefined
      || values.ios !== undefined || values.macos !== undefined) throw new Error(help);
    await runNative({ action: input, platform: values.platform, variant: values.variant,
      configuration: values.configuration, device: values.device, dryRun: values['dry-run'] });
    return;
  }
  if (values.platform !== undefined || values.variant !== undefined || values.configuration !== undefined
    || values.device !== undefined || values['dry-run'] !== undefined) throw new Error(help);
  const targets: Target[] = [];
  if (values.ios !== undefined) targets.push({ platform: 'ios', minimumVersion: values.ios });
  if (values.macos !== undefined) targets.push({ platform: 'macos', minimumVersion: values.macos });
  const options: CompilerOptions = {
    targets: targets.length ? targets : defaultTargets,
    ...(values.name ? { componentName: values.name } : {}),
  };
  validateTargets(options.targets!);
  if (command === 'bindings') {
    if (!values.out || input || values.watch || values.name || targets.length) throw new Error('bindings requires only --out <native.d.ts>.');
    if (!values.out.endsWith('.d.ts')) throw new Error('Binding declarations must use a .d.ts output path.');
    await mkdir(dirname(resolve(values.out)), { recursive: true });
    await writeFile(values.out, generateDeclarations());
    console.log(`Wrote ${resolve(values.out)}`);
    return;
  }
  if (!input) throw new Error(help);
  if (command === 'compile') {
    if (!input.endsWith('.svelte') || !values.out?.endsWith('.swift') || values.watch) {
      throw new Error('compile requires a .svelte input and --out <file.swift>; --watch is for check.');
    }
    const source = await readFile(input, 'utf8');
    const result = compile(source, input, options);
    report(resolve(input), source, result.diagnostics);
    if (result.swift === null) { process.exitCode = 1; return; }
    await mkdir(dirname(resolve(values.out)), { recursive: true });
    await writeFile(values.out, result.swift);
    console.log(`Generated ${resolve(values.out)} (native compilation not run)`);
    return;
  }
  if (command !== 'check' || values.out || values.name) throw new Error(help);
  const errors = new Map<string, number>();
  const project = new ProjectService(resolve(input), options, (file, source, diagnostics) => {
    errors.set(file, diagnostics.length);
    report(file, source, diagnostics);
    if (values.watch) console.log(`Checked ${file}: ${diagnostics.length} error(s)`);
  }, cause => { console.error((cause as Error).message); process.exitCode = 2; project.dispose(); });
  if (values.watch) {
    const cleanup = (): void => { project.dispose(); };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    const count = await project.start();
    console.log(`Watching ${resolve(input)} (${count} component(s) checked)`);
  } else {
    const count = await project.checkAll();
    if (count === 0) throw new Error('No .svelte components found.');
    const total = [...errors.values()].reduce((sum, count) => sum + count, 0);
    console.log(`Checked ${count} component(s): ${total} error(s)`);
    if (total) process.exitCode = 1;
  }
}

main().catch(cause => {
  console.error((cause as Error).message);
  process.exitCode = cause instanceof NativeProcessError ? cause.status : 2;
});
