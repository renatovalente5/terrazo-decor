// Capturas para rever (não vai para o CI): o 1.º ecrã e a página inteira (com «menos movimento», sem fullPage:
// a janela fica da altura da página) no computador (1440) e no telemóvel (390, toque), mais os erros da
// consola e o transbordo horizontal.   node scripts/capturas.mjs <url-base> <pasta> <caminho> [<caminho>…]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/renatovalente/Websites/carimbo/package.json');
const { chromium } = require('playwright');
const [base, saida, ...caminhos] = process.argv.slice(2);
mkdirSync(saida, { recursive: true });
const b = await chromium.launch();
const TAMANHOS = [
  { nome: 'pc', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { nome: 'tm', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];
for (const c of caminhos) {
  const nomeF = c.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'inicio';
  for (const t of TAMANHOS) {
    const { nome, ...opc } = t;
    let ctx = await b.newContext(opc); let pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push(e.message));
    pg.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    pg.on('requestfailed', (r) => erros.push('falhou ' + r.url()));
    await pg.goto(base + c, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1800);
    await pg.screenshot({ path: `${saida}/${nomeF}-${nome}-1.jpg`, quality: 80, type: 'jpeg' });
    const larg = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await ctx.close();
    ctx = await b.newContext({ ...opc, reducedMotion: 'reduce' }); pg = await ctx.newPage();
    await pg.goto(base + c, { waitUntil: 'networkidle' });
    const h = await pg.evaluate(() => document.documentElement.scrollHeight);
    await pg.setViewportSize({ width: opc.viewport.width, height: Math.min(h, 14000) });
    await pg.waitForTimeout(700);
    await pg.screenshot({ path: `${saida}/${nomeF}-${nome}-inteira.jpg`, quality: 76, type: 'jpeg' });
    await ctx.close();
    console.log(c, nome, 'altura', h, larg[0] > larg[1] ? `TRANSBORDA ${larg.join('/')}` : 'ok', erros.length ? 'ERROS: ' + erros.join(' | ') : '');
  }
}
await b.close();
