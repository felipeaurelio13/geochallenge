import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

describe('common translations', () => {
  it('provides the Passport general filter label in supported languages', () => {
    expect(es.common.all).toBe('Todos');
    expect(en.common.all).toBe('All');
  });
});

describe('static i18n keys used in source', () => {
  const srcRoot = resolve(__dirname, '..');
  const PLURAL_SUFFIXES = ['', '_zero', '_one', '_two', '_few', '_many', '_other', '_plural'];

  function collectSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        files.push(...collectSourceFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec|d)\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    }
    return files;
  }

  // Resolves dotted paths while tolerating flat dotted keys (e.g. "worldEvent.region.AFRICA").
  function hasPath(node: unknown, parts: string[]): boolean {
    if (parts.length === 0) return true;
    if (node === null || typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    for (let i = 1; i <= parts.length; i += 1) {
      const head = parts.slice(0, i).join('.');
      if (head in record && hasPath(record[head], parts.slice(i))) return true;
    }
    return false;
  }

  function hasKey(locale: unknown, key: string): boolean {
    return PLURAL_SUFFIXES.some((suffix) => {
      const parts = `${key}${suffix}`.split('.');
      return hasPath(locale, parts) && typeof resolveLeaf(locale, parts) !== 'object';
    });
  }

  function resolveLeaf(node: unknown, parts: string[]): unknown {
    if (parts.length === 0) return node;
    if (node === null || typeof node !== 'object') return undefined;
    const record = node as Record<string, unknown>;
    for (let i = 1; i <= parts.length; i += 1) {
      const head = parts.slice(0, i).join('.');
      if (head in record) {
        const leaf = resolveLeaf(record[head], parts.slice(i));
        if (leaf !== undefined) return leaf;
      }
    }
    return undefined;
  }

  // Only literal, dotted keys: t('a.b') / t("a.b"). Template/dynamic keys are skipped on purpose.
  const STATIC_T_CALL = /(?<![\w$])t\(\s*(['"])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1/g;

  it('has every statically referenced key in both es.json and en.json', () => {
    const usages = new Map<string, string>();
    for (const file of collectSourceFiles(srcRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(STATIC_T_CALL)) {
        const key = match[2];
        if (!usages.has(key)) usages.set(key, file.slice(srcRoot.length + 1));
      }
    }

    expect(usages.size).toBeGreaterThan(100);

    const missing: string[] = [];
    for (const [key, file] of usages) {
      const missingIn = [
        hasKey(es, key) ? null : 'es',
        hasKey(en, key) ? null : 'en',
      ].filter(Boolean);
      if (missingIn.length > 0) missing.push(`${key} (missing in ${missingIn.join(', ')}; used in ${file})`);
    }

    expect(missing).toEqual([]);
  });
});
