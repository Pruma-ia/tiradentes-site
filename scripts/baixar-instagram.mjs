/**
 * Baixa a mídia pública do perfil da Tiradentes para assets/incoming/.
 * O perfil é público — não precisa de login.
 *
 *   node scripts/baixar-instagram.mjs
 */
import { chromium } from '/Users/gabs/pruma_dev/pruma-plataform/apps/web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ  = path.resolve(import.meta.dirname, '..');
const SAIDA = path.join(RAIZ, 'assets', 'incoming');
const ALVO  = 'https://www.instagram.com/tiradentesmotopecas/';

fs.mkdirSync(SAIDA, { recursive: true });

const ctx = await chromium.launchPersistentContext(path.join(RAIZ, '.browser'), {
  headless: true,
  viewport: { width: 1366, height: 1000 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
});
const page = ctx.pages()[0] ?? await ctx.newPage();

console.log('Abrindo o perfil…');
await page.goto(ALVO, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(1100); }

// 1) miniaturas da grade — funcionam sem login e já vêm em ~640px
const grade = await page.evaluate(() =>
  [...document.querySelectorAll('main img')]
    .filter(i => i.src?.includes('cdninstagram') && i.naturalWidth >= 240)
    .map(i => ({ url: i.src, w: i.naturalWidth, h: i.naturalHeight, alt: (i.alt || '').slice(0, 90) })));

const vistas = new Set();
const unicas = grade.filter(g => !vistas.has(g.url) && vistas.add(g.url));
console.log(`Miniaturas na grade: ${unicas.length}`);

// 2) tenta cada publicação para pegar resolução maior / vídeo
const links = [...new Set(await page.evaluate(() =>
  [...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => a.href)))];
console.log(`Publicações: ${links.length}\n`);

const baixados = [];
async function salvar(url, nome) {
  try {
    const r = await ctx.request.get(url, { headers: { referer: 'https://www.instagram.com/' } });
    if (!r.ok()) return false;
    const buf = await r.body();
    if (buf.length < 8000) return false;                 // descarta ícone/placeholder
    fs.writeFileSync(path.join(SAIDA, nome), buf);
    baixados.push({ nome, kb: Math.round(buf.length / 1024) });
    return true;
  } catch { return false; }
}

let n = 0;
for (const link of links) {
  n++;
  let ok = false;
  try {
    await page.goto(link, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    const m = await page.evaluate(() => {
      const v = [...document.querySelectorAll('video')].find(v => v.src?.startsWith('http'));
      if (v) return { tipo: 'video', url: v.src };
      const i = [...document.querySelectorAll('article img, main img')]
        .filter(x => x.src?.includes('cdninstagram') && x.naturalWidth >= 600)
        .sort((a, b) => b.naturalWidth - a.naturalWidth)[0];
      return i ? { tipo: 'foto', url: i.src, w: i.naturalWidth } : null;
    });
    if (m) {
      const nome = `ig-${String(n).padStart(2, '0')}-${m.tipo}${m.tipo === 'video' ? '.mp4' : '.jpg'}`;
      ok = await salvar(m.url, nome);
      if (ok) console.log(`  ${nome}${m.w ? `  ${m.w}px` : ''}`);
    }
  } catch { /* segue */ }
  if (!ok) console.log(`  publicação ${n}: post bloqueado, usarei a miniatura`);
}

// 3) completa com as miniaturas para o que não veio do post
let m = 0;
for (const g of unicas) {
  m++;
  const nome = `ig-grade-${String(m).padStart(2, '0')}.jpg`;
  if (fs.existsSync(path.join(SAIDA, nome))) continue;
  if (await salvar(g.url, nome)) console.log(`  ${nome}  ${g.w}x${g.h}  ${g.alt}`);
}

console.log(`\n${baixados.length} arquivo(s) em assets/incoming/`);
await ctx.close();
