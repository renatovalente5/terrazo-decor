// A moldura de todas as páginas, no desenho A «Linho» (escolhido pelo Renato a 17 nov 2026): o fundo de linho
// do próprio logótipo, o cabeçalho opaco com as páginas à esquerda, o logótipo ao centro e, à direita, os
// Contactos, a lupa e o pedido; o menu de ecrã inteiro do telemóvel, a procura, e o rodapé em colunas (a
// marca, a loja, a ajuda e as encomendas) com a linha legal por baixo.
import { esc } from './util.mjs';
import { sprite, ico } from './icones.mjs';
import { logo, livroBotao, miniatura } from './componentes.mjs';

/* As páginas do cabeçalho: as mesmas em todas as páginas, com a actual marcada. */
const PRINCIPAIS = [['/loja/', 'Loja'], ['/colecoes/', 'Coleções'], ['/sobre/', 'Sobre']];
const atual = (caminho, c) => (c === '/loja/' ? caminho.startsWith('/loja/') || caminho.startsWith('/pecas/') : c === '/colecoes/' ? caminho.startsWith('/colecoes/') : caminho === c);
const marcar = (caminho, c) => (atual(caminho, c) ? ' aria-current="page"' : '');

/* O aviso do topo (content/site.json, «aviso»): uma faixa fina, só com uma campanha ou um aviso, até ao
   dia escolhido (o site.js esconde-o no dia seguinte, sem publicar). */
function aviso(ctx) {
  const a = ctx.site.aviso || {};
  if (!a.texto || (a.ate && ctx.hoje > a.ate)) return '';
  const texto = esc(a.texto);
  const destino = a.ligacao && ctx.existe(a.ligacao) ? a.ligacao : '';
  return `<div class="aviso"${a.ate ? ` data-ate="${esc(a.ate)}"` : ''}><p class="contentor">${destino ? `<a href="${ctx.url(destino)}">${texto}${ico('seta')}</a>` : texto}</p></div>`;
}

