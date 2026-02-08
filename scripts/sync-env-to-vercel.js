#!/usr/bin/env node
/**
 * Sync env vars from .env.local to Vercel (preview + production).
 * Skips VERCEL_OIDC_TOKEN (set by Vercel). Uses temp files to avoid shell history.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env.local');
const skipKeys = new Set(['VERCEL_OIDC_TOKEN']);

if (!fs.existsSync(envPath)) {
  console.error('.env.local not found');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const vars = [];

for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
  if (skipKeys.has(key)) continue;
  vars.push([key, value]);
}

const tmpDir = require('os').tmpdir();
let added = 0;
let failed = 0;

for (const [key, value] of vars) {
  const tmpFile = path.join(tmpDir, `vercel-env-${key}-${Date.now()}`);
  try {
    fs.writeFileSync(tmpFile, value, 'utf8');
    const cwd = path.join(__dirname, '..');
    for (const env of ['preview', 'production']) {
      const fd = fs.openSync(tmpFile, 'r');
      try {
        const result = spawnSync('vercel', ['env', 'add', key, env, '--force'], {
          stdio: [fd, 'inherit', 'inherit'],
          cwd,
        });
        if (result.status !== 0) throw new Error(result.error || result.signal || `exit ${result.status}`);
      } finally {
        fs.closeSync(fd);
      }
      added++;
      console.log(`Set ${key} for ${env}`);
    }
  } catch (err) {
    failed++;
    console.error(`Failed for ${key}:`, err.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

console.log(`Done. Added/updated ${added} variable slots, ${failed} failures.`);
