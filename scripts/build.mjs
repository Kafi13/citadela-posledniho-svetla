import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist');

const requiredEntries = ['index.html', 'styles.css', 'src'];

for (const entry of requiredEntries) {
  await access(path.join(projectRoot, entry));
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const entry of requiredEntries) {
  await cp(path.join(projectRoot, entry), path.join(outputDirectory, entry), {
    recursive: true,
  });
}

const publicDirectory = path.join(projectRoot, 'public');

try {
  const publicEntries = await readdir(publicDirectory);

  for (const entry of publicEntries) {
    await cp(path.join(publicDirectory, entry), path.join(outputDirectory, entry), {
      recursive: true,
    });
  }
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

console.log(`Hotovo: ${path.relative(projectRoot, outputDirectory)}/`);
