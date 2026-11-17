#!/usr/bin/env node
// Os testes do site da Terrazo.Decor: as regras dos dados (com conteúdo de ensaio, nunca mexendo no content/
// da Sara), e o site construído numa pasta à parte (pré-visualização e produção). O CI corre-os antes de
// cada publicação.   node scripts/testar.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as R from '../src/lib/regras.mjs';
import * as P from '../src/templates/paginas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0;
const falhas = [];
function t(nome, fn) {
  try { fn(); ok++; } catch (e) { falhas.push(`${nome}: ${e.message}`); }
}
const igual = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const verdade = (v, m) => { if (!v) throw new Error(m || 'falso'); };

// ---------------------------------------------------------------- regras (conteúdo de ensaio)
const lerPasta = (d) => Object.fromEntries(fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), fs.readFileSync(path.join(d, f), 'utf8')]));
const base = {
  site: fs.readFileSync(path.join(RAIZ, 'content/site.json'), 'utf8'),
  inicio: fs.readFileSync(path.join(RAIZ, 'content/inicio.json'), 'utf8'),
  categorias: fs.readFileSync(path.join(RAIZ, 'content/categorias.json'), 'utf8'),
  fotos: fs.readFileSync(path.join(RAIZ, 'content/fotos.json'), 'utf8'),
  artigos: lerPasta(path.join(RAIZ, 'content/produtos')),
  colecoes: lerPasta(path.join(RAIZ, 'content/colecoes')),
  ficheirosFotos: fs.readdirSync(path.join(RAIZ, 'media/fotos')).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)),
  videos: fs.readdirSync(path.join(RAIZ, 'media/video')).filter((f) => f.endsWith('.mp4')).map((f) => f.slice(0, -4)),
};
const umaFoto = base.ficheirosFotos[0];
const peca = (extra = {}) => ({ nome: 'Peça de ensaio', fotos: [umaFoto], resumo: 'Uma frase.', descricao: 'Um texto.', categoria: 'velas', publicado: true, ...extra });
const com = (artigos) => ({ ...base, artigos: { ...artigos } });
const comSite = (fn) => { const s = JSON.parse(base.site); fn(s); return { ...base, site: JSON.stringify(s) }; };
const comInicio = (fn) => { const h = JSON.parse(base.inicio); fn(h); return { ...base, inicio: JSON.stringify(h) }; };

