import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const destination = fileURLToPath(new URL('../', import.meta.url));
export const source = resolve(process.env.MIGRATION_SOURCE ?? join(destination, '../KiroxQuick_Flood-CTRL'));
// Repository identity, local settings, generated files, and this verification
// harness are deliberately outside application parity.
const excluded = new Set(['.git', 'node_modules', 'dist', 'dist-ssr', '.obsidian',
  '.DS_Store', 'coverage', 'verification', '.env', '.env.local']);

async function manifest(root, relative = '') {
  const entries = [];
  for (const name of (await readdir(join(root, relative))).sort()) {
    if (excluded.has(name) || name.endsWith('.local') || name.endsWith('.log')) continue;
    const path = join(relative, name);
    const stat = await lstat(join(root, path));
    if (stat.isDirectory()) entries.push(...await manifest(root, path));
    else {
      assert.ok(stat.isFile(), `Unsupported file type: ${path}`);
      const hash = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
      entries.push([path, hash]);
    }
  }
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

export async function verifyFiles() {
  const [expected, actual] = await Promise.all([manifest(source), manifest(destination)]);
  assert.deepEqual(actual, expected, 'Application file paths and SHA-256 hashes must match the source');
  return expected.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`PASS: ${await verifyFiles()} application files match ${source} byte for byte.`);
}
