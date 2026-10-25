import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const docs = new URL('../docs/', import.meta.url);
await mkdir(docs, { recursive: true });
await copyFile(new URL('../dist/pages.html', import.meta.url), new URL('index.html', docs));
await mkdir(new URL('audio/', docs), { recursive: true });
for (const name of ['main', 'party', 'yes', 'poi']) {
  await copyFile(new URL(`../dist/audio/${name}.mp3`, import.meta.url), new URL(`audio/${name}.mp3`, docs));
}
await writeFile(new URL('.nojekyll', docs), '');
console.log('GitHub Pages files: docs/index.html, docs/audio/*.mp3 and docs/.nojekyll');
