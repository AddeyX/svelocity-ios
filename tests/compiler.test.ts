import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { analyze, compile, generateDeclarations, nativeBindings, positionAt } from '../src/index.js';
import { swiftString } from '../src/swift.js';
import { simple } from './helpers.js';

const component = (script: string, body: string): string => `<script lang="ts">
import { VStack, HStack, Text, Button, Spacer } from '@svelocity/swiftui';
${script}
</script>
${body}`;

test('compiles the interactive example to the expected SwiftUI source', () => {
  const source = readFileSync('examples/Greeting.svelte', 'utf8');
  const expected = readFileSync('tests/fixtures/Greeting.swift', 'utf8');
  const result = compile(source, 'Greeting.svelte');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.swift, expected);
  assert.equal(result.ir?.declarations.find(d => d.name === 'expanded')?.state, true);
});

test('native import aliases retain their Swift API identity', () => {
  const result = compile(`<script lang="ts">import { VStack as Column, Text as Label } from '@svelocity/swiftui';</script>
<Column spacing={0}><Label>Hello &amp; welcome</Label></Column>`, 'Aliased.svelte');
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.swift!, /SwiftUI\.VStack\(spacing: 0\)/);
  assert.match(result.swift!, /SwiftUI\.Text\(verbatim: "Hello & welcome"\)/);
});

test('supports nested views, empty builders, and native layout modifiers', () => {
  const result = compile(component('', '<VStack><HStack /><Spacer minLength={8} padding={2} /></VStack>'));
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.swift!, /SwiftUI\.HStack\(\) \{/);
  assert.match(result.swift!, /SwiftUI\.Spacer\(minLength: 8\)/);
  assert.match(result.swift!, /\.padding\(2\)/);
});

test('supports typed constants, string state, sequential assignments, and else-if', () => {
  const result = compile(component(`const title: string = 'Hello';
let message: string = $state('First');
let enabled: boolean = $state(false);`, `<VStack>
<Button onclick={() => { message = title; enabled = !enabled; }}>Change</Button>
{#if enabled}<Text>{message}</Text>{:else if !enabled}<Text>{false}</Text>{/if}
</VStack>`));
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.swift!, /sv_message = sv_title; sv_enabled = !\(sv_enabled\)/);
  assert.match(result.swift!, /else \{\n\s+if !\(sv_enabled\)/);
});

test('source identifiers cannot collide with Swift keywords or View members', () => {
  const result = compile(component(`let self = $state('Safe'); const body = true;`, '<Text>{self} {body}</Text>'), 'Text.svelte');
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.swift!, /struct Text: SwiftUI\.View/);
  assert.match(result.swift!, /sv_self: Swift\.String/);
  assert.match(result.swift!, /sv_body: Swift\.Bool/);
});

test('Swift strings escape interpolation, quotes, control characters, and backslashes', () => {
  assert.equal(swiftString('Hello "\\(unsafe)"\n\t\0 😀'), '"Hello \\"\\\\(unsafe)\\"\\n\\t\\u{0} 😀"');
  const result = compile(component(`const title = ${JSON.stringify('\\(injected) "quoted"\n😀')};`, '<Text>{title}</Text>'));
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.swift!.includes('\\\\(injected) \\"quoted\\"\\n😀'));
});

test('text whitespace is preserved verbatim and layout whitespace is ignored', () => {
  const result = compile(component('', '<VStack>\n  <Text> one\n two </Text>\n</VStack>'));
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.swift!, /verbatim: " one\\n two "/);
});

