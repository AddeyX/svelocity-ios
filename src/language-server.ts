#!/usr/bin/env node
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createConnection, DiagnosticSeverity, ProposedFeatures, ResponseError,
  TextDocuments, TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { analyze } from './analyze.js';
import { defaultTargets, validateTargets } from './bindings.js';
import { ProjectService } from './project.js';
import { positionAt } from './types.js';
import type { CompilerOptions, Diagnostic, Target } from './types.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const projects: ProjectService[] = [];
let options: CompilerOptions = { targets: defaultTargets };

function publish(file: string, source: string, diagnostics: Diagnostic[]): void {
  const uri = pathToFileURL(file).href;
  connection.sendDiagnostics({
    uri,
    ...(documents.get(uri) ? { version: documents.get(uri)!.version } : {}),
    diagnostics: diagnostics.map(item => ({
      range: { start: positionAt(source, item.start), end: positionAt(source, item.end) },
      severity: DiagnosticSeverity.Error, source: 'svelocity', code: item.code, message: item.message,
    })),
  });
}

function projectFor(file: string): ProjectService | undefined {
  return projects.find(project => {
    const path = relative(project.input, file);
    return path !== '..' && !path.startsWith('..' + sep) && !path.startsWith(sep);
  });
}

function failure(cause: unknown): void {
  connection.console.error((cause as Error).message);
}

connection.onInitialize(params => {
  const initialization = params.initializationOptions as { targets?: Target[] } | null | undefined;
  const targets = initialization?.targets ?? defaultTargets;
  try { validateTargets(targets); }
  catch (cause) { throw new ResponseError(-32602, (cause as Error).message); }
  options = { targets };
  const roots = params.workspaceFolders?.map(folder => folder.uri) ?? (params.rootUri ? [params.rootUri] : []);
  const paths = [...new Set(roots)].map(uri => {
    if (!uri.startsWith('file:')) throw new ResponseError(-32602, 'Only file workspaces are supported.');
    return resolve(fileURLToPath(uri));
  }).sort((a, b) => a.length - b.length);
  for (const path of paths) {
    // One owner prevents nested workspace watchers from overwriting editor overlays.
    if (!projectFor(path)) projects.push(new ProjectService(path, options, publish, failure));
  }
  return { capabilities: { textDocumentSync: TextDocumentSyncKind.Incremental } };
});
connection.onInitialized(() => {
  for (const project of projects) void project.start().catch(failure);
});

documents.onDidChangeContent(event => {
  if (!event.document.uri.startsWith('file:') || event.document.languageId !== 'svelte') return;
  const file = fileURLToPath(event.document.uri);
  const project = projectFor(file);
  if (project) void project.open(file, event.document.getText()).catch(failure);
  else publish(file, event.document.getText(), analyze(event.document.getText(), file, options).diagnostics);
});
documents.onDidClose(event => {
  if (!event.document.uri.startsWith('file:')) return;
  const file = fileURLToPath(event.document.uri);
  const project = projectFor(file);
  if (project) void project.close(file).catch(failure);
  else publish(file, '', []);
});
connection.onShutdown(() => { for (const project of projects) project.dispose(); });
documents.listen(connection);
connection.listen();
