import ts from 'typescript';
import { generateDeclarations } from './bindings.js';
import type { Diagnostic, Span } from './types.js';

const libraryCache = new Map<string, ts.SourceFile>();
const declarations = generateDeclarations();

/** Check script and template probes together, retaining authored source offsets. */
export function checkTypeScript(source: string, script: Span | null, probes: Span[]): Diagnostic[] {
  const componentPath = '/__svelocity__/Component.ts';
  const declarationsPath = '/__svelocity__/native.d.ts';
  let virtual = source.replace(/[^\r\n]/g, ' ');
  if (script) virtual = virtual.slice(0, script.start) + source.slice(script.start, script.end) + virtual.slice(script.end);
  const mappings: Array<Span & { original: Span }> = [];
  for (const probe of probes) {
    virtual += '\nvoid(\n';
    const start = virtual.length;
    virtual += source.slice(probe.start, probe.end);
    mappings.push({ start, end: virtual.length, original: probe });
    virtual += '\n);\n';
  }
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    strict: true, noEmit: true, types: [], lib: ['lib.es2022.d.ts'],
  };
  const host = ts.createCompilerHost(options);
  const originalGet = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path === componentPath) return ts.createSourceFile(path, virtual, languageVersion, true);
    if (path === declarationsPath) return ts.createSourceFile(path, declarations, languageVersion, true);
    if (path.endsWith('.d.ts')) {
      let cached = libraryCache.get(path);
      if (!cached) {
        cached = originalGet(path, languageVersion, onError, shouldCreateNewSourceFile);
        if (cached) libraryCache.set(path, cached);
      }
      return cached;
    }
    return originalGet(path, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram([componentPath, declarationsPath], options, host);
  return ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => {
    let start = d.start ?? 0;
    let end = start + (d.length ?? 1);
    const mapping = mappings.find(item => start >= item.start && start <= item.end);
    if (mapping) {
      end = Math.min(mapping.original.end, mapping.original.start + end - mapping.start);
      start = mapping.original.start + start - mapping.start;
    } else if (d.file?.fileName !== componentPath || start >= source.length) {
      start = 0;
      end = Math.min(1, source.length);
    }
    return { start, end, code: `SV_TS_${d.code}`, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') };
  });
}