const rejected: Array<[string, string, string]> = [
  ['browser elements', '<div>Hello</div>', 'SV_TEMPLATE'],
  ['CSS', simple + '<style>p { color: red; }</style>', 'SV_CSS'],
  ['module scripts', '<script module>const value = true;</script>' + simple, 'SV_MODULE_SCRIPT'],
  ['compiler options', '<svelte:options runes={true}/>' + simple, 'SV_OPTIONS'],
  ['runtime package imports', component("import utility from 'some-package';", '<Text>Hello</Text>'), 'SV_IMPORT'],
  ['unknown native imports', "<script>import { WebView } from '@svelocity/swiftui';</script><WebView />", 'SV_IMPORT'],
  ['prototype native imports', "<script>import { constructor as Unknown } from '@svelocity/swiftui';</script><Unknown />", 'SV_IMPORT'],
  ['unimported components', '<Text>Hello</Text>', 'SV_VIEW'],
  ['number state', component('let count = $state(0);', '<Text>Hello</Text>'), 'SV_EXPRESSION'],
  ['object state', component("let item = $state({ title: 'Hello' });", '<Text>Hello</Text>'), 'SV_EXPRESSION'],
  ['plain mutable variables', component("let title = 'Hello';", '<Text>{title}</Text>'), 'SV_DECLARATION'],
  ['var declarations', component("var title = 'Hello';", '<Text>{title}</Text>'), 'SV_DECLARATION'],
  ['computed initial state', component("const title = 'Hello'; let message = $state(title);", '<Text>{message}</Text>'), 'SV_INITIALIZER'],
  ['reactive effects', component('$effect(() => {});', '<Text>Hello</Text>'), 'SV_SCRIPT'],
  ['exported props', component("export let title = 'Hello';", '<Text>Hello</Text>'), 'SV_SCRIPT'],
  ['destructuring', component("const { title } = { title: 'Hello' };", '<Text>Hello</Text>'), 'SV_DECLARATION'],
  ['generic state', component("let title = $state<string>('Hello');", '<Text>Hello</Text>'), 'SV_STATE'],
  ['browser calls', component('const element = document.querySelector("p");', '<Text>Hello</Text>'), 'SV_EXPRESSION'],
  ['template calls', component('', '<Text>{String(true)}</Text>'), 'SV_EXPRESSION'],
  ['numeric interpolation', component('', '<Text>{123}</Text>'), 'SV_EXPRESSION'],
  ['truthy conditions', component("const label = 'Hello';", '{#if label}<Text>Hello</Text>{/if}'), 'SV_TYPE'],
  ['truthy negation', component("const label = 'Hello';", '<Text>{!label}</Text>'), 'SV_TYPE'],
  ['loops', component('', '{#each [1] as item}<Text>Hello</Text>{/each}'), 'SV_TEMPLATE'],
  ['raw HTML', component("const html = 'Hello';", '{@html html}'), 'SV_TEMPLATE'],
  ['unknown modifiers', component('', '<Text color="red">Hello</Text>'), 'SV_ATTRIBUTE'],
  ['prototype attributes', component('', '<Text constructor={1}>Hello</Text>'), 'SV_ATTRIBUTE'],
  ['quoted layout numbers', component('', '<VStack spacing="12" />'), 'SV_ATTRIBUTE'],
  ['negative spacing', component('', '<VStack spacing={-1} />'), 'SV_ATTRIBUTE'],
  ['infinite spacing', component('', '<VStack spacing={1e999} />'), 'SV_ATTRIBUTE'],
  ['spread attributes', component('', '<Text {...{}}>Hello</Text>'), 'SV_ATTRIBUTE'],
  ['binding directives', component("let value = $state('');", '<Text bind:value>Hello</Text>'), 'SV_ATTRIBUTE'],
  ['children on Spacer', component('', '<Spacer><Text>Hello</Text></Spacer>'), 'SV_CHILDREN'],
  ['views inside Text', component('', '<Text><Spacer /></Text>'), 'SV_TEXT'],
  ['missing button action', component('', '<Button>Hello</Button>'), 'SV_ATTRIBUTE'],
  ['async actions', component('', '<Button onclick={async () => {}}>Hello</Button>'), 'SV_ACTION'],
  ['parameterized actions', component('', '<Button onclick={(event) => {}}>Hello</Button>'), 'SV_ACTION'],
  ['action calls', component('', '<Button onclick={() => console.log("Hello")}>Hello</Button>'), 'SV_ACTION'],
  ['constant mutation', component("const title = 'Hello';", '<Button onclick={() => title = "Other"}>Hello</Button>'), 'SV_ACTION'],
  ['mismatched assignment', component('let enabled = $state(false);', '<Button onclick={() => enabled = "true"}>Hello</Button>'), 'SV_TYPE'],
  ['mismatched annotation', component("const title: boolean = 'Hello';", '<Text>Hello</Text>'), 'SV_TYPE'],
  ['unpaired surrogate', component("const title = '\\uD800';", '<Text>{title}</Text>'), 'SV_STRING'],
  ['empty components', '<!-- Nothing -->', 'SV_EMPTY'],
  ['malformed Svelte', '<Text>', 'SV_PARSE'],
];
for (const [name, source, code] of rejected) {
  test(`rejects ${name} without producing Swift`, () => {
    const result = compile(source);
    assert.equal(result.swift, null);
    assert.equal(result.ir, null);
    assert.ok(result.diagnostics.some(d => d.code === code), JSON.stringify(result.diagnostics));
    for (const diagnostic of result.diagnostics) {
      assert.ok(diagnostic.start >= 0 && diagnostic.end <= source.length && diagnostic.end >= diagnostic.start);
    }
  });
}

