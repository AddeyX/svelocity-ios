import type { Target } from './types.js';

export const nativeModule = '@svelocity/swiftui';
export interface NativeProperty {
  kind: 'number' | 'action';
  swiftName: string;
  placement: 'initializer' | 'modifier';
  required?: boolean;
}
export interface NativeBinding {
  swiftName: string;
  content: 'views' | 'text' | 'label' | 'none';
  properties: Readonly<Record<string, NativeProperty>>;
  availability: Readonly<Record<Target['platform'], string>>;
}
const padding: NativeProperty = { kind: 'number', swiftName: 'padding', placement: 'modifier' };
const spacing: NativeProperty = { kind: 'number', swiftName: 'spacing', placement: 'initializer' };
const availability = { ios: '13.0', macos: '10.15' };

// This registry drives validation, native calls, and authoring declarations.
export const nativeBindings: Readonly<Record<string, NativeBinding>> = {
  VStack: { swiftName: 'SwiftUI.VStack', content: 'views', properties: { spacing, padding }, availability },
  HStack: { swiftName: 'SwiftUI.HStack', content: 'views', properties: { spacing, padding }, availability },
  Text: { swiftName: 'SwiftUI.Text', content: 'text', properties: { padding }, availability },
  Button: {
    swiftName: 'SwiftUI.Button', content: 'label', availability,
    properties: { onclick: { kind: 'action', swiftName: 'action', placement: 'initializer', required: true }, padding },
  },
  Spacer: {
    swiftName: 'SwiftUI.Spacer', content: 'none', availability,
    properties: { minLength: { kind: 'number', swiftName: 'minLength', placement: 'initializer' }, padding },
  },
};

export const defaultTargets: readonly Target[] = [
  { platform: 'ios', minimumVersion: '17.0' },
  { platform: 'macos', minimumVersion: '14.0' },
];

export function validateTargets(targets: readonly Target[]): void {
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('At least one Apple target is required in a targets array.');
  const seen = new Set<string>();
  for (const target of targets) {
    if (!target || !['ios', 'macos'].includes(target.platform)
        || typeof target.minimumVersion !== 'string' || !/^\d+(\.\d+){0,2}$/.test(target.minimumVersion)
        || !target.minimumVersion.split('.').every((part: string) => Number.isSafeInteger(Number(part)))) {
      throw new Error('Targets require platform ios or macos and a numeric minimumVersion (for example 17.0).');
    }
    if (seen.has(target.platform)) throw new Error(`Duplicate target: ${target.platform}.`);
    seen.add(target.platform);
  }
}

export function versionBefore(actual: string, required: string): boolean {
  const a = actual.split('.').map(Number);
  const b = required.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

export function generateDeclarations(): string {
  const lines = [
    '// Generated from the native binding registry. Do not edit.',
    'declare function $state(initial: string): string;',
    'declare function $state(initial: boolean): boolean;',
    `declare module '${nativeModule}' {`,
    '  export interface NativeView { readonly __nativeView: unique symbol }',
  ];
  for (const [name, binding] of Object.entries(nativeBindings)) {
    lines.push(`  export function ${name}(props: {`);
    for (const [prop, definition] of Object.entries(binding.properties)) {
      const type = definition.kind === 'number' ? 'number' : '() => void';
      lines.push(`    ${prop}${definition.required ? '' : '?'}: ${type};`);
    }
    if (binding.content !== 'none') {
      lines.push(`    children?: ${binding.content === 'views' ? 'NativeView | NativeView[]' : 'string | boolean'};`);
    }
    lines.push('  }): NativeView;');
  }
  return [...lines, '}', ''].join('\n');
}
