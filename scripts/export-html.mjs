import { readFile, writeFile } from 'node:fs/promises';

// Bundle a playable file that does not require a dev server or a preview renderer.
const dist = new URL('../dist/', import.meta.url);
let html = await readFile(new URL('index.html', dist), 'utf8');

for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?<\/script>/g)) {
  const code = await readFile(new URL(match[1].replace(/^\//, ''), dist), 'utf8');
  const safeCode = code.replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () => `<script type="module">${safeCode}</script>`);
}

for (const match of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)) {
  const css = await readFile(new URL(match[1].replace(/^\//, ''), dist), 'utf8');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  html = html.replace(match[0], () => `<style>${safeCss}</style>`);
}

const icon = await readFile(new URL('favicon.svg', dist));
html = html.replace('href="/favicon.svg"', () => `href="data:image/svg+xml;base64,${icon.toString('base64')}"`);
// Pages streams the local MP3 on demand; the downloadable file includes it for offline play.
await writeFile(new URL('pages.html', dist), html);
for (const name of ['main', 'party', 'yes', 'poi']) {
  const music = await readFile(new URL(`audio/${name}.mp3`, dist));
  const musicReference = `src="./audio/${name}.mp3"`;
  if (!html.includes(musicReference)) throw new Error(`Missing ${name} audio reference in standalone HTML`);
  html = html.replace(musicReference, () => `src="data:audio/mpeg;base64,${music.toString('base64')}"`);
}
await writeFile(new URL('play.html', dist), html);
console.log(`Standalone game: dist/play.html (${Buffer.byteLength(html)} bytes)`);
