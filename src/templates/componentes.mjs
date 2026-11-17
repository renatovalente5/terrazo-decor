// As peças que se repetem: fotografias, o logótipo, os cartões (peça e coleção), as pastilhas das categorias
// e as peças legais comuns. O aspeto é o do desenho A «Linho» (17 nov 2026).
import { esc, euros } from './util.mjs';
import { ico } from './icones.mjs';
import { precoDe } from '../lib/regras.mjs';
import { livroReclamacoes, VERSAO as LEGAL_COMUM_VERSAO } from '../../legal-comum/index.mjs';

/* AS PEÇAS DA BIBLIOTECA legal-comum (a cópia está em legal-comum/; não se edita aqui), entre os
   marcadores que o verificar-versoes.mjs dela procura nas páginas publicadas. */
export const pecaLegal = (nome, html) => `<!-- legal-comum:${nome} v${LEGAL_COMUM_VERSAO} -->${html}<!-- /legal-comum:${nome} -->`;

/* O Livro de Reclamações Eletrónico na variante DISCRETA da biblioteca (ícone e texto, a letra e a cor
   das ligações vizinhas, sem caixa), e só no rodapé. */
export const livroBotao = () => pecaLegal('livro', livroReclamacoes());

// ---------------------------------------------------------------- fotografias
/** O endereço de uma versão web de uma fotografia (scripts/imagens.py). */
export function urlFoto(ctx, nome, largura, fmt = 'webp') {
  const m = ctx.manifesto.fotos[nome] || ctx.manifesto.posters[nome];
  const w = largura ?? m.larguras[m.larguras.length - 1];
  return ctx.asset(`img/${nome}-${m.resumo}-${w}.${fmt}`);
}

/* O sizes de uma fotografia cortada numa moldura (object-fit: cover): uma fotografia mais larga do que
   a moldura mostra-se mais larga do que a caixa (os lados ficam de fora) e precisa de mais píxeis. */
export function escalarSizes(sizes, f) {
  if (!(f > 1.01)) return sizes;
  const partes = [];
  let fundo = 0;
  let atual = '';
  for (const ch of sizes) {
    if (ch === '(') fundo++;
    if (ch === ')') fundo--;
    if (ch === ',' && fundo === 0) { partes.push(atual.trim()); atual = ''; } else atual += ch;
  }
  partes.push(atual.trim());
  const k = f.toFixed(3);
  return partes.map((x) => {
    const m = /^(\([^()]*\))\s+(.+)$/.exec(x);
    return m ? `${m[1]} calc(${m[2]} * ${k})` : `calc(${x} * ${k})`;
  }).join(', ');
}

/* <picture> com AVIF e WebP em várias larguras (só as que a fotografia tem: o imagens.py nunca
   aumenta). «tamanhos» é o atributo sizes (a largura a que a fotografia aparece): é com ele que o
   browser escolhe a versão. Fora do primeiro ecrã, loading="lazy". O ponto de foco
   (content/fotos.json) diz onde se corta quando a moldura é de outra forma. «moldura»: a forma
   (largura/altura) da caixa onde a fotografia é cortada. */
export function imagem(ctx, nome, { tamanhos = '100vw', classe = '', prioridade = false, alt, foco, ate = Infinity, moldura = 0, cedo = false } = {}) {
  const m = ctx.manifesto.fotos[nome] || ctx.manifesto.posters[nome];
  if (!m) throw new Error(`imagem «${nome}» não existe em media/fotos`);
  if (moldura) tamanhos = escalarSizes(tamanhos, (m.largura / m.altura) / moldura);
  const info = ctx.fotos[nome] || {};
  const texto = alt ?? info.alt ?? '';
  const ponto = foco ?? info.foco ?? '50% 50%';
  const larguras = m.larguras.filter((w, i) => w <= ate || i === 0 || m.larguras[i - 1] < ate);
  const srcset = (fmt) => larguras.map((w) => `${ctx.asset(`img/${nome}-${m.resumo}-${w}.${fmt}`)} ${w}w`).join(', ');
  const fontes = m.formatos.filter((f) => f !== 'webp').map((f) => `<source type="image/${f}" srcset="${srcset(f)}" sizes="${tamanhos}">`).join('');
  const meio = larguras.find((w) => w >= 720) || larguras[larguras.length - 1];
  const estilo = ponto !== '50% 50%' ? ` style="object-position:${esc(ponto)}"` : '';
  const carga = prioridade ? ' fetchpriority="high"' : cedo ? '' : ' loading="lazy"';
  return `<picture${classe ? ` class="${esc(classe)}"` : ''}>${fontes}<img src="${ctx.asset(`img/${nome}-${m.resumo}-${meio}.webp`)}" srcset="${srcset('webp')}" sizes="${tamanhos}" width="${m.largura}" height="${m.altura}" alt="${esc(texto)}"${carga} decoding="async"${estilo}></picture>`;
}

