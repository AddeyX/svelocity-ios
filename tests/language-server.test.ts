import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  createProtocolConnection, DidChangeTextDocumentNotification, DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification, ExitNotification, InitializedNotification, InitializeRequest,
  PublishDiagnosticsNotification, ShutdownRequest, StreamMessageReader, StreamMessageWriter,
} from 'vscode-languageserver/node';
import type { PublishDiagnosticsParams } from 'vscode-languageserver/node';
import { analyze, positionAt } from '../src/index.js';
import { Events, invalid, simple } from './helpers.js';

test('language server checks unopened files, unsaved changes, disk edits, and clears stale errors', { timeout: 30_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'svelocity-lsp-'));
  const input = join(root, 'App.svelte');
  await writeFile(input, invalid);
  const child = spawn(process.execPath, [resolve('dist/src/language-server.js'), '--stdio'], { stdio: 'pipe' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  t.after(async () => {
    connection.dispose();
    if (child.exitCode === null) child.kill();
    await rm(root, { recursive: true, force: true });
  });
  const reports = new Events<PublishDiagnosticsParams>();
  connection.onNotification(PublishDiagnosticsNotification.type, params => reports.push(params));
  connection.listen();
  const uri = pathToFileURL(input).href;
  const result = await connection.sendRequest(InitializeRequest.type, {
    processId: process.pid, capabilities: {}, rootUri: pathToFileURL(root).href,
  });
  assert.equal(result.capabilities.textDocumentSync, 2);
  await connection.sendNotification(InitializedNotification.type, {});
  const initial = await reports.wait(r => r.uri === uri && r.diagnostics.length > 0);
  assert.equal(initial.version, undefined);
  assert.equal(initial.diagnostics[0]!.code, analyze(invalid, input).diagnostics[0]!.code);
  let marker = reports.values.length;
  await connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'svelte', version: 1, text: simple },
  });
  await reports.wait(r => r.uri === uri && r.version === 1 && r.diagnostics.length === 0, marker);
  assert.equal(await readFile(input, 'utf8'), invalid, 'editor content must not modify the file');
  marker = reports.values.length;
  await connection.sendNotification(DidChangeTextDocumentNotification.type, {
    textDocument: { uri, version: 2 },
    contentChanges: [{ range: { start: { line: 0, character: 0 }, end: positionAt(simple, simple.length) }, text: invalid }],
  });
  const changed = await reports.wait(r => r.uri === uri && r.version === 2 && r.diagnostics.length > 0, marker);
  assert.deepEqual(changed.diagnostics[0]!.range, { start: { line: 0, character: 0 }, end: positionAt(invalid, invalid.length) });
  await writeFile(input, simple);
  marker = reports.values.length;
  await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } });
  await reports.wait(r => r.uri === uri && r.version === undefined && r.diagnostics.length === 0, marker);
  marker = reports.values.length;
  await writeFile(input, invalid);
  await reports.wait(r => r.uri === uri && r.version === undefined && r.diagnostics.length > 0, marker);
  marker = reports.values.length;
  await rm(input);
  await reports.wait(r => r.uri === uri && r.diagnostics.length === 0, marker);
  await connection.sendRequest(ShutdownRequest.type);
  const exit = once(child, 'exit');
  await connection.sendNotification(ExitNotification.type);
  const [code] = await exit;
  assert.equal(code, 0, stderr);
  assert.equal(stderr, '');
});
