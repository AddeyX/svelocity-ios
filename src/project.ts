import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { analyze } from './analyze.js';
import type { CompilerOptions, Diagnostic } from './types.js';

const ignored = new Set(['.git', 'node_modules', 'dist', 'generated', '.cache']);
const missing = (cause: unknown): boolean => (cause as NodeJS.ErrnoException).code === 'ENOENT';

export async function discoverComponents(input: string): Promise<string[]> {
  const path = resolve(input);
  const info = await stat(path);
  if (info.isFile()) {
    if (!path.endsWith('.svelte')) throw new Error(`Expected a .svelte file: ${path}`);
    return [path];
  }
  if (!info.isDirectory()) throw new Error(`Expected a file or directory: ${path}`);
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (cause) { if (missing(cause)) return; throw cause; }
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name)) await visit(join(directory, entry.name));
      else if (entry.isFile() && entry.name.endsWith('.svelte')) files.push(join(directory, entry.name));
    }
  }
  await visit(path);
  return files.sort();
}

export type DiagnosticReporter = (file: string, source: string, diagnostics: Diagnostic[]) => void;

/** Files are independent until user-component imports are supported. */
export class ProjectService {
  private readonly overlays = new Map<string, string>();
  private readonly known = new Set<string>();
  private watcher: FSWatcher | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private readonly pending = new Set<string>();
  private rescan = false;

  constructor(
    readonly input: string,
    private readonly options: CompilerOptions,
    private readonly report: DiagnosticReporter,
    private readonly onError: (cause: unknown) => void,
  ) {}

  async checkFile(input: string): Promise<void> {
    const file = resolve(input);
    let source = this.overlays.get(file);
    if (source === undefined) {
      try { source = await readFile(file, 'utf8'); }
      catch (cause) {
        if (!missing(cause)) throw cause;
        // An editor may have opened an unsaved file while disk I/O was pending.
        source = this.overlays.get(file);
        if (source === undefined) {
          this.known.delete(file);
          if (!this.disposed) this.report(file, '', []);
          return;
        }
      }
    }
    source = this.overlays.get(file) ?? source;
    if (this.disposed) return;
    this.known.add(file);
    this.report(file, source, analyze(source, file, this.options).diagnostics);
  }

  async checkAll(): Promise<number> {
    const files = new Set(await discoverComponents(this.input));
    for (const file of this.overlays.keys()) files.add(file);
    for (const old of this.known) {
      if (!files.has(old)) {
        this.known.delete(old);
        if (!this.disposed) this.report(old, '', []);
      }
    }
    for (const file of files) await this.checkFile(file);
    return files.size;
  }

  async open(file: string, source: string): Promise<void> {
    this.overlays.set(resolve(file), source);
    await this.checkFile(file);
  }

  async close(file: string): Promise<void> {
    this.overlays.delete(resolve(file));
    await this.checkFile(file);
  }

  async start(): Promise<number> {
    const input = resolve(this.input);
    const info = await stat(input);
    const root = info.isDirectory() ? input : dirname(input);
    if (this.disposed) return 0;
    if (this.watcher) throw new Error('Project watcher already started.');
    this.watcher = watch(root, { recursive: true }, (_event, name) => {
      if (!name || this.disposed) return;
      const path = resolve(root, name.toString());
      if (!info.isDirectory() && path !== input) return;
      const parts = relative(root, path).split(sep);
      if (parts.some(part => ignored.has(part))) return;
      if (path.endsWith('.svelte')) this.pending.add(path);
      else if (_event === 'rename') this.rescan = true;
      else return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const pending = [...this.pending];
        const rescan = this.rescan;
        this.pending.clear();
        this.rescan = false;
        void (async () => {
          if (rescan) await this.checkAll();
          else for (const file of pending) await this.checkFile(file);
        })().catch(this.onError);
      }, 75);
    });
    this.watcher.on('error', this.onError);
    try { return await this.checkAll(); }
    catch (cause) { this.dispose(); throw cause; }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.watcher?.close();
  }
}