/* Uma fotografia pequena (o menu, a procura, as linhas do pedido): só a versão de 360. */
export function miniatura(ctx, nome, { lado = 52, classe = 'mini' } = {}) {
  const m = ctx.manifesto.fotos[nome];
  const ponto = ctx.fotos[nome]?.foco || '50% 50%';
  return `<img class="${esc(classe)}" src="${urlFoto(ctx, nome, m.larguras[0])}" width="${lado}" height="${lado}" alt="" loading="lazy" decoding="async"${ponto !== '50% 50%' ? ` style="object-position:${esc(ponto)}"` : ''}>`;
}

// ---------------------------------------------------------------- o logótipo
/* O logótipo da Terrazo.Decor tal como é (media/marca/logo.png: o desenho dela, «terrazo.» e «Decor» a preto,
   só sem o fundo de linho, nunca redesenhado nem recolorido). «alto» é a altura em CSS. */
export function logo(ctx, { alto, classe = '', alt = '', prioridade = false } = {}) {
  const l = ctx.manifesto.logo;
  const alturas = Object.keys(l.altura).map(Number).sort((a, b) => a - b);
  const largo = Math.round((l.w * alto) / l.h);
  const src = l.altura[alturas.find((h) => h >= alto * 2) || alturas[alturas.length - 1]];
  const srcset = alturas.map((h) => `${ctx.asset(`img/${l.altura[h].webp}`)} ${l.altura[h].largura}w`).join(', ');
  const carga = prioridade ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<img${classe ? ` class="${esc(classe)}"` : ''} src="${ctx.asset(`img/${src.webp}`)}" srcset="${srcset}" sizes="${largo}px" width="${largo}" height="${alto}" alt="${esc(alt)}"${carga} decoding="async">`;
}

// ---------------------------------------------------------------- preços
/* O preço quando a Sara o publicou: «6,00 €», ou «desde 9,00 €» quando sobe com o tamanho ou as escolhas.
   Sem preço, a peça é feita por encomenda: o cartão diz «Por encomenda» e a ficha diz que o preço vem na
   confirmação, antes de aceitar. */
export function preco(p, { classe = 'preco', semPreco = '' } = {}) {
  const v = precoDe(p);
  if (v.valor === null) return semPreco ? `<p class="${classe} ${classe}--encomenda">${esc(semPreco)}</p>` : '';
  return `<p class="${classe}">${v.desde ? '<span class="preco__desde">desde </span>' : ''}<span class="preco__valor">${euros(v.valor)}</span></p>`;
}

// ---------------------------------------------------------------- cartões
/* A seta num círculo, igual em todos os cartões (decorativa: o cartão inteiro é a ligação). */
export const setaCirculo = () => `<span class="seta-circulo" aria-hidden="true">${ico('seta')}</span>`;

/* O cartão de uma peça: a fotografia (4:5, cantos redondos) e, no computador, a SEGUNDA fotografia ao passar o
   rato (em vez de aproximar todas as imagens da mesma maneira); o nome, o preço (ou «Por encomenda») e a seta.
   No máximo uma etiqueta («Novidade»). Sem botão de juntar: escolhe-se e junta-se na ficha. O cartão inteiro
   leva à ficha (a ligação do nome estende-se por cima dele com ::after). */
export const TAMANHOS_CARTAO = '(min-width: 1240px) 280px, (min-width: 980px) calc(25vw - 36px), (min-width: 640px) calc(33.3vw - 32px), calc(50vw - 24px)';
export function cartao(ctx, p, { titulo = 'h3', tamanhos = TAMANHOS_CARTAO, prioridade = false, cedo = false } = {}) {
  const segunda = p.fotos[1] && ctx.manifesto.fotos[p.fotos[1]] ? p.fotos[1] : '';
  return `<article class="cartao${segunda ? ' cartao--duas' : ''}">
  <div class="cartao__foto">${imagem(ctx, p.fotos[0], { tamanhos, prioridade, cedo, moldura: 4 / 5, alt: '' })}${segunda ? imagem(ctx, segunda, { tamanhos, moldura: 4 / 5, alt: '', classe: 'cartao__segunda' }) : ''}${p.novidade ? '<span class="cartao__etiqueta">Novidade</span>' : ''}</div>
  <div class="cartao__linha">
    <div>
      <${titulo} class="cartao__nome"><a href="${ctx.url(`/pecas/${p.slug}/`)}">${esc(p.nome)}</a></${titulo}>
      ${preco(p, { classe: 'cartao__preco', semPreco: 'Por encomenda' })}
    </div>
    ${setaCirculo()}
  </div>
</article>`;
}

/* O cartão de uma coleção: a fotografia (4:5), a época em letras pequenas espaçadas, o título em itálico e a
   frase curta. O cartão inteiro leva à coleção. */
export function cartaoColecao(ctx, c, { tamanhos = '(min-width: 1240px) 380px, (min-width: 860px) 31vw, 82vw', titulo = 'h3', foto = c.fotos[0] } = {}) {
  return `<article class="colecao-cartao">
  <div class="colecao-cartao__foto">${imagem(ctx, foto, { tamanhos, moldura: 4 / 5, alt: '' })}</div>
  <p class="etiqueta colecao-cartao__quando">${esc(c.quando || c.epoca)}</p>
  <${titulo} class="colecao-cartao__titulo"><a href="${ctx.url(`/colecoes/${c.slug}/`)}">${esc(c.titulo)}</a></${titulo}>
  <p class="colecao-cartao__resumo">${esc(c.resumo)}</p>
</article>`;
}

/* Um vídeo que toca sozinho por cima de uma imagem: sem som, em ciclo, só depois de a página carregar e quando
   se vê, nunca com «menos movimento» nem a poupar dados (o interface.js); o botão no canto pausa-o e retoma-o
   (WCAG 2.2.2: mais de 5 s de movimento). A imagem por baixo é a que fica para quem não o vê. */
export function videoAuto(ctx, nome) {
  return `<video class="video-auto" src="${ctx.asset(ctx.ficheiros.videos[nome])}" muted loop playsinline preload="none" aria-hidden="true" data-video-auto></video><button class="video-pausa" type="button" aria-label="Pausar o vídeo" data-pausa hidden>${ico('pausa')}${ico('play')}</button>`;
}

/* As pastilhas das categorias, por cima da grelha da loja: são PÁGINAS (/loja/<slug>/), e a página não volta
   ao topo quando se muda (o interface.js guarda onde estava a fila). */
export function pastilhas(ctx, atual) {
  const lista = [{ slug: '', nome: 'Tudo' }, ...ctx.categoriasComPecas];
  return `<nav class="pastilhas" aria-label="Categorias" data-pastilhas>
  <ul role="list">
    ${lista.map((c) => {
      const caminho = c.slug ? `/loja/${c.slug}/` : '/loja/';
      return `<li><a href="${ctx.url(caminho)}"${(atual || '') === c.slug ? ' aria-current="page"' : ''}>${esc(c.nome)}</a></li>`;
    }).join('\n    ')}
  </ul>
</nav>
<script>${REPOR_LUGAR}</script>`;
}

/* Repõe a página no sítio onde estava quando se carregou numa pastilha (o interface.js guardou-o): corre
   EM LINHA, logo a seguir à fila, antes da primeira pintura, e outra vez quando chegam as letras (que
   mudam uns píxeis a altura por cima), até a pessoa mexer na página. */
const REPOR_LUGAR = `(function(){try{var l=JSON.parse(sessionStorage.getItem('terrazo:lugar')||'null');if(!l||l.para!==location.pathname||Date.now()-l.t>15000)return;sessionStorage.removeItem('terrazo:lugar');document.documentElement.setAttribute('data-lugar','');var nav=document.querySelector('[data-pastilhas]'),ul=nav.querySelector('ul'),parado=false;function repor(){if(parado)return;var h=document.documentElement,s=h.style.scrollBehavior;h.style.scrollBehavior='auto';window.scrollTo(0,nav.getBoundingClientRect().top+window.scrollY-l.topo);ul.scrollLeft=l.esq;h.style.scrollBehavior=s;}repor();['wheel','touchstart','keydown','mousedown'].forEach(function(e){window.addEventListener(e,function(){parado=true;},{once:true,passive:true});});document.addEventListener('DOMContentLoaded',repor);window.addEventListener('load',repor);if(document.fonts)document.fonts.ready.then(repor);}catch(e){}})();`;
