export interface Span { start: number; end: number }
export interface Diagnostic extends Span { code: string; message: string }
export type Platform = 'ios' | 'macos';
export interface Target { platform: Platform; minimumVersion: string }
export interface CompilerOptions { targets?: readonly Target[]; componentName?: string }
export type ScalarType = 'string' | 'boolean';

export type Expression = Span & (
  | { kind: 'literal'; valueType: ScalarType; value: string | boolean }
  | { kind: 'reference'; valueType: ScalarType; name: string }
  | { kind: 'not'; valueType: 'boolean'; operand: Expression }
);
export interface Declaration extends Span {
  name: string;
  valueType: ScalarType;
  initial: string | boolean;
  state: boolean;
}
export interface Assignment extends Span { name: string; value: Expression }
export type Argument = Span & (
  | { kind: 'number'; name: string; value: number }
  | { kind: 'action'; name: string; assignments: Assignment[] }
);
export type TextPart = { kind: 'text'; value: string } | { kind: 'expression'; value: Expression };
export type ViewNode = Span & (
  | { kind: 'view'; binding: string; arguments: Argument[]; text: TextPart[]; children: ViewNode[] }
  | { kind: 'if'; condition: Expression; consequent: ViewNode[]; alternate: ViewNode[] | null }
);
export interface ComponentIR {
  name: string;
  declarations: Declaration[];
  body: ViewNode[];
}
export interface Analysis {
  diagnostics: Diagnostic[];
  ir: ComponentIR | null;
}
export interface Compilation extends Analysis { swift: string | null }

export function positionAt(source: string, offset: number): { line: number; character: number } {
  const bounded = Math.max(0, Math.min(source.length, offset));
  let line = 0;
  let start = 0;
  for (let i = 0; i < bounded; i++) {
    if (source[i] === '\r' || source[i] === '\n') {
      const next = i + (source[i] === '\r' && source[i + 1] === '\n' ? 2 : 1);
      if (next > bounded) break;
      line++;
      start = next;
      i = next - 1;
    }
  }
  return { line, character: bounded - start };
}