test('TypeScript checks declarations and maps template errors to authored offsets', () => {
  const source = component('', '<Text>{missing}</Text>');
  const diagnostic = analyze(source).diagnostics.find(d => d.code === 'SV_TS_2304');
  assert.ok(diagnostic);
  assert.equal(diagnostic.start, source.indexOf('missing'));
  assert.equal(source.slice(diagnostic.start, diagnostic.end), 'missing');
  const mismatch = analyze(component('const title: string = false;', '<Text>{title}</Text>'));
  assert.ok(mismatch.diagnostics.some(d => d.code === 'SV_TS_2322'));
});

test('availability is checked for every selected target', () => {
  assert.ok(analyze(simple, 'App.svelte', { targets: [{ platform: 'ios', minimumVersion: '12.0' }] }).diagnostics.some(d => d.code === 'SV_AVAILABILITY'));
  assert.ok(analyze(simple, 'App.svelte', { targets: [{ platform: 'macos', minimumVersion: '10.14' }] }).diagnostics.some(d => d.code === 'SV_AVAILABILITY'));
  assert.deepEqual(analyze(simple, 'App.svelte', { targets: [{ platform: 'ios', minimumVersion: '13' }] }).diagnostics, []);
  assert.deepEqual(analyze(simple, 'App.svelte', { targets: [{ platform: 'macos', minimumVersion: '10.15.0' }] }).diagnostics, []);
});

test('invalid targets and component names are diagnostics, not generated source', () => {
  assert.equal(compile(simple, 'App.svelte', { targets: [] }).diagnostics[0]?.code, 'SV_TARGET');
  assert.equal(compile(simple, 'App.svelte', { targets: [{ platform: 'ios', minimumVersion: 'latest' }] }).diagnostics[0]?.code, 'SV_TARGET');
  assert.equal(compile(simple, '+page.svelte').diagnostics[0]?.code, 'SV_COMPONENT_NAME');
  assert.equal(compile(simple, 'SwiftUI.svelte').diagnostics[0]?.code, 'SV_COMPONENT_NAME');
  assert.deepEqual(compile(simple, '+page.svelte', { componentName: 'Page' }).diagnostics, []);
});

test('generated declarations reflect every native view and are valid TypeScript', () => {
  const declaration = generateDeclarations();
  for (const name of Object.keys(nativeBindings)) assert.ok(declaration.includes(`export function ${name}(`));
  const file = ts.createSourceFile('native.d.ts', declaration, ts.ScriptTarget.ES2022, true);
  const host = ts.createCompilerHost({ noEmit: true, types: [] });
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, ...args) => path === '/native.d.ts' ? file : original(path, ...args);
  const program = ts.createProgram(['/native.d.ts'], { noEmit: true, types: [] }, host);
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('positions use UTF-16 offsets, as required by the language server', () => {
  assert.deepEqual(positionAt('😀\r\nHello', 7), { line: 1, character: 3 });
  assert.deepEqual(positionAt('one\rtwo', 6), { line: 1, character: 2 });
});
