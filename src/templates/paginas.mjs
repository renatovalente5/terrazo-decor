// As páginas do site (o desenho A «Linho», escolhido pelo Renato a 17 nov 2026): a inicial, a loja (tudo e por
// categoria), a ficha de cada peça, as coleções (a lista e cada uma), os contactos, o pedido, as páginas de
// texto e a 404. Cada função devolve { caminho, titulo, descricao, conteudo, … } e o layout.mjs veste-a.
import { esc, markdown, resumir, moradaCompleta } from './util.mjs';
import { ico } from './icones.mjs';
import { imagem, miniatura, cartao, cartaoColecao, pastilhas, preco, setaCirculo, videoAuto } from './componentes.mjs';
import { opcoesDe, personalizacaoDe, quantidadeMinimaDe, OCASIOES } from '../lib/regras.mjs';

/* O que o Google lê de cada categoria (o <title> e a descrição), escrito à mão: o nome sozinho («Velas |
   Terrazo.Decor») não diz o que lá está. Uma categoria nova sem linha aqui usa o título e o texto dela. */
const SEO_CATEGORIAS = {
  'flower-boxes': ['Flower boxes com nome, em flores de cera vegetal', 'Flower boxes de flores em cera vegetal e flores secas, numa caixa com o nome de quem as recebe a dourado. Feitas à mão, por encomenda.'],
  velas: ['Velas artesanais de cera vegetal', 'Velas de cera vegetal feitas em molde: abóboras, soldadinhos de Natal, flores, postais com vela e as peças de cada estação.'],
  'wax-melts': ['Wax Melts de cera vegetal, tea lights e ambientadores', 'Wax Melts de cera vegetal em oito aromas — Linho Branco, Maçã & Canela, Baunilha… —, tea lights de cera vegetal e ambientadores para o roupeiro.'],
  coffrets: ['Coffrets de oferta à medida', 'Caixas de oferta montadas à medida com velas, Wax Melts, chá e caneca, e coffrets para convidar os padrinhos.'],
  jesmonite: ['Peças em Jesmonite e terrazzo', 'Bandejas, vasos canelados e peças decorativas em Jesmonite, algumas em terrazzo, feitas e lixadas à mão.'],
  personalizados: ['Presentes personalizados com nome', 'Quadros de flores, postais, estrelas de Natal e canecas com nomes, datas e mensagens, feitos à mão.'],
  lembrancas: ['Lembranças para casamentos, batizados e eventos', 'Lembranças em cera para casamentos, batizados, escolas e empresas: corações, tulipas e mini flower boxes com mensagem.'],
};

const trilho = (ctx, passos) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: passos.map(([nome, caminho], i) => ({ '@type': 'ListItem', position: i + 1, name: nome, item: ctx.absoluto(caminho) })),
});

const fotoAbsoluta = (ctx, nome) => {
  const m = ctx.manifesto.fotos[nome];
  return ctx.absoluto(`/assets/img/${nome}-${m.resumo}-${m.larguras[m.larguras.length - 1]}.webp`);
};

/* A ligação para a conversa no Instagram: no computador o perfil (o ig.me não abre no Instagram Web); no
   telemóvel o interface.js troca-a pela conversa (ig.me/m/<conta>), que abre na app. */
export const ligacaoInstagram = (ctx) => `https://www.instagram.com/${esc(ctx.site.contactos.instagram)}/`;
const atributosInstagram = (ctx) => `href="${ligacaoInstagram(ctx)}" data-ig="${esc(ctx.site.contactos.instagram)}" target="_blank" rel="noopener"`;

/* A cabeça de uma página: a etiqueta (opcional), o h1 e uma frase. */
function cabecaPagina({ etiqueta = '', titulo: t, texto = '', extra = '', italico = false }) {
  return `<header class="pagina__cabeca">
  ${etiqueta ? `<p class="etiqueta">${esc(etiqueta)}</p>` : ''}
  <h1${italico ? ' class="italico"' : ''}>${esc(t)}</h1>
  ${texto ? `<p class="pagina__texto">${esc(texto)}</p>` : ''}${extra}
</header>`;
}
const ligacaoSeta = (ctx, caminho, texto, classe = '') => `<a class="ligacao-seta${classe ? ` ${classe}` : ''}" href="${ctx.url(caminho)}">${esc(texto)}${ico('seta')}</a>`;

// ---------------------------------------------------------------- página inicial
/* A forma de cada categoria na MONTRA do computador (grelha de 12): três por fila («terco») e, quando as contas
   não dão certo, uma fila de quatro no fim («quarto», n = 3k+1) ou uma de duas no início («meia», n = 3k+2),
   para todas as filas ficarem cheias (7 categorias: 3 + 4). No telemóvel, duas por fila e, com um número
   ímpar, a primeira a toda a largura. */
export function formaNaMontra(n, i) {
  if (n === 1) return 'inteira';
  if (n === 2) return 'meia';
  if (n % 3 === 0) return 'terco';
  if (n % 3 === 1) return i >= n - 4 ? 'quarto' : 'terco';
  return i < 2 ? 'meia' : 'terco';
}

