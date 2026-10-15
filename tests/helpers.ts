import { EventEmitter } from 'node:events';

export class Events<T> {
  readonly values: T[] = [];
  private readonly emitter = new EventEmitter();

  push(value: T): void {
    this.values.push(value);
    this.emitter.emit('value');
  }

  wait(predicate: (value: T) => boolean, after = 0, timeout = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const finish = (): void => {
        const value = this.values.slice(after).find(predicate);
        if (value === undefined) return;
        clearTimeout(timer);
        this.emitter.off('value', finish);
        resolve(value);
      };
      const timer = setTimeout(() => {
        this.emitter.off('value', finish);
        reject(new Error(`Timed out waiting for an event; received ${JSON.stringify(this.values.slice(after))}`));
      }, timeout);
      this.emitter.on('value', finish);
      finish();
    });
  }
}

export const simple = `<script lang="ts">import { Text } from '@svelocity/swiftui';</script><Text>Hello</Text>`;
export const invalid = '<div>Browser UI</div>';
