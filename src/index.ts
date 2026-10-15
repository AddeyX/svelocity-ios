import { analyze } from './analyze.js';
import { emitSwift } from './swift.js';
import type { Compilation, CompilerOptions } from './types.js';

export { analyze } from './analyze.js';
export { defaultTargets, generateDeclarations, nativeBindings } from './bindings.js';
export { positionAt } from './types.js';
export type * from './types.js';

export function compile(source: string, filename = 'Component.svelte', options: CompilerOptions = {}): Compilation {
  const result = analyze(source, filename, options);
  return { ...result, swift: result.ir ? emitSwift(result.ir) : null };
}