export function inicio(ctx) {
  const h = ctx.inicio;
  const site = ctx.site;
  const capa = h.capa;
  const fotosCapa = (Array.isArray(capa.fotos) ? capa.fotos : []).filter((f) => ctx.manifesto.fotos[f]).slice(0, 2);
  const ligacaoCapa = ctx.existe(capa.ligacao) ? capa.ligacao : '/loja/';
  const colecao = ctx.colecoes.find((c) => c.slug === h.colecao.slug);
  /* Cada fotografia aparece UMA vez na página: escolhe-se pela ordem da página (a capa, a coleção, a montra, os
     nomes, os aromas e a Sara); se não houver outra, repete-se. */
  const usadas = new Set(fotosCapa);
  const escolher = (lista) => {
    const boas = lista.filter((f) => f && ctx.manifesto.fotos[f]);
    const f = boas.find((x) => !usadas.has(x)) || boas[0] || '';
    if (f) usadas.add(f);
    return f;
  };
  // a coleção em destaque mostra três peças dela, cada fotografia leva à peça
  const pecasColecao = colecao ? colecao.produtos.map((s) => ctx.produtos.find((p) => p.slug === s)).filter(Boolean).slice(0, 3) : [];
  const fotosColecao = pecasColecao.map((p) => escolher(p.fotos));
  const cats = ctx.categoriasComPecas;
  const fotosMontra = cats.map((c) => escolher([c.foto, ...ctx.produtos.filter((p) => p.categoria === c.slug).flatMap((p) => p.fotos)]));
  const pecaDaFoto = (f) => ctx.produtos.find((p) => p.fotos.includes(f));
  const nomes = (Array.isArray(h.nomes.fotos) ? h.nomes.fotos : []).filter((f) => ctx.manifesto.fotos[f] && !usadas.has(f));
  nomes.forEach((f) => usadas.add(f));
  const fotoAromas = h.aromas.foto && ctx.manifesto.fotos[h.aromas.foto] ? escolher([h.aromas.foto, ...(ctx.produtos.find((p) => p.categoria === 'wax-melts')?.fotos || [])]) : '';
  const fotoSara = escolher([h.sara.foto]);
  const aromas = Array.isArray(h.aromas.lista) ? h.aromas.lista.filter((a) => a && a.nome) : [];
  const ligacaoAromas = h.aromas.ligacao && ctx.existe(h.aromas.ligacao) ? h.aromas.ligacao : '';
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: site.marca, alternateName: ['Terrazo Decor', 'Terrazo'], url: ctx.absoluto('/') },
    {
      '@context': 'https://schema.org', '@type': 'Organization', name: site.marca, url: ctx.absoluto('/'),
      logo: ctx.absoluto(`/assets/img/${ctx.manifesto.logo.altura[256].png}`), description: site.descricao,
      ...(site.contactos.email ? { email: site.contactos.email } : {}),
      ...(site.local.localidade ? { address: { '@type': 'PostalAddress', addressLocality: site.local.localidade, addressRegion: site.local.distrito, addressCountry: 'PT' } } : {}),
      sameAs: [site.contactos.instagram && `https://www.instagram.com/${site.contactos.instagram}/`, site.contactos.facebook && `https://www.facebook.com/${site.contactos.facebook}`].filter(Boolean),
    },
  ];
  const conteudo = `
<section class="capa">
  <div class="contentor capa__grelha">
    <div class="capa__texto">
      ${capa.etiqueta ? `<p class="etiqueta">${esc(capa.etiqueta)}</p>` : ''}
      <h1>${esc(capa.titulo)}${capa.tituloItalico ? ` <em>${esc(capa.tituloItalico)}</em>` : ''}</h1>
      ${capa.texto ? `<p class="capa__frase">${esc(capa.texto)}</p>` : ''}
      <div class="botoes">
        <a class="botao" href="${ctx.url(ligacaoCapa)}">${esc(capa.botao)}</a>
        ${site.contactos.instagram ? `<a class="botao botao--linha" ${atributosInstagram(ctx)}>Vamos conversar?</a>` : ''}
      </div>
    </div>
    <div class="capa__fotos capa__fotos--${fotosCapa.length}">
      ${fotosCapa[0] ? `<figure class="capa__foto capa__foto--1">${imagem(ctx, fotosCapa[0], { tamanhos: '(min-width: 1240px) 600px, (min-width: 980px) 48vw, (min-width: 640px) 80vw, 88vw', prioridade: true, moldura: 4 / 5 })}</figure>` : ''}
      ${fotosCapa[1] ? `<figure class="capa__foto capa__foto--2">${imagem(ctx, fotosCapa[1], { tamanhos: '(min-width: 980px) 240px, 40vw', cedo: true, moldura: 4 / 5 })}</figure>` : ''}
    </div>
  </div>
</section>

${colecao ? `<section class="destaque" aria-labelledby="s-colecao">
  <div class="contentor">
    <div class="destaque__cartao">
      <div class="destaque__texto">
        <p class="etiqueta">${esc(h.colecao.etiqueta || colecao.quando || colecao.epoca)}</p>
        <h2 id="s-colecao">${esc(colecao.titulo)}</h2>
        <p>${esc(colecao.resumo)}</p>
        <a class="botao botao--claro" href="${ctx.url(`/colecoes/${colecao.slug}/`)}">${esc(h.colecao.botao)}</a>
      </div>
      <ul class="destaque__pecas" role="list">
        ${pecasColecao.map((p, i) => `<li><a href="${ctx.url(`/pecas/${p.slug}/`)}"><span class="destaque__foto">${imagem(ctx, fotosColecao[i], { tamanhos: '(min-width: 980px) 240px, 58vw', moldura: 3 / 4, alt: '' })}</span><span class="destaque__nome">${esc(p.nome)}</span></a></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>` : ''}

<section class="seccao" aria-labelledby="s-loja">
  <div class="contentor">
    <header class="seccao__topo"><h2 id="s-loja">${esc(h.loja.titulo)}</h2>${ligacaoSeta(ctx, '/loja/', 'Ver tudo')}</header>
    <ul class="montra${cats.length % 2 ? ' montra--impar' : ''}" role="list">
      ${cats.map((c, i) => {
        const forma = formaNaMontra(cats.length, i);
        const telemovel = cats.length % 2 && i === 0 ? '100vw' : '50vw';
        const tamanhos = { inteira: '(min-width: 1240px) 1180px, 100vw', meia: `(min-width: 1240px) 580px, (min-width: 861px) 48vw, ${telemovel}`, terco: `(min-width: 1240px) 380px, (min-width: 861px) 31vw, ${telemovel}`, quarto: `(min-width: 1240px) 280px, (min-width: 861px) 23vw, ${telemovel}` }[forma];
        const moldura = { inteira: 16 / 9, meia: 4 / 3, terco: 4 / 5, quarto: 4 / 5 }[forma];
        return `<li class="montra__item montra__item--${forma}"><a href="${ctx.url(`/loja/${c.slug}/`)}">
        <span class="montra__foto">${imagem(ctx, fotosMontra[i], { tamanhos, moldura, alt: '' })}</span>
        <h3 class="montra__nome">${esc(c.nome)}</h3>
      </a></li>`;
      }).join('\n      ')}
    </ul>
  </div>
</section>

${nomes.length ? `<section class="seccao nomes" aria-labelledby="s-nomes">
  <div class="contentor nomes__grelha">
    <div class="nomes__texto">
      <h2 id="s-nomes">${esc(h.nomes.titulo)}</h2>
      ${h.nomes.texto ? `<p>${esc(h.nomes.texto)}</p>` : ''}
      ${h.nomes.botao && ctx.existe(h.nomes.ligacao) ? ligacaoSeta(ctx, h.nomes.ligacao, h.nomes.botao) : ''}
    </div>
    <ul class="fila" role="list" aria-label="Flower boxes com nome">
      ${nomes.map((f) => { const p = pecaDaFoto(f); const fig = imagem(ctx, f, { tamanhos: '(min-width: 980px) 270px, 62vw', moldura: 3 / 4 }); return `<li>${p ? `<a href="${ctx.url(`/pecas/${p.slug}/`)}">${fig}</a>` : fig}</li>`; }).join('\n      ')}
    </ul>
  </div>
</section>` : ''}

${aromas.length ? `<section class="seccao" aria-labelledby="s-aromas">
  <div class="contentor aromas">
    ${fotoAromas ? `<figure class="aromas__foto">${imagem(ctx, fotoAromas, { tamanhos: '(min-width: 980px) 500px, 92vw', moldura: 4 / 5 })}</figure>` : ''}
    <div class="aromas__texto">
      ${h.aromas.etiqueta ? `<p class="etiqueta">${esc(h.aromas.etiqueta)}</p>` : ''}
      <h2 id="s-aromas">${esc(h.aromas.titulo)}</h2>
      <ul class="aromas__lista" role="list">
        ${aromas.map((a) => `<li${/^#[0-9A-Fa-f]{6}$/.test(a.cor || '') ? ` style="--cor:${a.cor}"` : ''}><b>${esc(a.nome)}</b>${a.nota ? `<span>${esc(a.nota)}</span>` : ''}</li>`).join('\n        ')}
      </ul>
      ${ligacaoAromas ? ligacaoSeta(ctx, ligacaoAromas, 'Ver os Wax Melts') : ''}
    </div>
  </div>
</section>` : ''}

<section class="seccao" aria-labelledby="s-sara">
  <div class="contentor sara">
    <div class="sara__fotos">
      ${fotoSara ? `<figure class="sara__foto">${imagem(ctx, fotoSara, { tamanhos: '(min-width: 980px) 440px, 80vw', moldura: 4 / 5 })}</figure>` : ''}
      <img class="sara__tulipas" src="${ctx.asset(`img/${ctx.manifesto.motivo.webp}`)}" width="${ctx.manifesto.motivo.w}" height="${ctx.manifesto.motivo.h}" alt="" loading="lazy" decoding="async">
    </div>
    <div class="sara__texto">
      ${h.sara.etiqueta ? `<p class="etiqueta">${esc(h.sara.etiqueta)}</p>` : ''}
      <h2 id="s-sara">${esc(h.sara.titulo)}</h2>
      <p>${esc(h.sara.texto)}</p>
      ${h.sara.citacao ? `<blockquote>«${esc(h.sara.citacao)}»</blockquote>` : ''}
      ${h.sara.botao && ctx.existe(h.sara.ligacao) ? ligacaoSeta(ctx, h.sara.ligacao, h.sara.botao) : ''}
    </div>
  </div>
</section>`;
  return { caminho: '/', titulo: h.seo.titulo, descricao: h.seo.descricao, conteudo, jsonld, classe: 'pagina-inicio' };
}

// ---------------------------------------------------------------- loja
export function loja(ctx, slug = '') {
  const c = slug ? ctx.categorias.find((k) => k.slug === slug) : null;
  const lista = c ? ctx.produtos.filter((p) => p.categoria === slug) : ctx.produtos;
  const caminho = c ? `/loja/${slug}/` : '/loja/';
  const [seoTitulo, seoDescricao] = c ? (SEO_CATEGORIAS[slug] || [c.titulo, c.resumo]) : ['A loja: flower boxes, velas, Wax Melts e presentes artesanais', 'Toda a loja da Terrazo.Decor: flower boxes com nome, velas e Wax Melts em cera vegetal, coffrets, peças em Jesmonite, personalizados e lembranças.'];
  const jsonld = [
    trilho(ctx, c ? [['Início', '/'], ['Loja', '/loja/'], [c.nome, caminho]] : [['Início', '/'], ['Loja', '/loja/']]),
    { '@context': 'https://schema.org', '@type': 'ItemList', name: c ? c.titulo : 'Loja', itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: ctx.absoluto(`/pecas/${p.slug}/`), name: p.nome })) },
  ];
  const conteudo = `
<div class="contentor pagina-lista">
  ${cabecaPagina({ titulo: c ? c.titulo : 'A loja', texto: c ? c.resumo : 'Tudo é feito à mão, uma peça de cada vez. Escolhe, junta ao pedido e envia-mo: eu confirmo o preço e o prazo.' })}
  ${pastilhas(ctx, slug)}
  <p class="lista__conta">${lista.length} ${lista.length === 1 ? 'peça' : 'peças'}</p>
  <ul class="grelha" role="list">
    ${lista.map((p, i) => `<li>${cartao(ctx, p, { cedo: i < 4 })}</li>`).join('\n    ')}
  </ul>
</div>`;
  return { caminho, titulo: seoTitulo, descricao: resumir(seoDescricao), conteudo, jsonld, classe: 'pagina-loja' };
}

