import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'index.html',
  'styles.css',
  'src/core.js',
  'src/audio.js',
  'src/game.js',
  'src/input.js',
  'src/levels.js',
  'src/main.js',
  'src/renderer.js',
  'public/_headers',
  'public/icon.svg',
  'public/manifest.webmanifest',
  'scripts/build.mjs',
  'scripts/serve.mjs',
  'tests/core.test.js',
  'tests/levels.test.js',
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(path.join(projectRoot, file));
  } catch {
    failures.push(`Chybí soubor: ${file}`);
  }
}

for (const file of ['package.json', 'public/manifest.webmanifest']) {
  try {
    JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));
  } catch (error) {
    failures.push(`Neplatný JSON v ${file}: ${error.message}`);
  }
}

const syntaxCheckedFiles = [
  'src/core.js',
  'src/audio.js',
  'src/game.js',
  'src/input.js',
  'src/levels.js',
  'src/main.js',
  'src/renderer.js',
  'scripts/build.mjs',
  'scripts/serve.mjs',
  'scripts/validate.mjs',
  'tests/core.test.js',
  'tests/levels.test.js',
];

for (const file of syntaxCheckedFiles) {
  try {
    await access(path.join(projectRoot, file));
  } catch {
    continue;
  }

  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failures.push(`Chyba syntaxe v ${file}:\n${result.stderr.trim()}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Kontrola projektu proběhla v pořádku.');
}