t('o conteúdo atual não bloqueia', () => igual(R.problemas(base, {}).filter((p) => p.classe === 'bloqueia').map((p) => p.mensagem), []));
t('uma peça sem preço não tem problema (é por encomenda)', () => igual(R.problemas(com({ x: JSON.stringify(peca()) })).filter((p) => p.slug === 'x').length, 0));
t('um preço escrito com € avisa', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ preco: '12 €' })) })).some((p) => p.chave === 'artigo:x:preco')));
t('o preço de uma peça: «desde» só com preço', () => { igual(R.precoDe({ preco: 9, desde: true }), { valor: 9, desde: true }); igual(R.precoDe({ desde: true }), { valor: null, desde: false }); });
t('sem nome, a peça fica escondida', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ nome: '' })) })).some((p) => p.chave === 'artigo:x:nome' && p.classe === 'neutraliza')));
t('sem fotografias, a peça fica escondida', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ fotos: [] })) })).some((p) => p.chave === 'artigo:x:sem-fotos' && p.efeito === 'esconder')));
t('uma fotografia que não existe sai só ela', () => {
  const d = com({ x: JSON.stringify(peca({ fotos: [umaFoto, 'nao-existe'] })) });
  const l = R.problemas(d);
  verdade(l.some((p) => p.chave === 'artigo:x:foto-em-falta:nao-existe' && p.efeito === 'sem_fotografia'));
  igual(R.neutralizar(d, l).artigos.x.fotos, [umaFoto]);
});
t('uma categoria que não existe esconde a peça', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ categoria: 'outra' })) })).some((p) => p.chave === 'artigo:x:categoria' && p.classe === 'neutraliza')));
t('«sustentável» esconde a peça (alegação sem prova)', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ resumo: 'Prática e sustentável.' })) })).some((p) => p.chave === 'artigo:x:alegacoes')));
t('«</script» esconde a peça', () => verdade(R.problemas(com({ x: JSON.stringify(peca({ descricao: 'a</script>b' })) })).some((p) => p.chave === 'artigo:x:partia-a-pagina')));
t('escolhas: só os grupos com dois valores', () => igual(R.opcoesDe({ opcoes: [{ nome: 'Aroma', valores: [{ nome: 'Baunilha' }, { nome: 'Linho Branco' }] }, { nome: 'Só um', valores: [{ nome: 'x' }] }] }), [{ nome: 'Aroma', valores: [{ nome: 'Baunilha' }, { nome: 'Linho Branco' }] }]));
t('personalização: os campos ligados com o rótulo', () => igual(R.personalizacaoDe({ personalizacao: { nome: true, data: false, frase: true, rotuloNome: 'Nome na caixa' } }), [{ id: 'nome', rotulo: 'Nome na caixa' }, { id: 'frase', rotulo: 'Tema, cores ou frase' }]));
t('sem email: lembrete na pré-visualização, pára em produção', () => {
  const d = comSite((s) => { s.contactos.email = ''; });
  verdade(R.problemas(d).some((p) => p.chave === 'site:contactos.email:vazio' && p.lembrete));
  verdade(R.problemas(d, { producao: true }).some((p) => p.chave === 'site:contactos.email:vazio:producao' && p.classe === 'bloqueia'));
});
t('sem Instagram, email nem WhatsApp, pára (o pedido não tem para onde ir)', () => {
  const d = comSite((s) => { s.contactos.email = ''; s.contactos.instagram = ''; s.contactos.whatsapp = ''; });
  verdade(R.problemas(d).some((p) => p.chave === 'site:contactos:nenhum' && p.classe === 'bloqueia'));
});
t('um WhatsApp que não é telemóvel pára', () => verdade(R.problemas(comSite((s) => { s.contactos.whatsapp = '212345678'; })).some((p) => p.chave === 'site:contactos.whatsapp')));
t('a coleção em destaque que não existe: lembrete, a secção sai', () => verdade(R.problemas(comInicio((h) => { h.colecao.slug = 'nao-existe'; })).some((p) => p.chave === 'inicio:colecao.slug' && p.lembrete)));
t('a cor de um aroma tem a forma #RRGGBB', () => verdade(R.problemas(comInicio((h) => { h.aromas.lista[0].cor = 'laranja'; })).some((p) => p.chave === 'inicio:aromas.lista.0.cor')));
t('a capa sem fotografias pára', () => verdade(R.problemas(comInicio((h) => { h.capa.fotos = []; })).some((p) => p.chave === 'inicio:capa.fotos:vazia' && p.classe === 'bloqueia')));
t('a página inicial não tem passos nem fecho (o Renato não os quer)', () => { verdade(!R.SECCOES_INICIO.includes('passos')); verdade(!R.SECCOES_INICIO.includes('chamada')); });
t('a montra enche as filas: 7 categorias = 3 + 4', () => igual(Array.from({ length: 7 }, (_, i) => P.formaNaMontra(7, i)), ['terco', 'terco', 'terco', 'quarto', 'quarto', 'quarto', 'quarto']));
t('o mosaico enche as filas: 7 fotografias = 2 + 2 + 3', () => igual(Array.from({ length: 7 }, (_, i) => P.formaNoMosaico(7, i)), ['largo', 'largo', 'largo', 'largo', '', '', '']));
t('as fotografias usadas contam as da página inicial', () => { const u = R.fotosEmUso(base); for (const f of JSON.parse(base.inicio).nomes.fotos) verdade(u.has(f), f); });

