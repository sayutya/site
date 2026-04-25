#!/usr/bin/env node
// scenarios/*.html をスキャンして scenarios/manifest.json を生成するスクリプト
// 使い方: node generate-manifest.js

const fs   = require('fs');
const path = require('path');

const scenariosDir  = path.join(__dirname, 'scenarios');
const manifestPath  = path.join(scenariosDir, 'manifest.json');
const manifestJsPath = path.join(scenariosDir, 'manifest.js');

function getMeta(html, name) {
  const re1 = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : '';
}

function getTitle(html) {
  // <h1 class="scenario-title"> を優先
  const m1 = html.match(/<h1[^>]*class="[^"]*scenario-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (m1) return m1[1].replace(/<[^>]+>/g, '').trim();
  // <title> タグからシステム名部分を除去
  const m2 = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m2) return m2[1].replace(/\s*—.*/, '').trim();
  return '';
}

// 既存 manifest.json を読み込んで createdAt を保持する
let existingManifest = [];
try {
  if (fs.existsSync(manifestPath))
    existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch {}

const files = fs.readdirSync(scenariosDir)
  .filter(f => f.endsWith('.html'))
  .sort();

const manifest = files.map(file => {
  const filePath = path.join(scenariosDir, file);
  const html     = fs.readFileSync(filePath, 'utf-8');
  const stat     = fs.statSync(filePath);

  const title      = getMeta(html, 'sc-title')      || getTitle(html);
  const system     = getMeta(html, 'sc-system');
  const players    = getMeta(html, 'sc-players');
  const playtime   = getMeta(html, 'sc-time');
  const regulation = getMeta(html, 'sc-regulation');
  const type       = getMeta(html, 'sc-type');
  const tagsStr    = getMeta(html, 'sc-tags');
  const tags       = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
  const synopsis   = getMeta(html, 'sc-synopsis');

  // 日付: meta > ファイル更新日時
  const updatedAt  = getMeta(html, 'sc-updated') || stat.mtime.toISOString();
  // createdAt: 既存 manifest の値を優先して保持（初回は birthtime or ctime）
  const existing   = existingManifest.find(e => e.file === file);
  const createdAt  = existing?.createdAt || getMeta(html, 'sc-created') || stat.birthtime?.toISOString() || stat.ctime.toISOString();

  return { file, title, system, players, playtime, regulation, type, tags, synopsis, createdAt, updatedAt };
});

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

// manifest.js — <script> タグで読み込み可能。file:// でも動作する
const jsContent = `window.__SCENARIO_MANIFEST__ = ${JSON.stringify(manifest, null, 2)};\n`;
fs.writeFileSync(manifestJsPath, jsContent, 'utf-8');

console.log(`✓ manifest.json / manifest.js を生成しました (${manifest.length} シナリオ)`);
manifest.forEach(sc => console.log(`  - ${sc.file}: ${sc.title}`));
