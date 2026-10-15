import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { Events, invalid, simple } from './helpers.js';

const cli = (args: string[]) => spawnSync(process.execPath, [resolve('dist/src/cli.js'), ...args], { encoding: 'utf8', timeout: 15_000 });

test('CLI generates Swift and declarations, with meaningful check exit codes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'App.svelte');
  const output = join(root, 'App.swift');
  await writeFile(input, simple);
  let result = cli(['compile', input, '--out', output]);
  assert.equal(result.status, 0, result.stderr);
  const previous = await readFile(output, 'utf8');
  assert.match(previous, /struct App: SwiftUI.View/);
  result = cli(['check', root]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checked 1 component\(s\): 0 error/);
  await writeFile(input, invalid);
  result = cli(['compile', input, '--out', output]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SV_TEMPLATE/);
  assert.equal(await readFile(output, 'utf8'), previous);
  result = cli(['check', root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /App.svelte:1:1 SV_TEMPLATE/);
  const declarations = join(root, 'native.d.ts');
  result = cli(['bindings', '--out', declarations]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(declarations, 'utf8'), /declare module '@svelocity\/swiftui'/);
});

test('CLI rejects empty checks, invalid flags, and incompatible target versions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(cli(['check', root]).status, 2);
  const input = join(root, 'App.svelte');
  await writeFile(input, simple);
  assert.equal(cli(['check', input, '--ios', '12.0']).status, 1);
  assert.equal(cli(['check', input, '--macos', '10.15']).status, 0);
  assert.equal(cli(['compile', input, '--out', input]).status, 2);
  assert.equal(cli(['check', input, '--ios', 'latest']).status, 2);
  assert.equal(cli(['check', input, '--unknown']).status, 2);
});

test('CLI watch keeps checking after errors and stops cleanly', { timeout: 20_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-cli-watch-'));
  const input = join(root, 'App.svelte');
  await writeFile(input, simple);
  const child = spawn(process.execPath, [resolve('dist/src/cli.js'), 'check', root, '--watch']);
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await rm(root, { recursive: true, force: true });
  });
  const output = new Events<string>();
  let text = '';
  const collect = (chunk: Buffer): void => { text += String(chunk); output.push(text); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  await output.wait(value => value.includes('Watching'));
  await writeFile(input, invalid);
  await output.wait(value => value.includes('SV_TEMPLATE'));
  const marker = output.values.length;
  const errorOffset = text.indexOf('SV_TEMPLATE');
  await writeFile(input, simple);
  await output.wait(value => value.slice(errorOffset).includes('0 error(s)'), marker);
  const exit = once(child, 'exit');
  child.kill('SIGTERM');
  assert.equal((await exit)[0], 0);
});