// ---------------------------------------------------------------- o site construído (numa pasta à parte)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'terrazo-'));
const construir = (args) => spawnSync('node', [path.join(RAIZ, 'scripts/build.mjs'), '--sem-imagens', `--saida=${tmp}`, ...args], { encoding: 'utf8' });
const temCache = fs.existsSync(path.join(RAIZ, '.cache/imagens/manifesto.json'));
if (!temCache) falhas.push('Gerador: falta .cache/imagens (corra python3 scripts/imagens.py antes dos testes)');
else {
  const r = construir(['--base=/terrazo-decor']);
  t('a pré-visualização constrói-se', () => verdade(r.status === 0, (r.stderr || '').slice(-600)));
  const ler = (rel) => fs.readFileSync(path.join(tmp, rel), 'utf8');
  if (r.status === 0) {
    const inicio = ler('index.html');
    t('a pré-visualização é noindex e sem sitemap', () => { verdade(/name="robots" content="noindex/.test(inicio)); verdade(!fs.existsSync(path.join(tmp, 'sitemap.xml'))); });
    t('o rodapé: «© ano Terrazo.Decor», sem NIF nem morada', () => {
      const rod = inicio.slice(inicio.indexOf('<footer'), inicio.indexOf('</footer>'));
      verdade(/© \d{4} Terrazo\.Decor/.test(rod)); verdade(!/NIF|\d{4}-\d{3}/.test(rod), 'o rodapé tem dados da empresa');
      verdade(rod.includes('<!-- legal-comum:livro '), 'falta o Livro de Reclamações');
    });
    t('o início: a capa, a coleção, a montra, os nomes, os aromas e a Sara', () => {
      for (const c of ['class="capa"', 'class="destaque"', 'class="montra', 'class="fila"', 'class="aromas__lista"', 'class="contentor sara"']) verdade(inicio.includes(c), c);
      verdade(!/class="(passos|passo|fecho)"/.test(inicio));
    });
    t('o início: cada fotografia aparece uma vez', () => {
      const nomes = [...inicio.slice(inicio.indexOf('<main'), inicio.indexOf('</main>')).matchAll(/<img src="[^"]*\/img\/([a-z0-9-]+?)-[0-9a-f]{10}-\d+\.webp"/g)].map((m) => m[1]);
      const rep = nomes.filter((n, i) => nomes.indexOf(n) !== i);
      igual(rep, [], 'repetidas:');
    });
    t('a capa: o título é o h1 e a fotografia grande tem prioridade', () => { verdade(/<section class="capa">[\s\S]*?<h1>/.test(inicio)); verdade(/capa__foto--1">[\s\S]*?fetchpriority="high"/.test(inicio)); });
    t('«Vamos conversar?» leva ao Instagram (e o telemóvel abre a conversa)', () => verdade(/href="https:\/\/www\.instagram\.com\/terrazo_decor\/" data-ig="terrazo_decor"/.test(inicio)));
    t('o modo escuro do Safari não escurece o site', () => verdade(inicio.includes('<meta name="color-scheme" content="light only">')));
    t('a passagem entre páginas: em linha, antes da folha de estilos', () => verdade(inicio.indexOf('@view-transition') > 0 && inicio.indexOf('@view-transition') < inicio.indexOf('rel="stylesheet"')));
    t('os cartões não compram: a ficha é que tem o botão', () => { const l = ler('loja/index.html'); verdade(!/class="cartao[\s\S]{0,600}?<button/.test(l)); verdade(ler('pecas/wax-melts/index.html').includes('Juntar ao pedido')); });
    t('os preços: «desde 9,00 €» nas flower boxes, «Por encomenda» sem preço', () => {
      verdade(/desde <\/span><span class="preco__valor">9,00\s€/.test(ler('pecas/flower-box-com-nome/index.html')));
      verdade(ler('pecas/soldadinhos/index.html').includes('ficha__preco--encomenda'));
    });
    t('o vídeo da ficha: mudo, em ciclo, inline, sem pré-carregar, com pausa', () => {
      const f = ler('pecas/soldadinhos/index.html');
      verdade(/<video src="[^"]*\/video\/soldadinhos-[0-9a-f]+\.mp4" poster="[^"]*" muted loop playsinline preload="none"/.test(f));
      verdade(!/\bautoplay\b/.test(f), 'sem autoplay: é o JavaScript que o põe a tocar');
      verdade(/galeria__slide--video[\s\S]{0,700}data-pausa/.test(f), 'falta o botão de pausa (WCAG 2.2.2)');
    });
    t('as páginas legais ficam fora do Google; as outras não', () => {
      verdade(/content="noindex/.test(ler('termos-e-condicoes/index.html')));
      verdade(/content="noindex/.test(ler('politica-de-privacidade/index.html')));
    });
    t('o pedido segue pelo Instagram', () => { const p = ler('pedido/index.html'); verdade(/data-canal="instagram"/.test(p)); verdade(!/data-canal="email"/.test(p), 'sem email não há botão de email'); });
    t('o catálogo tem os preços para a mensagem do pedido', () => {
      const f = fs.readdirSync(path.join(tmp, 'assets')).find((x) => x.startsWith('catalogo-'));
      const c = JSON.parse(ler(`assets/${f}`));
      igual(c.produtos['wax-melts'].preco, 6); igual(c.produtos['soldadinhos'].preco, null); igual(c.instagram, 'terrazo_decor');
    });
    t('o cartão de partilha do início é o do logótipo', () => verdade(/og:image" content="[^"]*\/terrazo-decor-[0-9a-f]+-partilha\.jpg"/.test(inicio)));
    t('nada de restos de outros sites', () => verdade(!/dream ?art|mimices|be!?creative|creativebe|coimbra/i.test(inicio + ler('termos-e-condicoes/index.html') + ler('contactos/index.html'))));
  }
  // em produção, sem os dados legais da Sara, a construção tem de parar
  const p = construir(['--producao']);
  t('em produção, sem NIF nem email, a publicação pára', () => { verdade(p.status !== 0); verdade(/NIF|email/.test(p.stderr)); });
}
fs.rmSync(tmp, { recursive: true, force: true });

for (const f of falhas) console.error(`  ✗ ${f}`);
console.log(`${ok} testes passaram${falhas.length ? `, ${falhas.length} falharam` : ''}.`);
process.exit(falhas.length ? 1 : 0);
