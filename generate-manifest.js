#!/usr/bin/env node
// scenarios/*.html をスキャンして scenarios/manifest.json を生成するスクリプト
// 使い方: node generate-manifest.js
//
// 同名の "_gm.html" と "_pl.html" は1エントリにまとめる：
//   file   = GM版（または単独ファイル）
//   plFile = PL版（あれば）
// フロントエンド（index.html）は sc.plFile を優先してリンクする。

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

// "_gm.html" / "_pl.html" のサフィックスを除いたベース名（ペア判定用）
function getBaseName(file) {
  return file.replace(/_(gm|pl)\.html$/i, '');
}
function isGm(file) { return /_gm\.html$/i.test(file); }
function isPl(file) { return /_pl\.html$/i.test(file); }

// 既存 manifest.json を読み込んで createdAt を保持する
let existingManifest = [];
try {
  if (fs.existsSync(manifestPath))
    existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch {}

const files = fs.readdirSync(scenariosDir)
  .filter(f => f.endsWith('.html'))
  .sort();

// ベース名でグルーピング: { base: { gm, pl, solo } }
const groups = new Map();
for (const file of files) {
  const base = getBaseName(file);
  if (!groups.has(base)) groups.set(base, {});
  const g = groups.get(base);
  if      (isGm(file)) g.gm = file;
  else if (isPl(file)) g.pl = file;
  else                 g.solo = file;
}

function parseEntry(file) {
  const filePath = path.join(scenariosDir, file);
  const html     = fs.readFileSync(filePath, 'utf-8');
  const stat     = fs.statSync(filePath);
  return {
    file,
    stat,
    title:      getMeta(html, 'sc-title')      || getTitle(html),
    system:     getMeta(html, 'sc-system'),
    players:    getMeta(html, 'sc-players'),
    playtime:   getMeta(html, 'sc-time'),
    regulation: getMeta(html, 'sc-regulation'),
    type:       getMeta(html, 'sc-type'),
    tagsStr:    getMeta(html, 'sc-tags'),
    synopsis:   getMeta(html, 'sc-synopsis'),
    updatedMeta:getMeta(html, 'sc-updated'),
    createdMeta:getMeta(html, 'sc-created'),
  };
}

// 2つの値のうち、最初の非空を採用
const pick = (a, b) => (a && a.trim()) ? a : (b || '');

const manifest = [];
for (const [base, g] of groups) {
  // メタデータは PL を優先（プレイヤー向けが公開用）。空欄は GM/solo で補完
  const primary   = g.pl ? parseEntry(g.pl) : (g.gm ? parseEntry(g.gm) : parseEntry(g.solo));
  const secondary = g.pl && g.gm ? parseEntry(g.gm) : null;

  const title      = pick(primary.title,      secondary?.title);
  const system     = pick(primary.system,     secondary?.system);
  const players    = pick(primary.players,    secondary?.players);
  const playtime   = pick(primary.playtime,   secondary?.playtime);
  const regulation = pick(primary.regulation, secondary?.regulation);
  const type       = pick(primary.type,       secondary?.type);
  const tagsStr    = pick(primary.tagsStr,    secondary?.tagsStr);
  const tags       = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
  const synopsis   = pick(primary.synopsis,   secondary?.synopsis);

  // 日付：両方の mtime のうち新しい方を採用
  const mtimes = [primary, secondary].filter(Boolean).map(p => p.stat.mtime.getTime());
  const newestMtime = new Date(Math.max(...mtimes));
  const updatedAt = pick(primary.updatedMeta, secondary?.updatedMeta) || newestMtime.toISOString();

  // file / plFile の決定
  // - GM ファイルを主、PL ファイルを副リンクとする（フロントエンドは plFile を優先表示する）
  // - GM が無く PL のみなら file = PL
  // - 単独ファイルは file = solo
  const fileMain = g.gm || g.solo || g.pl;
  const plFile   = (g.pl && (g.gm || g.solo)) ? g.pl : undefined;

  // createdAt: 既存 manifest から file/plFile のいずれかが一致するエントリを引き継ぐ
  const existing = existingManifest.find(e =>
    e.file === fileMain || e.file === plFile ||
    e.plFile === fileMain || (plFile && e.plFile === plFile)
  );
  const birth = primary.stat.birthtime?.toISOString() || primary.stat.ctime.toISOString();
  const createdAt = existing?.createdAt
    || pick(primary.createdMeta, secondary?.createdMeta)
    || birth;

  const entry = {
    file: fileMain,
    title, system, players, playtime, regulation, type, tags, synopsis,
    createdAt, updatedAt
  };
  if (plFile) entry.plFile = plFile;
  manifest.push(entry);
}

// ファイル名順で安定ソート
manifest.sort((a, b) => a.file.localeCompare(b.file, 'ja'));

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

// manifest.js — <script> タグで読み込み可能。file:// でも動作する
const jsContent = `window.__SCENARIO_MANIFEST__ = ${JSON.stringify(manifest, null, 2)};\n`;
fs.writeFileSync(manifestJsPath, jsContent, 'utf-8');

console.log(`✓ manifest.json / manifest.js を生成しました (${manifest.length} シナリオ)`);
manifest.forEach(sc => {
  const pair = sc.plFile ? ` (+ ${sc.plFile})` : '';
  console.log(`  - ${sc.file}${pair}: ${sc.title}`);
});
