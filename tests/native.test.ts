import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compile } from '../src/index.js';

for (const platform of ['macos', 'ios'] as const) {
  test(`generated SwiftUI typechecks against the ${platform} SDK`, {
    skip: process.platform !== 'darwin' ? 'Requires macOS and Xcode SDKs.' : false,
  }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'svelocity-native-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const sources = [
      ['Greeting', await readFile('examples/Greeting.svelte', 'utf8')],
      ['Layout', `<script>import { VStack, HStack, Text, Spacer } from '@svelocity/swiftui';</script>
<VStack><HStack /><Spacer minLength={8} padding={4}/><Text>Escaped: \\(text) &quot;quoted&quot; 😀</Text></VStack>`],
    ];
    const files: string[] = [];
    for (const [name, source] of sources) {
      const result = compile(source!, `${name}.svelte`);
      assert.deepEqual(result.diagnostics, []);
      const file = join(root, `${name}.swift`);
      await writeFile(file, result.swift!);
      files.push(file);
    }
    const sdkName = platform === 'macos' ? 'macosx' : 'iphonesimulator';
    const sdk = execFileSync('xcrun', ['--sdk', sdkName, '--show-sdk-path'], { encoding: 'utf8' }).trim();
    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
    const target = platform === 'macos' ? `${arch}-apple-macosx14.0` : `${arch}-apple-ios17.0-simulator`;
    const result = spawnSync('xcrun', ['--sdk', sdkName, 'swiftc', '-typecheck', '-sdk', sdk, '-target', target, ...files], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
