import { basename } from 'node:path';
import { parse } from 'svelte/compiler';
import type { AST } from 'svelte/compiler';
import ts from 'typescript';
import { defaultTargets, nativeBindings, nativeModule, validateTargets, versionBefore } from './bindings.js';
import { checkTypeScript } from './typecheck.js';
import type {
  Analysis, Argument, Assignment, CompilerOptions, Declaration, Diagnostic,
  Expression, Span, TextPart, ViewNode,
} from './types.js';

function span(node: unknown): Span {
  const value = node as { start?: unknown; end?: unknown };
  if (typeof value.start !== 'number' || typeof value.end !== 'number') {
    throw new Error('Parser node is missing its source range.');
  }
  return { start: value.start, end: value.end };
}

export function analyze(source: string, filename = 'Component.svelte', options: CompilerOptions = {}): Analysis {
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string, where: Span): void => {
    diagnostics.push({ code, message, start: Math.max(0, where.start), end: Math.min(source.length, where.end) });
  };
  const targets = options.targets ?? defaultTargets;
  try { validateTargets(targets); }
  catch (cause) {
    error('SV_TARGET', (cause as Error).message, { start: 0, end: 0 });
    return { diagnostics, ir: null };
  }
  let root: AST.Root;
  try { root = parse(source, { modern: true, filename }); }
  catch (cause) {
    const value = cause as { code?: string; message?: string; position?: number[] };
    const start = value.position?.[0] ?? 0;
    error('SV_PARSE', value.message ?? 'Unable to parse Svelte source.', { start, end: value.position?.[1] ?? start + 1 });
    return { diagnostics, ir: null };
  }
  const name = options.componentName ?? basename(filename, '.svelte');
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(name) || ['Any', 'Self', 'Protocol', 'Type', 'Swift', 'SwiftUI'].includes(name)) {
    error('SV_COMPONENT_NAME', 'Use a Swift type name beginning with an uppercase ASCII letter, or pass --name.', { start: 0, end: 0 });
  }
  if (root.module) error('SV_MODULE_SCRIPT', 'Module scripts are not supported yet. Use instance constants or $state.', span(root.module));
  if (root.css) error('SV_CSS', 'CSS is unavailable. Use supported native view arguments and modifiers.', span(root.css));
  if (root.options) error('SV_OPTIONS', 'Svelte compiler options are not part of the native subset.', span(root.options));

  const declarations: Declaration[] = [];
  const values = new Map<string, Declaration>();
  const imports = new Map<string, string>();
  const probes: Span[] = [];
  const scriptSpan = root.instance ? span(root.instance.content) : null;
  const scriptText = source.slice(0, scriptSpan?.start ?? 0).replace(/[^\r\n]/g, ' ')
    + (scriptSpan ? source.slice(scriptSpan.start, scriptSpan.end) : '');
  const scriptFile = ts.createSourceFile(filename + '.ts', scriptText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const where = (node: ts.Node, file: ts.SourceFile, base = 0): Span => ({ start: base + node.getStart(file), end: base + node.end });
  const validString = (text: string, location: Span): boolean => {
    for (const char of text) {
      const point = char.codePointAt(0)!;
      if (point >= 0xd800 && point <= 0xdfff) {
        error('SV_STRING', 'Unpaired UTF-16 surrogates cannot be represented as Swift strings.', location);
        return false;
      }
    }
    return true;
  };

  const lowerExpression = (node: ts.Expression, file: ts.SourceFile, base = 0): Expression | null => {
    const location = where(node, file, base);
    if (ts.isParenthesizedExpression(node)) return lowerExpression(node.expression, file, base);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return validString(node.text, location) ? { kind: 'literal', valueType: 'string', value: node.text, ...location } : null;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: 'literal', valueType: 'boolean', value: node.kind === ts.SyntaxKind.TrueKeyword, ...location };
    }
    if (ts.isIdentifier(node)) {
      const declaration = values.get(node.text);
      if (declaration) return { kind: 'reference', valueType: declaration.valueType, name: node.text, ...location };
      error('SV_UNKNOWN_VALUE', `Unknown native value '${node.text}'. Declare a string or Boolean constant or $state.`, location);
      return null;
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const operand = lowerExpression(node.operand, file, base);
      if (operand?.valueType === 'boolean') return { kind: 'not', valueType: 'boolean', operand, ...location };
      if (operand) error('SV_TYPE', 'Boolean negation requires a Boolean value; JavaScript truthiness is unsupported.', location);
      return null;
    }
    error('SV_EXPRESSION', 'Unsupported expression. This slice supports string/Boolean literals, declared values, and Boolean negation.', location);
    return null;
  };

  for (const attribute of root.instance?.attributes ?? []) {
    if (attribute.name !== 'lang' || !Array.isArray(attribute.value)
      || attribute.value.length !== 1 || attribute.value[0]?.type !== 'Text' || attribute.value[0].data !== 'ts') {
      error('SV_SCRIPT_ATTRIBUTE', 'Only lang="ts" is supported on instance scripts.', span(attribute));
    }
  }
  for (const statement of scriptFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== nativeModule
        || !clause || clause.name || clause.isTypeOnly || !clause.namedBindings
        || !ts.isNamedImports(clause.namedBindings) || statement.attributes) {
        error('SV_IMPORT', `Only named native view imports from '${nativeModule}' are supported yet.`, where(statement, scriptFile));
        continue;
      }
      for (const item of clause.namedBindings.elements) {
        const nativeName = (item.propertyName ?? item.name).text;
        if (item.isTypeOnly || !Object.hasOwn(nativeBindings, nativeName)) {
          error('SV_IMPORT', `No native view binding exists for '${nativeName}'.`, where(item, scriptFile));
        } else imports.set(item.name.text, nativeName);
      }
      continue;
    }
    if (!ts.isVariableStatement(statement) || statement.modifiers?.length) {
      error('SV_SCRIPT', 'Only native imports, const literals, and let values initialized with $state are supported.', where(statement, scriptFile));
      continue;
    }
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    const isLet = (statement.declarationList.flags & ts.NodeFlags.Let) !== 0;
    for (const declaration of statement.declarationList.declarations) {
      const location = where(declaration, scriptFile);
      if (!ts.isIdentifier(declaration.name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(declaration.name.text)) {
        error('SV_DECLARATION', 'Native values currently require plain ASCII identifier names without destructuring.', location);
        continue;
      }
      let initial = declaration.initializer;
      const state = !!initial && ts.isCallExpression(initial) && ts.isIdentifier(initial.expression)
        && initial.expression.text === '$state';
      if ((!isConst && !isLet) || (isConst && state) || (isLet && !state) || !initial) {
        error('SV_DECLARATION', 'Use const with a string/Boolean literal, or let name = $state(literal).', location);
        continue;
      }
      if (state && ts.isCallExpression(initial)) {
        if (initial.arguments.length !== 1 || initial.typeArguments?.length || initial.questionDotToken) {
          error('SV_STATE', '$state requires exactly one literal and no type arguments in this slice.', location);
          continue;
        }
        initial = initial.arguments[0]!;
      }
      const value = lowerExpression(initial, scriptFile);
      if (!value) continue;
      if (value.kind !== 'literal') {
        error('SV_INITIALIZER', 'Initializers must be string or Boolean literals; computed initial state is not supported yet.', location);
        continue;
      }
      if (declaration.type && declaration.type.kind !== (value.valueType === 'string' ? ts.SyntaxKind.StringKeyword : ts.SyntaxKind.BooleanKeyword)) {
        error('SV_TYPE', `This declaration requires the ${value.valueType} type.`, where(declaration.type, scriptFile));
        continue;
      }
      const item: Declaration = { name: declaration.name.text, initial: value.value, state, valueType: value.valueType, ...location };
      declarations.push(item);
      values.set(item.name, item);
    }
  }

  const parseExpression = (location: Span): { node: ts.Expression; file: ts.SourceFile; base: number } => {
    probes.push(location);
    const prefix = 'const __expression = (\n';
    const file = ts.createSourceFile('expression.ts', prefix + source.slice(location.start, location.end) + '\n);', ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const statement = file.statements[0];
    if (!statement || !ts.isVariableStatement(statement)) throw new Error('Unable to parse template expression.');
    const initializer = statement.declarationList.declarations[0]?.initializer;
    if (!initializer || !ts.isParenthesizedExpression(initializer)) throw new Error('Unable to parse template expression.');
    return { node: initializer.expression, file, base: location.start - prefix.length };
  };
  const templateExpression = (location: Span): Expression | null => {
    const parsed = parseExpression(location);
    return lowerExpression(parsed.node, parsed.file, parsed.base);
  };
  const action = (location: Span): Assignment[] | null => {
    const { node, file, base } = parseExpression(location);
    if (!ts.isArrowFunction(node) || node.parameters.length || node.modifiers?.length || node.typeParameters?.length) {
      error('SV_ACTION', 'Use a synchronous zero-argument arrow function containing state assignments.', location);
      return null;
    }
    const statements = ts.isBlock(node.body) ? node.body.statements : [node.body];
    const assignments: Assignment[] = [];
    for (const item of statements) {
      const statement = ts.isExpressionStatement(item) ? item.expression : item;
      if (!ts.isBinaryExpression(statement) || statement.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(statement.left)) {
        error('SV_ACTION', 'Button actions currently support only assignments to declared $state values.', where(statement, file, base));
        continue;
      }
      const target = values.get(statement.left.text);
      if (!target?.state) {
        error('SV_ACTION', `Assignment target '${statement.left.text}' must be a declared $state value.`, where(statement.left, file, base));
        continue;
      }
      const value = lowerExpression(statement.right, file, base);
      if (!value) continue;
      if (value.valueType !== target.valueType) {
        error('SV_TYPE', `Cannot assign ${value.valueType} to ${target.valueType} state '${target.name}'.`, where(statement.right, file, base));
        continue;
      }
      assignments.push({ name: target.name, value, ...where(statement, file, base) });
    }
    return assignments;
  };
  const textContent = (fragment: AST.Fragment): TextPart[] => {
    const result: TextPart[] = [];
    for (const node of fragment.nodes) {
      if (node.type === 'Comment') continue;
      if (node.type === 'Text') {
        if (validString(node.data, span(node))) result.push({ kind: 'text', value: node.data });
      } else if (node.type === 'ExpressionTag') {
        const value = templateExpression(span(node.expression));
        if (value) result.push({ kind: 'expression', value });
      } else error('SV_TEXT', 'Text and Button labels currently accept only literal text and string/Boolean expressions.', span(node));
    }
    return result;
  };

  const views = (fragment: AST.Fragment): ViewNode[] => {
    const result: ViewNode[] = [];
    for (const node of fragment.nodes) {
      if (node.type === 'Comment' || (node.type === 'Text' && node.data.trim() === '')) continue;
      if (node.type === 'IfBlock') {
        const condition = templateExpression(span(node.test));
        const consequent = views(node.consequent);
        const alternate = node.alternate ? views(node.alternate) : null;
        if (condition?.valueType === 'boolean') result.push({ kind: 'if', condition, consequent, alternate, ...span(node) });
        else if (condition) error('SV_TYPE', 'Native conditions require a Boolean; JavaScript truthiness is unsupported.', span(node.test));
        continue;
      }
      if (node.type !== 'Component') {
        error('SV_TEMPLATE', `Unsupported ${node.type}. Use imported native views and supported conditional blocks.`, span(node));
        continue;
      }
      const nativeName = imports.get(node.name);
      const binding = nativeName ? nativeBindings[nativeName] : undefined;
      if (!binding || !nativeName) {
        error('SV_VIEW', `Import '${node.name}' from '${nativeModule}' using an available native binding.`, span(node));
        continue;
      }
      for (const target of targets) {
        const minimum = binding.availability[target.platform];
        if (versionBefore(target.minimumVersion, minimum)) error('SV_AVAILABILITY', `${nativeName} requires ${target.platform} ${minimum}; target is ${target.minimumVersion}.`, span(node));
      }
      const args: Argument[] = [];
      const provided = new Set<string>();
      for (const attribute of node.attributes) {
        if (attribute.type !== 'Attribute') {
          error('SV_ATTRIBUTE', 'Directives, spreads, and attachments are not supported. Use declared native attributes.', span(attribute));
          continue;
        }
        const definition = Object.hasOwn(binding.properties, attribute.name) ? binding.properties[attribute.name] : undefined;
        if (!definition) {
          error('SV_ATTRIBUTE', `Unknown native attribute '${attribute.name}' on ${nativeName}.`, span(attribute));
          continue;
        }
        provided.add(attribute.name);
        const value = attribute.value;
        if (Array.isArray(value) || value === true) {
          error('SV_ATTRIBUTE', `Use an expression for '${attribute.name}', such as spacing={12}.`, span(attribute));
          continue;
        }
        const location = span(value.expression);
        if (definition.kind === 'action') {
          const assignments = action(location);
          if (assignments) args.push({ kind: 'action', name: attribute.name, assignments, ...span(attribute) });
        } else {
          const parsed = parseExpression(location);
          if (!ts.isNumericLiteral(parsed.node) || !Number.isFinite(Number(parsed.node.text)) || Number(parsed.node.text) < 0) {
            error('SV_ATTRIBUTE', `'${attribute.name}' requires a finite, nonnegative numeric literal.`, location);
          } else args.push({ kind: 'number', name: attribute.name, value: Number(parsed.node.text), ...span(attribute) });
        }
      }
      for (const [prop, definition] of Object.entries(binding.properties)) {
        if (definition.required && !provided.has(prop)) error('SV_ATTRIBUTE', `${nativeName} requires '${prop}'.`, span(node));
      }
      let children: ViewNode[] = [];
      let text: TextPart[] = [];
      if (binding.content === 'views') children = views(node.fragment);
      else if (binding.content === 'text' || binding.content === 'label') text = textContent(node.fragment);
      else if (node.fragment.nodes.some(child => child.type !== 'Comment' && (child.type !== 'Text' || child.data.trim() !== ''))) {
        error('SV_CHILDREN', `${nativeName} does not accept children.`, span(node));
      }
      result.push({ kind: 'view', binding: nativeName, arguments: args, text, children, ...span(node) });
    }
    return result;
  };
  const body = views(root.fragment);
  if (body.length === 0 && diagnostics.length === 0) error('SV_EMPTY', 'A component must contain at least one native view.', { start: 0, end: source.length });
  diagnostics.push(...checkTypeScript(source, scriptSpan, probes));
  diagnostics.sort((a, b) => a.start - b.start || a.code.localeCompare(b.code));
  return { diagnostics, ir: diagnostics.length ? null : { name, declarations, body } };
}