function cabecalho(ctx, caminho) {
  return `<header class="topo" id="topo">
  <div class="contentor topo__barra">
    <button class="botao-icone topo__menu" type="button" id="abrir-menu" aria-label="Abrir o menu" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false">${ico('menu')}</button>
    <nav class="topo__nav" aria-label="Principal">
      <ul role="list">
        ${PRINCIPAIS.map(([c, t]) => `<li><a href="${ctx.url(c)}"${marcar(caminho, c)}>${esc(t)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <a class="topo__logo" href="${ctx.url('/')}"${caminho === '/' ? ' aria-current="page"' : ''}>${logo(ctx, { alto: 44, classe: 'topo__logo-img', alt: `${ctx.site.marca} — página inicial`, prioridade: true })}</a>
    <div class="topo__acoes">
      <a class="topo__ligacao" href="${ctx.url('/contactos/')}"${marcar(caminho, '/contactos/')}>Contactos</a>
      <button class="botao-icone" type="button" id="abrir-procura" aria-label="Procurar" aria-haspopup="dialog" aria-controls="procura" aria-expanded="false">${ico('lupa')}</button>
      <a class="botao-icone pedido-icone" href="${ctx.url('/pedido/')}" aria-label="O meu pedido"${caminho === '/pedido/' ? ' aria-current="page"' : ''}>${ico('saco')}<span class="pedido-icone__n" data-conta hidden></span></a>
    </div>
  </div>
</header>`;
}

export function redes(ctx, classe = 'redes') {
  const c = ctx.site.contactos;
  const r = [];
  if (c.instagram) r.push(`<a href="https://www.instagram.com/${esc(c.instagram)}/" target="_blank" rel="noopener" aria-label="Instagram da ${esc(ctx.site.marca)}">${ico('instagram')}</a>`);
  if (c.facebook) r.push(`<a href="https://www.facebook.com/${esc(c.facebook)}" target="_blank" rel="noopener" aria-label="Facebook da ${esc(ctx.site.marca)}">${ico('facebook')}</a>`);
  if (c.email) r.push(`<a href="mailto:${esc(c.email)}" aria-label="Email da ${esc(ctx.site.marca)}">${ico('carta')}</a>`);
  return r.length ? `<div class="${classe}">${r.join('')}</div>` : '';
}

/* O menu do telemóvel: um <dialog> de ecrã inteiro FORA do <header> (no iPhone, um menu dentro do cabeçalho
   preso fica do tamanho dele). As categorias com a fotografia pequena, as páginas e as redes. */
function menu(ctx, caminho) {
  const m = (c) => (c === caminho ? ' aria-current="page"' : '');
  const paginas = [['/colecoes/', 'Coleções'], ['/sobre/', 'A minha história'], ['/como-encomendar/', 'Como encomendar'], ['/contactos/', 'Contactos']].filter(([c]) => ctx.existe(c));
  return `<dialog class="menu" id="menu" aria-label="Menu">
  <div class="menu__interior">
    <div class="menu__topo">
      ${logo(ctx, { alto: 36, classe: 'menu__logo', alt: ctx.site.marca })}
      <button class="botao-icone" type="button" data-fechar aria-label="Fechar o menu">${ico('fechar')}</button>
    </div>
    <nav class="menu__meio" aria-label="Loja">
      <a class="menu__todas" href="${ctx.url('/loja/')}"${m('/loja/')}>Toda a loja${ico('seta')}</a>
      <ul class="menu__cats" role="list">
        ${ctx.categoriasComPecas.map((c) => `<li><a href="${ctx.url(`/loja/${c.slug}/`)}"${m(`/loja/${c.slug}/`)}>${miniatura(ctx, c.foto)}<span>${esc(c.nome)}</span></a></li>`).join('\n        ')}
      </ul>
      <ul class="menu__paginas" role="list">
        ${paginas.map(([c, t]) => `<li><a href="${ctx.url(c)}"${m(c)}>${esc(t)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    ${redes(ctx, 'redes menu__redes')}
  </div>
</dialog>`;
}

/* A procura: o campo e, por baixo, os resultados (no catálogo: o nome, a frase curta e a categoria, sem
   acentos nem maiúsculas). Vazia, mostra as categorias. */
function procura(ctx) {
  return `<dialog class="procura" id="procura" aria-label="Procurar">
  <div class="procura__interior">
    <form class="procura__linha" role="search" action="${ctx.url('/loja/')}" data-procura>
      <label class="procura__campo">
        ${ico('lupa')}
        <span class="so-leitor">Procurar na loja</span>
        <input type="search" name="q" placeholder="Flower box, velas, aromas…" autocomplete="off" enterkeyhint="search" spellcheck="false" aria-controls="procura-resultados">
      </label>
      <button class="botao-icone" type="button" data-fechar aria-label="Fechar a procura">${ico('fechar')}</button>
    </form>
    <p class="so-leitor" role="status" data-procura-estado></p>
    <div class="procura__resultados" id="procura-resultados" data-procura-resultados hidden></div>
    <div class="procura__inicio" data-procura-inicio>
      <p class="etiqueta">Categorias</p>
      <div class="fichas">
        ${ctx.categoriasComPecas.map((c) => `<a href="${ctx.url(`/loja/${c.slug}/`)}">${esc(c.nome)}</a>`).join('\n        ')}
      </div>
    </div>
  </div>
</dialog>`;
}

/* O RODAPÉ em colunas, compacto (o Renato não gosta de rodapés grandes, nem de rodapés só com a Ajuda): a
   marca (o logótipo, a assinatura e as redes), a loja (as categorias), a ajuda, e as encomendas (por onde se
   pede e como se recebe, com um ícone pequeno em cada linha). Por baixo, só «© ano Marca», as páginas legais
   e o Livro de Reclamações discreto — nunca o nome da dona, o NIF ou a morada (esses vivem nos Contactos e
   nos termos). */
function rodape(ctx) {
  const lig = (caminho, texto) => (ctx.existe(caminho) ? `<li><a href="${ctx.url(caminho)}">${esc(texto)}</a></li>` : '');
  const c = ctx.site.contactos;
  const p = ctx.site.pedido || {};
  const encomendas = [
    c.instagram ? ['instagram', `<a href="https://www.instagram.com/${esc(c.instagram)}/" target="_blank" rel="noopener">Por mensagem no Instagram</a>`] : null,
    c.email ? ['carta', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`] : null,
    ['caixa', esc(p.envio && p.levantamento ? 'Entrega em mão ou envio' : p.envio ? 'Envio para casa' : 'Entrega em mão ou envio')],
    ['pincel', 'Peças feitas por encomenda'],
  ].filter(Boolean);
  return `<footer class="rodape">
  <div class="contentor rodape__grelha">
    <div class="rodape__marca">
      <a class="rodape__logo" href="${ctx.url('/')}">${logo(ctx, { alto: 52, alt: `${ctx.site.marca} — página inicial` })}</a>
      <p class="rodape__frase">${esc(ctx.site.assinatura || '')}</p>
      ${redes(ctx)}
    </div>
    <nav class="rodape__col" aria-labelledby="r-loja">
      <h2 id="r-loja">A loja</h2>
      <ul role="list">
        ${ctx.categoriasComPecas.map((k) => `<li><a href="${ctx.url(`/loja/${k.slug}/`)}">${esc(k.nome)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <nav class="rodape__col" aria-labelledby="r-ajuda">
      <h2 id="r-ajuda">Ajuda</h2>
      <ul role="list">
        ${lig('/como-encomendar/', 'Como encomendar')}
        ${lig('/cuidados/', 'Cuidados com as velas')}
        ${lig('/perguntas-frequentes/', 'Perguntas frequentes')}
        ${lig('/sobre/', 'A minha história')}
        ${lig('/contactos/', 'Contactos')}
      </ul>
    </nav>
    <div class="rodape__col rodape__encomendas">
      <h2>Encomendas</h2>
      <ul role="list">
        ${encomendas.map(([i, t]) => `<li><span class="rodape__ico">${ico(i)}</span><span>${t}</span></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
  <div class="contentor rodape__legal">
    <p>© ${ctx.hoje.slice(0, 4)} ${esc(ctx.site.marca)}</p>
    <ul role="list">
      ${lig('/termos-e-condicoes/', 'Termos')}
      ${lig('/politica-de-privacidade/', 'Privacidade')}
      ${lig('/politica-de-cookies/', 'Cookies')}
      ${lig('/garantia/', 'Garantia')}
      ${lig('/resolucao-de-litigios/', 'Litígios')}
      <li>${livroBotao()}</li>
    </ul>
  </div>
</footer>`;
}

export function pagina(ctx, { titulo, descricao, caminho, conteudo, partilha, tipo = 'website', jsonld = [], classe = '', indexar = true, preload = [] }) {
  const marca = ctx.site.marca;
  const tituloCompleto = titulo.includes(marca) ? titulo : `${titulo} | ${marca}`;
  const cartaoPartilha = partilha || ctx.manifesto.partilha._site;
  const l = ctx.manifesto.logo;
  const robots = !ctx.producao ? 'noindex, nofollow' : indexar === false ? 'noindex' : '';
  /* As regras de pré-carregamento (Chrome): a página seguinte começa a carregar quando se passa o rato numa
     ligação do site, e a passagem entre páginas fica instantânea. */
  const especulacao = { prefetch: [{ where: { and: [{ href_matches: `${ctx.url('/')}*` }, { not: { href_matches: `${ctx.url('/pedido/')}*` } }] }, eagerness: 'moderate' }] };
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<style>@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }</style>
<title>${esc(tituloCompleto)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${ctx.absoluto(caminho)}">
${robots ? `<meta name="robots" content="${robots}">\n` : ''}<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(marca)}">
<meta property="og:locale" content="pt_PT">
<meta property="og:title" content="${esc(tituloCompleto)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${ctx.absoluto(caminho)}">
<meta property="og:image" content="${ctx.absoluto(`/assets/img/${cartaoPartilha}`)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(marca)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F2EFE8">
<link rel="icon" type="image/png" sizes="32x32" href="${ctx.asset(`img/${l.icones[32]}`)}">
<link rel="icon" type="image/png" sizes="48x48" href="${ctx.asset(`img/${l.icones[48]}`)}">
<link rel="apple-touch-icon" href="${ctx.asset(`img/${l.icones.apple}`)}">
<link rel="preload" href="${ctx.asset('fontes/newsreader-normal-300-600-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${ctx.asset('fontes/poppins-normal-400-latin.woff2')}" as="font" type="font/woff2" crossorigin>
${preload.join('\n')}${preload.length ? '\n' : ''}<link rel="stylesheet" href="${ctx.asset(ctx.ficheiros.css)}">
<script>document.documentElement.classList.add('js')</script>
<script type="speculationrules">${JSON.stringify(especulacao)}</script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script src="${ctx.asset(ctx.ficheiros.js)}" defer></script>
</head>
<body${classe ? ` class="${esc(classe)}"` : ''} data-catalogo="${ctx.asset(ctx.ficheiros.catalogo)}" data-base="${ctx.url('/')}">
${sprite()}
<a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
${cabecalho(ctx, caminho)}
${aviso(ctx)}
<main id="conteudo" tabindex="-1">
${conteudo}
</main>
${rodape(ctx)}
${menu(ctx, caminho)}
${procura(ctx)}
<div class="recado" role="status" aria-live="polite" data-recado></div>
</body>
</html>
`;
}