// ---------------------------------------------------------------- ficha da peça
function galeria(ctx, p) {
  const fotos = p.fotos;
  const video = p.video && ctx.ficheiros.videos[p.video] ? p.video : '';
  const slides = fotos.map((f, i) => `<li class="galeria__slide" id="foto-${i + 1}">${imagem(ctx, f, { tamanhos: '(min-width: 1240px) 620px, (min-width: 860px) 52vw, 100vw', prioridade: i === 0, cedo: i === 0, moldura: 4 / 5 })}</li>`);
  if (video) {
    const nomePoster = ctx.manifesto.posters[`video-${video}`] ? `video-${video}` : fotos[0];
    const m = ctx.manifesto.fotos[nomePoster] || ctx.manifesto.posters[nomePoster];
    const poster = ctx.asset(`img/${nomePoster}-${m.resumo}-${m.larguras.find((w) => w >= 720) || m.larguras[m.larguras.length - 1]}.webp`);
    slides.splice(1, 0, `<li class="galeria__slide galeria__slide--video" id="video"><video src="${ctx.asset(ctx.ficheiros.videos[video])}" poster="${poster}" muted loop playsinline preload="none" aria-label="Vídeo: ${esc(p.nome)}" data-video></video><button class="video-pausa" type="button" aria-label="Pausar o vídeo" data-pausa hidden>${ico('pausa')}${ico('play')}</button></li>`);
  }
  const total = slides.length;
  return `<div class="galeria" data-galeria>
  <ul class="galeria__fila" role="list" tabindex="0" aria-label="Fotografias de ${esc(p.nome)}">${slides.join('')}</ul>
  ${total > 1 ? `<div class="galeria__miniaturas" role="list">${fotos.map((f, i) => `<a role="listitem" href="#foto-${i + 1}" aria-label="Fotografia ${i + 1} de ${fotos.length}"${i === 0 ? ' aria-current="true"' : ''}>${miniatura(ctx, f, { lado: 64 })}</a>`).join('')}${video ? `<a role="listitem" class="galeria__mini-video" href="#video" aria-label="Ver o vídeo">${ico('play')}</a>` : ''}</div>
  <p class="galeria__pontos" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<span${i === 0 ? ' class="ativo"' : ''}></span>`).join('')}</p>` : ''}
