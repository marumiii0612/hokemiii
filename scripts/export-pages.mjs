import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const docs = new URL('../docs/', import.meta.url);
await mkdir(docs, { recursive: true });
await copyFile(new URL('../dist/play.html', import.meta.url), new URL('index.html', docs));
await writeFile(new URL('.nojekyll', docs), '');
console.log('GitHub Pages files: docs/index.html and docs/.nojekyll');
