import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverComponents, ProjectService } from '../src/project.js';
import type { Diagnostic } from '../src/types.js';
import { Events, invalid, simple } from './helpers.js';

interface Report { file: string; source: string; diagnostics: Diagnostic[] }

test('project discovery includes nested components and excludes dependency/output folders', async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['nested', 'node_modules/pkg', 'generated', '.cache']) {
    await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, dir, 'App.svelte'), simple);
  }
  assert.deepEqual(await discoverComponents(root), [join(root, 'nested/App.svelte')]);
});

test('project checks unopened files and gives open editor content precedence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = join(root, 'App.svelte');
  const other = join(root, 'Other.svelte');
  await writeFile(app, invalid);
  await writeFile(other, simple);
  const reports = new Events<Report>();
  const project = new ProjectService(root, {}, (file, source, diagnostics) => reports.push({ file, source, diagnostics }), cause => { throw cause; });
  t.after(() => project.dispose());
  assert.equal(await project.checkAll(), 2);
  assert.ok(reports.values.find(r => r.file === app)!.diagnostics.length > 0);
  await project.open(app, simple);
  assert.deepEqual(reports.values.at(-1)!.diagnostics, []);
  await project.checkFile(app);
  assert.equal(reports.values.at(-1)!.source, simple);
  await project.close(app);
  assert.ok(reports.values.at(-1)!.diagnostics.length > 0);
});

test('watch mode reports edits, newly created components, and deleted directories', async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-watch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = join(root, 'App.svelte');
  await writeFile(app, invalid);
  const reports = new Events<Report>();
  const errors: unknown[] = [];
  const project = new ProjectService(root, {}, (file, source, diagnostics) => reports.push({ file, source, diagnostics }), cause => errors.push(cause));
  t.after(() => project.dispose());
  assert.equal(await project.start(), 1);
  let marker = reports.values.length;
  await writeFile(app, simple);
  await reports.wait(r => r.file === app && r.source === simple && r.diagnostics.length === 0, marker);
  marker = reports.values.length;
  const nested = join(root, 'nested');
  await mkdir(nested);
  const added = join(nested, 'Added.svelte');
  await writeFile(added, invalid);
  await reports.wait(r => r.file === added && r.diagnostics.length > 0, marker);
  marker = reports.values.length;
  await rm(nested, { recursive: true });
  await reports.wait(r => r.file === added && r.source === '' && r.diagnostics.length === 0, marker);
  assert.deepEqual(errors, []);
});