</div>`;
}

export function peca(ctx, p) {
  const c = ctx.categorias.find((k) => k.slug === p.categoria);
  const caminho = `/pecas/${p.slug}/`;
  const opcoes = opcoesDe(p);
  const pers = personalizacaoDe(p);
  const minimo = quantidadeMinimaDe(p);
  const detalhes = [
    ...(Array.isArray(p.inclui) && p.inclui.length ? [['Inclui', p.inclui.join(' · ')]] : []),
    ...(p.composicao ? [['Composição', p.composicao]] : []),
    ...(Array.isArray(p.medidas) ? p.medidas.map((m) => [m.rotulo, m.valor]) : []),
    ...(p.referencia ? [['Referência', p.referencia]] : []),
  ];
  const avisos = String(p.avisos || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const perigos = String(p.perigos || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const fab = p.fabricante && p.fabricante.nome && p.fabricante.morada && p.fabricante.email ? p.fabricante : null;
  const campo = (f) => {
    const id = `p-${f.id}`;
    if (f.id === 'frase') return `<label class="campo" for="${id}"><span>${esc(f.rotulo)}</span><textarea id="${id}" name="${f.id}" rows="2" maxlength="300"></textarea></label>`;
    if (f.id === 'data') return `<label class="campo" for="${id}"><span>${esc(f.rotulo)}</span><input id="${id}" name="data" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" autocomplete="off" data-data></label>`;
    return `<label class="campo" for="${id}"><span>${esc(f.rotulo)}</span><input id="${id}" name="nome" type="text" maxlength="120" autocomplete="off"></label>`;
  };
  const relacionadas = ctx.produtos.filter((x) => x.categoria === p.categoria && x.slug !== p.slug).slice(0, 4);
  const emColecoes = ctx.colecoes.filter((k) => (k.produtos || []).includes(p.slug)).slice(0, 3);
  const temPreco = typeof p.preco === 'number' && p.preco > 0;
  const descricao = resumir(`${p.resumo} ${c ? `${c.nome}, feito à mão pela Terrazo.Decor.` : ''}`);
  const jsonld = [
    trilho(ctx, [['Início', '/'], ['Loja', '/loja/'], ...(c ? [[c.nome, `/loja/${c.slug}/`]] : []), [p.nome, caminho]]),
    {
      '@context': 'https://schema.org', '@type': 'Product', name: p.nome, description: p.resumo, image: p.fotos.slice(0, 4).map((f) => fotoAbsoluta(ctx, f)), brand: { '@type': 'Brand', name: ctx.site.marca }, category: c ? c.titulo : undefined, url: ctx.absoluto(caminho),
      ...(temPreco ? { offers: { '@type': 'Offer', priceCurrency: 'EUR', price: p.preco.toFixed(2), availability: 'https://schema.org/MadeToOrder', url: ctx.absoluto(caminho) } } : {}),
    },
  ];
  const conteudo = `
<div class="contentor ficha">
  <nav class="migalhas" aria-label="Estás aqui">
    <ol role="list"><li><a href="${ctx.url('/loja/')}">Loja</a></li>${c ? `<li><a href="${ctx.url(`/loja/${c.slug}/`)}">${esc(c.nome)}</a></li>` : ''}<li aria-current="page">${esc(p.nome)}</li></ol>
  </nav>
  <div class="ficha__grelha">
    ${galeria(ctx, p)}
    <div class="ficha__info">
      ${c ? `<p class="etiqueta ficha__cat">${esc(c.nome)}</p>` : ''}
      <h1 class="ficha__nome">${esc(p.nome)}</h1>
      ${preco(p, { classe: 'ficha__preco', semPreco: 'Por encomenda' })}
      <p class="ficha__resumo">${esc(p.resumo)}</p>
      <form class="ficha__form" data-juntar="${esc(p.slug)}" novalidate>
        ${opcoes.map((g, i) => `<fieldset class="escolha">
          <legend>${esc(g.nome)}</legend>
          <div class="escolha__valores">${g.valores.map((v, j) => `<label><input type="radio" name="o${i}" value="${esc(v.nome)}"${j === 0 ? ' checked' : ''}><span>${esc(v.nome)}</span></label>`).join('')}</div>
        </fieldset>`).join('\n        ')}
        ${pers.length ? `<div class="campos">${pers.map(campo).join('')}</div>` : ''}
        <div class="ficha__juntar">
          <div class="quantidade" data-quantidade data-minimo="${minimo}">
            <button type="button" class="botao-icone" data-menos aria-label="Menos uma">${ico('menos')}</button>
            <label class="so-leitor" for="p-qtd">Quantidade</label>
            <input id="p-qtd" name="quantidade" type="number" inputmode="numeric" min="${minimo}" max="9999" value="${minimo}">
            <button type="button" class="botao-icone" data-mais aria-label="Mais uma">${ico('mais')}</button>
          </div>
          <button class="botao botao--largo" type="submit">${ico('saco')}Juntar ao pedido</button>
        </div>
        ${minimo > 1 ? `<p class="ficha__minimo">Mínimo: ${minimo} unidades.</p>` : ''}
      </form>
      <ul class="ficha__linhas" role="list">
        <li>${ico('conversa')}<span>${temPreco ? 'Confirmo contigo o total e o prazo antes de começar.' : 'Feita por encomenda: digo-te o preço e o prazo antes de começar.'}</span></li>
        <li>${ico('caixa')}<span>Entrega em mão ou envio, combinados na conversa.</span></li>
      </ul>
      ${detalhes.length ? `<ul class="lista lista--ficha" role="list">${detalhes.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>` : ''}
      ${p.descricao && p.descricao !== p.resumo ? `<div class="ficha__descricao">${markdown(p.descricao, ctx.url)}</div>` : ''}
      ${avisos.length || perigos.length ? `<div class="ficha__avisos"><p class="etiqueta">Avisos</p><ul>${[...perigos, ...avisos].map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${fab ? `<p class="ficha__fabricante">Fabricante: ${esc(fab.nome)}, ${esc(fab.morada)}, ${esc(fab.email)}</p>` : ''}
    </div>
  </div>
</div>
${emColecoes.length ? `<section class="seccao" aria-labelledby="s-nas-colecoes">
  <div class="contentor">
    <header class="seccao__topo"><h2 id="s-nas-colecoes">${emColecoes.length === 1 ? 'Da coleção' : 'Das coleções'}</h2></header>
    <ul class="colecoes colecoes--${emColecoes.length}" role="list">${emColecoes.map((k) => `<li>${cartaoColecao(ctx, k, { foto: k.fotos.find((f) => !p.fotos.includes(f) && ctx.manifesto.fotos[f]) || k.fotos[0] })}</li>`).join('')}</ul>
  </div>
</section>` : ''}
${relacionadas.length ? `<section class="seccao" aria-labelledby="s-mais">
  <div class="contentor">
    <header class="seccao__topo"><h2 id="s-mais">Também podes gostar</h2>${c ? ligacaoSeta(ctx, `/loja/${c.slug}/`, 'Ver tudo') : ''}</header>
    <ul class="grelha" role="list">${relacionadas.map((x) => `<li>${cartao(ctx, x)}</li>`).join('')}</ul>
  </div>
</section>` : ''}`;
  return { caminho, titulo: c ? `${p.nome} · ${c.nome}` : p.nome, descricao, conteudo, jsonld, partilha: ctx.manifesto.partilha[p.slug], tipo: 'product', classe: 'pagina-peca' };
}

// ---------------------------------------------------------------- coleções
export function colecoes(ctx) {
  const lista = ctx.colecoes;
  const conteudo = `
<div class="contentor pagina-lista">
  ${cabecaPagina({ titulo: 'Coleções', texto: 'Cada estação inspira uma coleção: as peças que fazem a casa sentir-se casa, e os presentes de cada época.' })}
  <ul class="colecoes colecoes--lista" role="list">
    ${lista.map((c) => `<li>${cartaoColecao(ctx, c, { titulo: 'h2' })}</li>`).join('\n    ')}
  </ul>
</div>`;
  return { caminho: '/colecoes/', titulo: 'Coleções: Natal, outono, Dia da Mãe e outras épocas', descricao: 'As coleções da Terrazo.Decor: A Christmas Tale (Natal), FALL in love (outono), Dia da Mãe, fim do ano letivo e Páscoa.', conteudo, jsonld: [trilho(ctx, [['Início', '/'], ['Coleções', '/colecoes/']])], classe: 'pagina-colecoes' };
}

/* A forma de cada fotografia no mosaico do computador (grelha de 6): «largo» = duas por fila, '' = três por
   fila. As filas de duas vão à frente: 1 (n = 3k+2) ou 2 (n = 3k+1), para todas as filas ficarem cheias. */
export function formaNoMosaico(n, i) {
  if (n === 1) return 'inteiro';
  const largos = n % 3 === 2 ? 2 : n % 3 === 1 ? 4 : 0;
  return i < largos ? 'largo' : '';
}

export function colecao(ctx, c) {
  const caminho = `/colecoes/${c.slug}/`;
  const pecas = (c.produtos || []).map((s) => ctx.produtos.find((p) => p.slug === s)).filter(Boolean);
  const conteudo = `
<article class="contentor colecao">
  <nav class="migalhas" aria-label="Estás aqui"><ol role="list"><li><a href="${ctx.url('/colecoes/')}">Coleções</a></li><li aria-current="page">${esc(c.titulo)}</li></ol></nav>
  ${cabecaPagina({ etiqueta: c.quando || c.epoca, titulo: c.titulo, italico: true })}
  ${c.texto ? `<div class="colecao__texto">${markdown(c.texto, ctx.url)}</div>` : `<p class="colecao__texto">${esc(c.resumo)}</p>`}
  <ul class="mosaico${c.fotos.length % 2 ? ' mosaico--impar' : ''}" role="list">
    ${c.fotos.map((f, i) => {
      const forma = formaNoMosaico(c.fotos.length, i);
      const telemovel = c.fotos.length % 2 && i === 0 ? '100vw' : '50vw';
      const tamanhos = forma === 'inteiro' ? '(min-width: 1240px) 1180px, 100vw'
        : forma === 'largo' ? `(min-width: 1240px) 580px, (min-width: 861px) 48vw, ${telemovel}`
        : `(min-width: 1240px) 380px, (min-width: 861px) 31vw, ${telemovel}`;
      return `<li${forma ? ` class="${forma}"` : ''}>${imagem(ctx, f, { tamanhos, moldura: forma === 'largo' ? 1 : forma === 'inteiro' ? 3 / 2 : 4 / 5, prioridade: i === 0, cedo: i < 2 })}</li>`;
    }).join('\n    ')}
  </ul>
</article>
${pecas.length ? `<section class="seccao" aria-labelledby="s-pecas">
  <div class="contentor">
    <header class="seccao__topo"><h2 id="s-pecas">As peças</h2></header>
    <ul class="grelha" role="list">${pecas.map((p) => `<li>${cartao(ctx, p)}</li>`).join('')}</ul>
  </div>
</section>` : ''}`;
  return { caminho, titulo: `${c.titulo} · ${c.epoca}`, descricao: resumir(`${c.titulo}: ${c.resumo}`), conteudo, jsonld: [trilho(ctx, [['Início', '/'], ['Coleções', '/colecoes/'], [c.titulo, caminho]])], partilha: ctx.manifesto.partilha[`colecao-${c.slug}`], classe: 'pagina-colecao' };
}

// ---------------------------------------------------------------- contactos
export function contactos(ctx) {
  const c = ctx.site.contactos;
  const e = ctx.site.empresa || {};
  const cartoes = [];
  if (c.instagram) cartoes.push(['instagram', 'Instagram', `<a ${atributosInstagram(ctx)}>@${esc(c.instagram)}</a><span class="contacto__nota">É por aqui que recebo as encomendas.</span>`]);
  if (c.email) cartoes.push(['carta', 'Email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`]);
  if (c.whatsapp) cartoes.push(['whatsapp', 'WhatsApp', `<a href="https://wa.me/351${esc(String(c.whatsapp).replace(/\D/g, '').slice(-9))}" target="_blank" rel="noopener">Enviar mensagem</a>`]);
  if (c.facebook) cartoes.push(['facebook', 'Facebook', `<a href="https://www.facebook.com/${esc(c.facebook)}" target="_blank" rel="noopener">${esc(ctx.site.marca)}</a>`]);
  if (ctx.site.local.localidade || e.morada) cartoes.push(['local', 'Onde estou', `${esc(e.morada ? moradaCompleta(e) : ctx.site.local.localidade)}<span class="contacto__nota">Entregas em mão combinadas na conversa.</span>`]);
  const ident = [e.nome, e.tipo, e.nif && `NIF ${e.nif}`].filter(Boolean).map(esc).join(' · ');
  const conteudo = `
<div class="contentor pagina-texto pagina-contactos">
  ${cabecaPagina({ titulo: 'Contactos', texto: 'Cada encomenda começa com uma conversa. Vamos conversar?' })}
  <ul class="contactos" role="list">
    ${cartoes.map(([i, t, v]) => `<li class="contacto"><span class="contacto__icone">${ico(i)}</span><div><h2>${esc(t)}</h2><p>${v}</p></div></li>`).join('\n    ')}
  </ul>
  <p class="contactos__pedido"><a class="botao" href="${ctx.url('/pedido/')}">${ico('saco')}Fazer um pedido</a></p>
  <p class="contactos__identificacao">${ident || (ctx.producao ? '' : ctx.marcador('o nome, o tipo e o NIF de quem vende'))}</p>
</div>`;
  return { caminho: '/contactos/', titulo: 'Contactos', descricao: 'Fala comigo pelo Instagram: é por lá que recebo as encomendas de flower boxes, velas, Wax Melts e presentes personalizados.', conteudo, jsonld: [trilho(ctx, [['Início', '/'], ['Contactos', '/contactos/']])], classe: 'pagina-contactos' };
}

