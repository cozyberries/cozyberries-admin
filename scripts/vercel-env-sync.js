#!/usr/bin/env node
/**
 * Sync required env vars from .env.local to Vercel (production + preview).
 * Usage: node scripts/vercel-env-sync.js
 * Requires: vercel CLI linked to cozyberries-admin and .env.local present.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
  else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
  env[key] = value;
}

const varsToSync = ['JWT_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
const envs = ['production', 'preview'];

for (const name of varsToSync) {
  const value = env[name];
  if (!value) {
    console.warn(`Skip ${name}: not found in .env.local`);
    continue;
  }
  for (const envType of envs) {
    try {
      execSync(`vercel env add ${name} ${envType} --force`, {
        input: value,
        stdio: ['pipe', 'inherit', 'inherit'],
        cwd: path.join(__dirname, '..'),
      });
      console.log(`Set ${name} for ${envType}`);
    } catch (e) {
      console.error(`Failed to set ${name} for ${envType}:`, e.message);
    }
  }
}

console.log('Done syncing env vars. Redeploy with: vercel --prod');