import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const docs = new URL('../docs/', import.meta.url);
await mkdir(docs, { recursive: true });
await copyFile(new URL('../dist/pages.html', import.meta.url), new URL('index.html', docs));
await mkdir(new URL('audio/', docs), { recursive: true });
await copyFile(new URL('../dist/audio/main.mp3', import.meta.url), new URL('audio/main.mp3', docs));
await writeFile(new URL('.nojekyll', docs), '');
console.log('GitHub Pages files: docs/index.html, docs/audio/main.mp3 and docs/.nojekyll');