// ---------------------------------------------------------------- o pedido
export function pedido(ctx) {
  const c = ctx.site.contactos;
  const canais = [
    c.instagram ? ['instagram', 'Enviar pelo Instagram'] : null,
    c.whatsapp ? ['whatsapp', 'Enviar pelo WhatsApp'] : null,
    c.email ? ['carta', 'Enviar por email', 'email'] : null,
  ].filter(Boolean);
  const conteudo = `
<div class="contentor pagina-pedido" data-pedido>
  ${cabecaPagina({ titulo: 'O teu pedido', texto: 'Junta as peças, conta-me para quem é e envia: respondo com o preço total e o prazo.' })}
  <div class="pedido__vazio" data-vazio hidden>
    <p class="pedido__vazio-titulo">Ainda não juntaste nenhuma peça.</p>
    <p><a class="botao" href="${ctx.url('/loja/')}">Ver a loja${ico('seta')}</a></p>
    <p class="pedido__ou">Também podes escrever-me sem escolher nada: conta-me a tua ideia no formulário abaixo.</p>
  </div>
  <div class="pedido__grelha">
    <section class="pedido__pecas" aria-labelledby="p-pecas">
      <h2 class="so-leitor" id="p-pecas">As peças</h2>
      <ul class="linhas" role="list" data-linhas></ul>
    </section>
    <form class="pedido__form" data-formulario novalidate>
      <h2>Os teus dados</h2>
      <label class="campo" for="f-nome"><span>Nome</span><input id="f-nome" name="nome" type="text" autocomplete="name" required maxlength="120"></label>
      <label class="campo" for="f-contacto"><span>Email ou telemóvel</span><input id="f-contacto" name="contacto" type="text" autocomplete="email" required maxlength="160"></label>
      <div class="campos-lado">
        <label class="campo" for="f-ocasiao"><span>Ocasião</span><select id="f-ocasiao" name="ocasiao"><option value="">Escolher…</option>${OCASIOES.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label class="campo" for="f-data"><span>Para quando</span><input id="f-data" name="data" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" autocomplete="off" data-data></label>
      </div>
      <fieldset class="escolha escolha--entrega">
        <legend>Entrega</legend>
        <div class="escolha__valores"><label><input type="radio" name="entrega" value="mao" checked><span>Em mão</span></label><label><input type="radio" name="entrega" value="envio"><span>Envio</span></label></div>
      </fieldset>
      <label class="campo" for="f-localidade" data-so-envio hidden><span>Localidade do envio</span><input id="f-localidade" name="localidade" type="text" autocomplete="address-level2" maxlength="80"></label>
      <label class="campo" for="f-mensagem"><span>Para quem é, e a tua ideia (opcional)</span><textarea id="f-mensagem" name="mensagem" rows="4" maxlength="1500" placeholder="As cores, a ocasião, um bocadinho sobre a pessoa…"></textarea></label>
      <p class="erro" data-erro hidden></p>
      <div class="pedido__enviar">
        ${canais.map(([i, t, canal], k) => `<button class="botao ${k ? 'botao--linha' : ''} botao--largo" type="submit" data-canal="${canal || i}">${ico(i)}${esc(t)}</button>`).join('\n        ')}
      </div>
      <p class="pedido__nota">${c.instagram ? 'O pedido é copiado e abre-se a nossa conversa no Instagram: só tens de colar e enviar.' : 'O pedido abre já escrito: és tu que o envias.'} Enviar não te obriga a nada.</p>
    </form>
  </div>
  <div class="pedido__enviado" data-enviado hidden>
    <h2>Pedido pronto a enviar</h2>
    <p data-enviado-texto></p>
    <div class="botoes"><button class="botao botao--linha" type="button" data-copiar>${ico('copiar')}Copiar o pedido</button><button class="botao botao--linha" type="button" data-novo>Começar outro pedido</button></div>
  </div>
</div>`;
  return { caminho: '/pedido/', titulo: 'O teu pedido', descricao: 'Junta as peças de que gostas e envia o pedido pelo Instagram: a Sara responde com o preço total e o prazo.', conteudo, indexar: false, classe: 'pagina-pedido' };
}

