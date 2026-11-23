// main.ts — VICE BAY 3D dossier entrypoint (Node 22, stdlib only);
// copies game/ + screenshots/ and writes dossier.json via buildDossier (makefun/dossier/v1);
// run: node main.ts [outputDir] (or set MAKEFUN_OUTPUT_DIR).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? process.argv[2] ?? join(repoRoot, 'output');

mkdirSync(outDir, { recursive: true });

for (const folder of ['game', 'screenshots']) {
  const source = join(repoRoot, folder);
  if (existsSync(source)) {
    cpSync(source, join(outDir, folder), { recursive: true });
  }
}

const dossierResult = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

const dossierJson = typeof dossierResult === 'string'
  ? dossierResult
  : Buffer.from(dossierResult).toString('utf8');
writeFileSync(join(outDir, 'dossier.json'), dossierJson);

const dossier = JSON.parse(dossierJson);
console.log('dossier.json:', Buffer.byteLength(dossierJson), 'bytes');
console.log('text:', Buffer.byteLength(dossier.text ?? ''), 'bytes');
console.log('images:', Array.isArray(dossier.images) ? dossier.images.length : 0);
console.log('schema:', dossier.schema);