// ---------------------------------------------------------------- páginas de texto
export function texto(ctx, m) {
  const legal = Boolean(m.atualizado);
  const foto = m.foto && ctx.manifesto.fotos[m.foto] ? m.foto : '';
  const conteudo = `
<article class="contentor pagina-texto${foto ? ' pagina-texto--foto' : ''}${legal ? ' pagina-texto--legal' : ''}">
  ${cabecaPagina({ titulo: m.titulo, texto: m.subtitulo || '', extra: legal ? `<p class="atualizado">Atualizado a ${esc(m.atualizado.split('-').reverse().join('/'))}</p>` : '' })}
  <div class="leitura__grelha">
    <div class="leitura">${m.html}</div>
    ${foto ? `<figure class="leitura__foto">${imagem(ctx, foto, { tamanhos: '(min-width: 860px) 420px, 100vw', moldura: 4 / 5 })}</figure>` : ''}
  </div>
</article>`;
  return { caminho: m.caminho, titulo: m.tituloSeo || m.titulo, descricao: m.descricao || '', conteudo, indexar: m.indexar && !legal, jsonld: [trilho(ctx, [['Início', '/'], [m.titulo, m.caminho]])], classe: legal ? 'pagina-legal' : 'pagina-leitura' };
}

// ---------------------------------------------------------------- 404
export function erro404(ctx) {
  const conteudo = `
<div class="contentor pagina-texto erro404">
  <img class="erro404__tulipas" src="${ctx.asset(`img/${ctx.manifesto.motivo.webp}`)}" width="${ctx.manifesto.motivo.w}" height="${ctx.manifesto.motivo.h}" alt="" decoding="async">
  ${cabecaPagina({ titulo: 'Esta página não existe', texto: 'Pode ter mudado de sítio. Procura na loja, ou volta ao início.' })}
  <div class="botoes botoes--centro"><a class="botao" href="${ctx.url('/loja/')}">Ver a loja${ico('seta')}</a><a class="botao botao--linha" href="${ctx.url('/')}">Página inicial</a></div>
</div>`;
  return { caminho: '/404.html', titulo: 'Página não encontrada', descricao: 'Esta página não existe.', conteudo, indexar: false, classe: 'pagina-404' };
}
