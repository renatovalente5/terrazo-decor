/* AS REGRAS DOS DADOS DA TERRAZO.DECOR, NUM SÓ SÍTIO.
 *
 * Três leitores, e os três têm de ouvir o mesmo:
 *   · o gerador do site (scripts/build.mjs), antes de escrever as páginas;
 *   · o painel, no browser (o erro aparece por baixo do campo, antes de gravar);
 *   · o Worker do painel, ao gravar (recusa os problemas NOVOS que não sejam lembretes).
 * O painel usa uma CÓPIA BYTE A BYTE deste ficheiro (estatico/js/regras.js no repositório
 * terrazo-decor-painel, quando existir), com um teste de SHA-256 que falha se divergirem. Por isso é um ES module
 * puro: nenhum import, nada de node:*, fs, process ou require. Corre tal e qual no browser, num
 * Worker e no Node.
 * (A forma é a das regras dos outros sites do Renato — Dream Art, BE!Creative —; o modelo é o da
 * Terrazo.Decor, 17 nov 2026: um catálogo com preço quando a Sara o publicou e «por encomenda» no resto,
 * em que se juntam peças a um pedido que segue pelo Instagram; e as «coleções» de cada estação.)
 *
 * CADA PROBLEMA TEM UMA CLASSE:
 *   · bloqueia   — a publicação pára e o site fica como estava. Só a estrutura (um JSON que não se
 *                  lê, um ficheiro sem a forma que o gerador precisa) e o que todas as páginas usam
 *                  (o email, a página inicial). Em PRODUÇÃO, também os dados que a lei pede
 *                  (identificação, NIF, morada — DL 7/2004, art. 10.º; prazos e pagamento — DL
 *                  24/2014, art. 4.º).
 *   · neutraliza — uma peça (ou uma coleção), só na cópia que o gerador lê (o ficheiro do
 *                  repositório não muda — ver neutralizar()): sem nome, sem texto, sem fotografia,
 *                  numa categoria que não existe — fica escondida do site; uma fotografia que não
 *                  existe não aparece. Um problema de UMA peça nunca pára a publicação das outras.
 *   · avisa      — só aviso. No painel, os que não são lembrete são erro de campo (valor fora da
 *                  lista, número fora dos limites, texto comprido de mais): o painel não os deixa
 *                  gravar. Os LEMBRETES (lembrete: true) não são erro de ninguém: o painel grava na
 *                  mesma e mostra-os no Início.
 *
 * dados = {
 *   site:        texto | objecto | null,               content/site.json
 *   inicio:      texto | objecto | null,               content/inicio.json
 *   categorias:  texto | objecto | null,               content/categorias.json
 *   fotos:       texto | objecto | null,               content/fotos.json
 *   artigos:     { <nome>: texto | objecto | null },   content/produtos/<nome>.json   (as peças)
 *   colecoes: { <nome>: texto | objecto | null },   content/colecoes/<nome>.json
 *   ficheirosFotos: [nome],  os nomes (sem .jpg) dos ficheiros em media/fotos/
 *   videos:         [nome],  os nomes (sem .mp4) dos vídeos em media/video/
 * }
 *   <nome> é o nome do ficheiro sem «.json», que é o endereço da página (/pecas/<nome>/,
 *   /colecoes/<nome>/). texto = o conteúdo do ficheiro; null = não existe. Uma chave de topo
 *   AUSENTE não se confere (o painel pode conferir só uma peça); presente e null é «falta o ficheiro».
 *
 * problema = {
 *   classe:   'bloqueia' | 'neutraliza' | 'avisa',
 *   chave:    estável ('artigo:<slug>:<regra>', 'site:<campo>[:<regra>]'…). O Worker compara as
 *             chaves do HEAD com as da gravação e recusa só as novas; por isso UMA CHAVE TEM SEMPRE A
 *             MESMA CLASSE (o que muda com a produção tem uma chave própria, com «:producao»).
 *   ficheiro: o caminho do ficheiro;
 *   ecra:     o ecrã do painel onde se corrige («Peças › Moldura livro»);
 *   mensagem: para os donos, em português simples, sem caminhos de JSON;
 *   campo?:   o campo onde o painel mostra o erro ('resumo', 'opcoes.0.nome');
 *   efeito?:  só nos «neutraliza»: 'esconder' | 'sem_fotografia';
 *   slug?, foto?, indice?, lembrete?
 * }
 *
 * «NÃO FOI DITO» E NULL SÃO O MESMO. E o vazio testa-se ANTES de converter: Number(null) é 0, e 0
 * é uma escolha.
 */

/* ------------------------------------------------------------------ */
/* Onde estão as coisas                                                */
/* ------------------------------------------------------------------ */

export const FICHEIROS = Object.freeze({
  site: 'content/site.json',
  inicio: 'content/inicio.json',
  categorias: 'content/categorias.json',
  fotos: 'content/fotos.json',
});
export const PASTAS = Object.freeze({ artigos: 'content/produtos', colecoes: 'content/colecoes', fotos: 'media/fotos', videos: 'media/video' });
export const ficheiroDoArtigo = (nome) => `${PASTAS.artigos}/${nome}.json`;
export const ficheiroDaColecao = (nome) => `${PASTAS.colecoes}/${nome}.json`;
export const ficheiroDaFoto = (nome) => `${PASTAS.fotos}/${nome}.jpg`;

/* Os campos de uma peça, PELA ORDEM DO FORMULÁRIO. Uma chave nova entra por esta ordem
   (ordenarComo()); as que já estão no ficheiro ficam onde estão. */
export const CAMPOS_ARTIGO = Object.freeze([
  'nome', 'nomeCurto', 'fotos', 'resumo', 'descricao',
  'preco', 'desde',
  'inclui', 'medidas', 'composicao', 'opcoes', 'personalizacao', 'quantidadeMinima', 'video',
  'referencia', 'fabricante', 'avisos', 'perigos', 'idade', 'naoBrinquedo',
  'categoria', 'novidade', 'publicado', 'ordem',
]);
/* A informação legal de cada peça, toda opcional e só mostrada na ficha quando está preenchida: a
   referência e o fabricante (Regulamento (UE) 2023/988, art. 19.º: nome, morada e email — vazio, a
   ficha diz os dados da loja), os avisos de segurança (um por linha), os perigos de uma mistura —
   velas, gesso perfumado (Regulamento (CE) 1272/2008, CLP; um por linha) —, a idade recomendada e
   «Não é um brinquedo» (DL 43/2011). */
export const CAMPOS_FABRICANTE = Object.freeze(['nome', 'morada', 'email']);
/* Sempre escritos pelo painel, com o valor explícito. Ausentes valem o valor por omissão (é o que o
   gerador faz). */
export const BOOLEANOS_ARTIGO = Object.freeze(['desde', 'novidade', 'publicado']);
export const POR_OMISSAO = Object.freeze({ publicado: true, novidade: false, desde: false, quantidadeMinima: 1, ordem: 500 });

export const NOMES_CAMPOS = Object.freeze({
  nome: 'Nome da peça', nomeCurto: 'Nome curto', fotos: 'Fotografias', resumo: 'Frase curta', descricao: 'Descrição',
  preco: 'Preço', desde: '«Desde»',
  referencia: 'Referência', fabricante: 'Fabricante', avisos: 'Avisos de segurança', perigos: 'Perigos (misturas)', idade: 'Idade recomendada', naoBrinquedo: 'Não é um brinquedo',
  inclui: 'O que inclui', medidas: 'Medidas', composicao: 'Composição dos tecidos', opcoes: 'Escolhas', personalizacao: 'Personalização',
  quantidadeMinima: 'Quantidade mínima', video: 'Vídeo',
  categoria: 'Categoria', novidade: 'Novidade', publicado: 'Publicada no site', ordem: 'Posição na lista',
});

/* Os três campos da personalização, que cada peça liga ou desliga. No pedido, o nome e a data,
   ligados, pedem-se (mas não são obrigatórios: o orçamento faz-se na conversa); a frase é sempre
   opcional. Os rótulos mudam-se por peça (rotuloNome: «Nomes dos noivos»). */
export const CAMPOS_PERSONALIZACAO = Object.freeze(['nome', 'data', 'frase']);
export const ROTULOS_PERSONALIZACAO = Object.freeze({ nome: 'Nome', data: 'Data', frase: 'Tema, cores ou frase' });

/* As ocasiões de um pedido (o campo «Coleção» do formulário). */
export const OCASIOES = Object.freeze(['Natal', 'Aniversário', 'Dia da Mãe', 'Casamento', 'Batizado', 'Agradecimento', 'Para mim', 'Outra']);

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

/* Os números: [mínimo, máximo]. */
export const LIMITES = Object.freeze({ preco: [0.01, 100000], ordem: [0, 9999], quantidadeMinima: [1, 1000] });
/* Tamanhos máximos dos textos, em caracteres. */
export const TAMANHOS = Object.freeze({
  nome: 120, nomeCurto: 40, resumo: 300, descricao: 6000, composicao: 300,
  referencia: 40, avisos: 600, perigos: 400, idade: 80, fabricanteNome: 120, fabricanteMorada: 200,
  inclui: 12, incluiTexto: 120, medidaRotulo: 40, medidaValor: 60, medidas: 12,
  opcoes: 6, valores: 16, opcaoNome: 40, valorNome: 60, rotulo: 60,
  fotos: 16, nomeFoto: 120, alt: 300, credito: 120,
  marca: 60, descricaoSite: 300, assinatura: 100, email: 160, telefone: 20, rede: 60, horario: 120,
  empresaNome: 160, empresaTipo: 80, nif: 20, morada: 160, codigoPostal: 12, localidade: 60, concelho: 60, iva: 200,
  avisoTexto: 140, ligacao: 200, prazo: 400, pagamento: 300, levantamento: 300, envio: 300, portes: 300,
  catNome: 40, catTitulo: 80, catResumo: 2000,
  inicioCurto: 60, inicioTitulo: 120, inicioTexto: 600, inicioLongo: 1200,
  colTitulo: 80, colEpoca: 60, colQuando: 40, colResumo: 300, colTexto: 3000, colProdutos: 16,
});
/* O que o Worker do painel aceita gravar (recusa acima); aqui só se lembra, a partir de 80 %. */
export const TECTOS = Object.freeze({ artigoBytes: 64 * 1024, siteBytes: 64 * 1024, aviso: 0.8 });

/* As palavras que a lei só deixa usar com prova (Diretiva (UE) 2024/825, aplicável desde 27 set
   2026: alegações ambientais genéricas) e as certificações que a BE!Creative não nos mostrou (CE,
   EN 71, FSC). Uma legenda antiga do Instagram dizia «sustentável» dos abre-caricas em bambu: no
   site, não. */
export const RE_ALEGACOES = /\b(ecol[óo]gic[oa]s?|sustent[áa]ve(l|is)|sustentabilidade|amig[oa]s? do ambiente|eco-?friendly|biodegrad[áa]ve(l|is)|neutr[oa]s? em carbono|certificad[oa]s?|FSC|EN ?71|marca[çc][ãa]o CE)\b/i;

/* ------------------------------------------------------------------ */
/* Ajudantes que o painel e o Worker também usam                      */
/* ------------------------------------------------------------------ */

const eObjecto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ausente = (x) => x === null || x === undefined;
const vazio = (x) => ausente(x) || (typeof x === 'string' && x.trim() === '') || (Array.isArray(x) && x.length === 0);
const temTexto = (x) => typeof x === 'string' && x.trim() !== '';
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const duasCasas = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const bytesDe = (s) => new TextEncoder().encode(s).length;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
export const dataValida = (s) => {
  if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};

export const terminacaoDe = (texto) => (typeof texto === 'string' && texto.endsWith('\n') ? '\n' : '');
/* Como os ficheiros estão escritos: 2 espaços e a terminação de cada um (todos com \n no fim). Abrir
   e gravar sem mexer deixa o ficheiro igual, byte a byte. */
export function serializar(obj, terminacao = '\n') { return JSON.stringify(obj, null, 2) + (terminacao || ''); }

/* O endereço da página, a partir do nome do ficheiro — IGUAL ao do gerador, que usa o nome tal e
   qual. */
export const slugDoFicheiro = (nome) => String(nome).replace(/\.json$/, '');
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugValido = (s) => typeof s === 'string' && s.length <= 100 && RE_SLUG.test(s);

/* NIF português: 9 algarismos (com ou sem espaços), o primeiro nunca é 0, e o de controlo (módulo
   11). */
export function nifValido(nif) {
  const s = String(nif ?? '').replace(/\s/g, '');
  if (!/^[1-9][0-9]{8}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(s[i]) * (9 - i);
  const resto = soma % 11;
  return (resto < 2 ? 0 : 11 - resto) === Number(s[8]);
}

/* O SLUG DE UMA PEÇA (ou coleção) NOVA: gerado UMA vez, ao criar, a partir do nome, e nunca mais
   muda — é o endereço da página que a marca partilha no Instagram. Minúsculas, sem acentos, o resto
   passa a hífen («Vela & Concha» → vela-concha). Repetido: -2, -3… */
export function gerarSlug(nome, existentes = []) {
  const ja = existentes instanceof Set ? existentes : new Set(existentes);
  let base = String(ausente(nome) ? '' : nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '');
  if (!base) base = 'peca';
  let slug = base;
  for (let n = 2; ja.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/* O NOME DE UMA FOTOGRAFIA: o do ficheiro em media/fotos/, sem «.jpg». Só minúsculas, algarismos e
   hífens (um espaço num nome parte o srcset). */
export const nomeDeFotoValido = (n) => typeof n === 'string' && n.length <= TAMANHOS.nomeFoto && RE_SLUG.test(n);

/* Caracteres de controlo, por escape e nunca literais no código. */
const RE_CONTROLO_LINHA = /[\u0000-\u001F\u007F]/;
const RE_CONTROLO_TEXTO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/* «</script» e «<!--»: dentro de um <script> do JSON-LD, um fecha o elemento a meio e o outro muda a
   forma como o browser o lê. Não há texto honesto que os precise. */
const RE_PARTE_A_PAGINA = /<\/script|<!--/i;

export const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const emailValido = (v) => typeof v === 'string' && v.length <= TAMANHOS.email && RE_EMAIL.test(v.trim());

/* Um número português de 9 algarismos, ou com o indicativo (+351, 00351, 351). → os 9 algarismos, ou
   null. */
export function numeroPortugues(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  let d = String(v).replace(/[\s.-]/g, '');
  if (d.startsWith('+351')) d = d.slice(4); else if (d.startsWith('00351')) d = d.slice(5); else if (/^351\d{9}$/.test(d)) d = d.slice(3);
  return /^[29]\d{8}$/.test(d) ? d : null;
}
export const eTelemovel = (v) => /^9[1236]\d{7}$/.test(numeroPortugues(v) ?? '');

/* O preço de uma peça, se o houver. Na BE!Creative quase tudo é por orçamento: sem preço, a ficha
   não mostra preço nenhum (e o pedido diz «orçamento»). Com preço, «desde» quando o preço sobe com
   as escolhas ou a quantidade. → { valor: número | null, desde } */
export function precoDe(p) {
  const valor = eObjecto(p) && typeof p.preco === 'number' && Number.isFinite(p.preco) && p.preco > 0 ? p.preco : null;
  return { valor, desde: Boolean(valor && p.desde === true) };
}

/* As escolhas de uma peça, já limpas: só os grupos com nome e com dois valores ou mais, e só os
   valores com nome. Não têm acréscimo de preço: escolhe-se, e o orçamento vem depois. */
export function opcoesDe(a) {
  if (!eObjecto(a) || !Array.isArray(a.opcoes)) return [];
  return a.opcoes
    .filter((g) => eObjecto(g) && temTexto(g.nome) && Array.isArray(g.valores))
    .map((g) => ({ nome: g.nome.trim(), valores: g.valores.filter((v) => eObjecto(v) && temTexto(v.nome)).map((v) => ({ nome: v.nome.trim() })) }))
    .filter((g) => g.valores.length >= 2);
}

/* A personalização de uma peça, já limpa: os campos ligados, com o rótulo (o da peça ou o geral). */
export function personalizacaoDe(a) {
  const p = eObjecto(a) && eObjecto(a.personalizacao) ? a.personalizacao : {};
  const rotulos = { nome: p.rotuloNome, data: p.rotuloData, frase: p.rotuloFrase };
  return CAMPOS_PERSONALIZACAO.filter((c) => p[c] === true).map((c) => ({
    id: c,
    rotulo: temTexto(rotulos[c]) ? rotulos[c].trim() : ROTULOS_PERSONALIZACAO[c],
  }));
}

/* A quantidade mínima de uma peça (as lembranças e os convites pedem-se às dezenas). */
export const quantidadeMinimaDe = (a) => {
  const q = eObjecto(a) ? a.quantidadeMinima : null;
  return typeof q === 'number' && Number.isInteger(q) && q >= LIMITES.quantidadeMinima[0] && q <= LIMITES.quantidadeMinima[1] ? q : 1;
};

/* Igualdade de valores lidos de JSON, com null ≡ ausente e sem ligar à ordem das chaves. */
export function mesmoValor(a, b) {
  if (ausente(a) && ausente(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => mesmoValor(x, b[i]));
  }
  if (eObjecto(a) || eObjecto(b)) {
    if (!eObjecto(a) || !eObjecto(b)) return false;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!mesmoValor(a[k], b[k])) return false;
    return true;
  }
  return a === b;
}

/* Os textos de um valor (em profundidade), com o caminho de cada um. */
function textosDe(v, caminho = '') {
  if (typeof v === 'string') return [[caminho, v]];
  const filhos = Array.isArray(v) ? Array.from(v, (x, i) => [i, x]) : eObjecto(v) ? Object.entries(v) : [];
  return filhos.flatMap(([k, x]) => textosDe(x, caminho ? `${caminho}.${k}` : String(k)));
}

/* Lê um ficheiro: o TEXTO (string), o objecto já lido, ou null/undefined. */
function lerJson(valor) {
  if (ausente(valor)) return { ausente: true };
  if (typeof valor !== 'string') return { obj: valor, texto: null };
  try { return { obj: JSON.parse(valor), texto: valor }; } catch (e) { return { ilegivel: String((e && e.message) || e).slice(0, 120), texto: valor }; }
}

/* As categorias de content/categorias.json: [{ slug, nome }], ou null se não se lê. */
export function categoriasDe(valor) {
  const l = lerJson(valor);
  if (!Array.isArray(l.obj)) return null;
  return l.obj.filter((c) => eObjecto(c) && temTexto(c.slug)).map((c) => ({ slug: c.slug, nome: temTexto(c.nome) ? c.nome.trim() : c.slug }));
}

/* As fotografias que existem para o site: as que têm ficheiro em media/fotos/ E entrada em
   content/fotos.json (o gerador precisa das duas: o ficheiro para as versões web, a entrada para o
   texto alternativo). → Set de nomes, ou null se não se sabe (sem a lista dos ficheiros). */
export function fotosQueExistem(dados) {
  const d = eObjecto(dados) ? dados : {};
  if (!Array.isArray(d.ficheirosFotos)) return null;
  const f = lerJson(d.fotos);
  const meta = eObjecto(f.obj) ? f.obj : {};
  return new Set(d.ficheirosFotos.filter((n) => eObjecto(meta[n])));
}

/* ------------------------------------------------------------------ */
/* Uma peça                                                            */
/* ------------------------------------------------------------------ */

/* No site, como o gerador decide: tudo menos `publicado: false`. */
export const noSite = (a) => eObjecto(a) && a.publicado !== false;
/* O nome que o ecrã mostra, numa linha só, cortado a 80. */
export const nomeDoArtigo = (a, slug) => {
  const n = eObjecto(a) && temTexto(a.nome) ? a.nome.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const curto = n.length > 80 ? `${n.slice(0, 79)}…` : n;
  return curto || slug || 'peça sem nome';
};
const ecraDoArtigo = (a, slug) => `Peças › ${nomeDoArtigo(a, slug)}`;

/* As fotografias de uma lista (peça ou coleção): o nome válido, sem repetidas, e que existam. */
function conferirFotos(lista, { fotosExistem, neutraliza, avisa, max = TAMANHOS.fotos, quem = 'a peça' }) {
  const vistos = new Set();
  let boas = 0;
  lista.forEach((f, indice) => {
    const extra = { foto: f, indice };
    if (!nomeDeFotoValido(f)) {
      neutraliza(`foto-invalida:${String(f).slice(0, 80)}`, 'sem_fotografia', 'fotos', `«${String(f).slice(0, 60)}» não é uma fotografia da biblioteca: não aparece no site. Tire-a e escolha-a outra vez.`, extra);
      return;
    }
    if (vistos.has(f)) { avisa(`foto-repetida:${f}`, 'fotos', `Há uma fotografia duas vezes n${quem.slice(1)}. Tire uma delas.`, extra); return; }
    vistos.add(f);
    if (fotosExistem && !fotosExistem.has(f)) {
      neutraliza(`foto-em-falta:${f}`, 'sem_fotografia', 'fotos', 'Uma das fotografias já não está na biblioteca: não aparece no site. Tire-a, ou carregue-a outra vez.', extra);
      return;
    }
    boas++;
  });
  if (lista.length > max) avisa('fotos-a-mais', 'fotos', `${quem.charAt(0).toUpperCase()}${quem.slice(1)} tem ${lista.length} fotografias; o máximo é ${max}. Tire as que estão a mais.`);
  return boas;
}

/* Os problemas de UMA peça. O painel usa-o campo a campo.
   ctx = { nome, categorias?: [slug] | null, fotos?: Set | null (as que existem),
           videos?: [nome] | null, producao?: boolean }
   O que falta no ctx não se confere. */
export function problemasDoArtigo(a, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const ficheiro = ficheiroDoArtigo(nome);
  const categorias = Array.isArray(ctx.categorias) ? ctx.categorias : null;
  const fotosExistem = ctx.fotos instanceof Set ? ctx.fotos : null;
  const videos = Array.isArray(ctx.videos) ? ctx.videos : null;
  const out = [];
  const ecra = ecraDoArtigo(a, slug);
  const base = { ficheiro, ecra, slug };
  const chave = (regra) => `artigo:${slug}:${regra}`;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ classe: 'neutraliza', chave: chave(regra), campo, efeito, mensagem, ...base, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: chave(regra), campo, mensagem, ...base, ...extra });
  const lembra = (regra, campo, mensagem, extra = {}) => avisa(regra, campo, mensagem, { lembrete: true, ...extra });
  if (!eObjecto(a)) return out;   // a forma do ficheiro é do problemas(): bloqueia

  // --- neutraliza: o que o site não pode mostrar --------------------------
  for (const [campo, falta, genero] of [['nome', 'o nome da peça', 'o'], ['resumo', 'a frase curta', 'a'], ['descricao', 'a descrição', 'a']]) {
    const x = a[campo];
    if (vazio(x)) neutraliza(campo, 'esconder', campo, `Falta ${falta}: a peça fica escondida do site até estar preenchid${genero}.`);
    else if (typeof x !== 'string') neutraliza(campo, 'esconder', campo, `«${NOMES_CAMPOS[campo]}» tem de ser texto: a peça fica escondida do site até ser corrigida.`);
  }
  const cat = a.categoria;
  if (vazio(cat)) neutraliza('categoria', 'esconder', 'categoria', 'Falta a categoria: a peça fica escondida do site até escolher uma.');
  else if (typeof cat !== 'string' || (categorias && !categorias.includes(cat))) neutraliza('categoria', 'esconder', 'categoria', 'A categoria não é nenhuma das do site: a peça fica escondida até escolher uma da lista.');

  /* O preço é opcional (a BE!Creative faz orçamentos). Escrito, tem de ser um número. */
  const p = a.preco;
  if (!vazio(p) && (typeof p !== 'number' || !Number.isFinite(p) || p < LIMITES.preco[0] || p > LIMITES.preco[1] || !duasCasas(p))) {
    avisa('preco', 'preco', 'O preço é só o número, sem € (ex.: 45 ou 44,50), ou fica vazio (por orçamento).');
  }

  const partem = [];
  for (const [caminho, t] of textosDe(a)) if (RE_PARTE_A_PAGINA.test(t)) partem.push(caminho.split('.')[0]);
  if (partem.length) {
    const campos = [...new Set(partem)];
    neutraliza('partia-a-pagina', 'esconder', campos[0], `${campos.map((c) => `«${NOMES_CAMPOS[c] || c}»`).join(', ')}: tem «</script» ou «<!--», que não podem ir para o site. A peça fica escondida do site até isso ser corrigido.`, { campos });
  }
  const alegam = [];
  for (const [caminho, t] of textosDe(a)) { const m = t.match(RE_ALEGACOES); if (m) alegam.push([caminho.split('.')[0], m[0]]); }
  if (alegam.length) {
    neutraliza('alegacoes', 'esconder', alegam[0][0], `«${alegam[0][1]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos): a peça fica escondida do site até a tirar.`, { campos: [...new Set(alegam.map((x) => x[0]))] });
  }

  // --- fotografias ---------------------------------------------------------
  const fotos = a.fotos;
  const lista = Array.isArray(fotos) ? fotos : [];
  if (!ausente(fotos) && !Array.isArray(fotos)) avisa('fotos', 'fotos', 'As fotografias não estão gravadas como uma lista. Escolha-as outra vez.');
  const boas = conferirFotos(lista, { fotosExistem, neutraliza, avisa, quem: 'a peça' });
  /* Sem nenhuma fotografia boa, o cartão da lista e o cartão de partilha não têm imagem: a peça fica
     escondida até ter uma. */
  if (!boas) neutraliza('sem-fotos', 'esconder', 'fotos', 'A peça não tem fotografias: fica escondida do site até ter pelo menos uma (a primeira é a capa).');

  // --- interruptores ---------------------------------------------------------
  for (const b of BOOLEANOS_ARTIGO) {
    if (!ausente(a[b]) && typeof a[b] !== 'boolean') avisa(b, b, `«${NOMES_CAMPOS[b]}» tem de ser sim ou não.`);
  }

  // --- números ---------------------------------------------------------------
  const o = a.ordem;
  if (!ausente(o) && o !== '' && (typeof o !== 'number' || !Number.isInteger(o) || o < LIMITES.ordem[0] || o > LIMITES.ordem[1])) {
    avisa('ordem', 'ordem', `A posição é um número inteiro de 0 a ${LIMITES.ordem[1]} (mais baixo aparece primeiro).`);
  }
  const q = a.quantidadeMinima;
  if (!ausente(q) && q !== '' && (typeof q !== 'number' || !Number.isInteger(q) || q < LIMITES.quantidadeMinima[0] || q > LIMITES.quantidadeMinima[1])) {
    avisa('quantidadeMinima', 'quantidadeMinima', `A quantidade mínima é um número inteiro de 1 a ${LIMITES.quantidadeMinima[1]} (1 = sem mínimo).`);
  }

  // --- o que inclui e as medidas -------------------------------------------------
  const inc = a.inclui;
  if (!ausente(inc)) {
    if (!Array.isArray(inc)) avisa('inclui', 'inclui', '«O que inclui» não está gravado como uma lista. Escreva-o outra vez.');
    else {
      if (inc.length > TAMANHOS.inclui) avisa('inclui:quantos', 'inclui', `«O que inclui» tem ${inc.length} linhas; o máximo é ${TAMANHOS.inclui}.`);
      inc.forEach((t, i) => {
        if (typeof t !== 'string' || !t.trim()) avisa(`inclui.${i}`, 'inclui', `A linha ${i + 1} de «O que inclui» está vazia: escreva-a ou tire-a.`);
        else if (t.length > TAMANHOS.incluiTexto) avisa(`inclui.${i}:tamanho`, 'inclui', `A linha ${i + 1} de «O que inclui» tem mais de ${TAMANHOS.incluiTexto} caracteres.`);
        else if (RE_CONTROLO_LINHA.test(t)) avisa(`inclui.${i}:controlo`, 'inclui', `A linha ${i + 1} de «O que inclui» tem caracteres invisíveis. Escreva-a outra vez.`);
      });
    }
  }
  const m = a.medidas;
  if (!ausente(m)) {
    if (!Array.isArray(m)) avisa('medidas', 'medidas', 'As medidas não estão gravadas como uma lista. Escreva-as outra vez.');
    else {
      if (m.length > TAMANHOS.medidas) avisa('medidas:quantas', 'medidas', `Há ${m.length} linhas de medidas; o máximo é ${TAMANHOS.medidas}.`);
      m.forEach((l, i) => {
        if (!eObjecto(l) || typeof l.rotulo !== 'string' || typeof l.valor !== 'string') { avisa(`medidas.${i}`, 'medidas', `A linha ${i + 1} das medidas não está como deve ser: escreva-a outra vez.`); return; }
        if (!temTexto(l.rotulo) || !temTexto(l.valor)) avisa(`medidas.${i}:vazia`, 'medidas', `A linha ${i + 1} das medidas está incompleta: escreva o nome (ex.: Altura) e a medida (ex.: 25 cm), ou tire a linha.`);
        if (l.rotulo.length > TAMANHOS.medidaRotulo || l.valor.length > TAMANHOS.medidaValor) avisa(`medidas.${i}:tamanho`, 'medidas', `A linha ${i + 1} das medidas é comprida de mais.`);
      });
    }
  }

  /* A composição dos tecidos (Regulamento (UE) 1007/2011, art. 16.º): numa peça com toalha, tem de
     estar no site antes da compra. Na pré-visualização lembra; no domínio esconde a peça. */
  const comToalha = /\btoalhas?\b/i.test(`${typeof a.nome === 'string' ? a.nome : ''} ${Array.isArray(a.inclui) ? a.inclui.join(' ') : ''}`);
  if (comToalha && vazio(a.composicao)) {
    if (ctx.producao) neutraliza('composicao:producao', 'esconder', 'composicao', 'Falta a composição da toalha (ex.: «Toalha: 100 % linho»): a lei pede-a no site. A peça fica escondida até a escrever.');
    else lembra('composicao:previa', 'composicao', 'Falta a composição da toalha (ex.: «Toalha: 100 % linho»): a lei pede-a no site, e no site a sério a peça fica escondida até a escrever.');
  }
  if (!ausente(a.composicao) && a.composicao !== '' && typeof a.composicao !== 'string') avisa('composicao:tipo', 'composicao', '«Composição dos tecidos» tem de ser texto.');

  // --- escolhas ------------------------------------------------------------------
  const ops = a.opcoes;
  if (!ausente(ops)) {
    if (!Array.isArray(ops)) avisa('opcoes', 'opcoes', 'As escolhas não estão gravadas como uma lista. Escreva-as outra vez.');
    else {
      if (ops.length > TAMANHOS.opcoes) avisa('opcoes:quantas', 'opcoes', `A peça tem ${ops.length} escolhas; o máximo é ${TAMANHOS.opcoes}.`);
      const nomesG = new Set();
      ops.forEach((g, i) => {
        const onde = `A escolha ${i + 1}`;
        if (!eObjecto(g) || !Array.isArray(g.valores)) { avisa(`opcoes.${i}`, `opcoes.${i}`, `${onde} não está como deve ser: escreva-a outra vez.`); return; }
        if (!temTexto(g.nome)) avisa(`opcoes.${i}.nome`, `opcoes.${i}.nome`, `${onde} não tem nome (ex.: Caixa).`);
        else {
          if (g.nome.length > TAMANHOS.opcaoNome) avisa(`opcoes.${i}.nome:tamanho`, `opcoes.${i}.nome`, `O nome da escolha ${i + 1} tem mais de ${TAMANHOS.opcaoNome} caracteres.`);
          const k = g.nome.trim().toLowerCase();
          if (nomesG.has(k)) avisa(`opcoes.${i}.nome:repetido`, `opcoes.${i}.nome`, `Há duas escolhas com o nome «${g.nome.trim()}».`);
          nomesG.add(k);
        }
        if (g.valores.length < 2) avisa(`opcoes.${i}:poucos`, `opcoes.${i}.valores`, `${onde} tem de ter pelo menos dois valores para escolher (com um só não aparece).`);
        if (g.valores.length > TAMANHOS.valores) avisa(`opcoes.${i}:muitos`, `opcoes.${i}.valores`, `${onde} tem ${g.valores.length} valores; o máximo é ${TAMANHOS.valores}.`);
        const nomesV = new Set();
        g.valores.forEach((v, j) => {
          const ondeV = `opcoes.${i}.valores.${j}`;
          if (!eObjecto(v) || !temTexto(v.nome)) { avisa(`${ondeV}.nome`, ondeV, `${onde}: o valor ${j + 1} não tem nome.`); return; }
          if (v.nome.length > TAMANHOS.valorNome) avisa(`${ondeV}.nome:tamanho`, ondeV, `${onde}: o valor «${v.nome.slice(0, 30)}» tem mais de ${TAMANHOS.valorNome} caracteres.`);
          const kv = v.nome.trim().toLowerCase();
          if (nomesV.has(kv)) avisa(`${ondeV}.nome:repetido`, ondeV, `${onde}: o valor «${v.nome.trim()}» está repetido.`);
          nomesV.add(kv);
        });
      });
    }
  }

  // --- personalização ------------------------------------------------------------
  const pers = a.personalizacao;
  if (!ausente(pers)) {
    if (!eObjecto(pers)) avisa('personalizacao', 'personalizacao', 'A personalização não está gravada como deve ser: ligue ou desligue outra vez.');
    else {
      for (const c of CAMPOS_PERSONALIZACAO) if (!ausente(pers[c]) && typeof pers[c] !== 'boolean') avisa(`personalizacao.${c}`, `personalizacao.${c}`, `«${ROTULOS_PERSONALIZACAO[c]}» da personalização tem de ser sim ou não.`);
      for (const k of ['rotuloNome', 'rotuloData', 'rotuloFrase']) {
        const v = pers[k];
        if (ausente(v) || v === '') continue;
        if (typeof v !== 'string' || v.length > TAMANHOS.rotulo || RE_CONTROLO_LINHA.test(v)) avisa(`personalizacao.${k}`, `personalizacao.${k}`, `O nome do campo da personalização tem de ser texto curto (até ${TAMANHOS.rotulo} caracteres), ou fica vazio.`);
      }
    }
  }

  const v = a.video;
  if (!ausente(v) && v !== '' && (typeof v !== 'string' || (videos && !videos.includes(v)))) avisa('video', 'video', 'O vídeo escolhido não existe: escolha outro, ou nenhum.');

  // --- textos -------------------------------------------------------------
  const texto = (campo, max, { linha = true } = {}) => {
    const x = a[campo];
    if (ausente(x) || typeof x !== 'string') return;
    if (x.length > max) avisa(`${campo}:tamanho`, campo, `«${NOMES_CAMPOS[campo]}» tem mais de ${max} caracteres (tem ${x.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(x)) avisa(`${campo}:controlo`, campo, `«${NOMES_CAMPOS[campo]}» tem caracteres invisíveis${linha ? ' (ex.: uma mudança de linha)' : ''}. Escreva-o outra vez.`);
  };
  texto('nome', TAMANHOS.nome);
  texto('nomeCurto', TAMANHOS.nomeCurto);
  texto('resumo', TAMANHOS.resumo, { linha: false });
  texto('descricao', TAMANHOS.descricao, { linha: false });
  texto('composicao', TAMANHOS.composicao);

  // --- a informação legal da peça (opcional) --------------------------------
  const fab = a.fabricante;
  if (!ausente(fab)) {
    if (!eObjecto(fab)) avisa('fabricante', 'fabricante', 'O fabricante não está gravado como deve ser: escreva-o outra vez.');
    else {
      for (const [k, max, rotulo] of [['nome', TAMANHOS.fabricanteNome, 'Nome do fabricante'], ['morada', TAMANHOS.fabricanteMorada, 'Morada do fabricante']]) {
        const x = fab[k];
        if (ausente(x) || x === '') continue;
        if (typeof x !== 'string' || x.length > max || RE_CONTROLO_LINHA.test(x)) avisa(`fabricante.${k}`, `fabricante.${k}`, `«${rotulo}» tem de ser um texto numa linha, até ${max} caracteres.`);
      }
      if (!vazio(fab.email) && !emailValido(fab.email)) avisa('fabricante.email', 'fabricante.email', 'O email do fabricante não parece estar certo (ex.: nome@exemplo.pt).');
      const dados = CAMPOS_FABRICANTE.filter((k) => temTexto(fab[k]));
      if (dados.length && dados.length < CAMPOS_FABRICANTE.length && noSite(a)) {
        lembra('fabricante:incompleto', `fabricante.${CAMPOS_FABRICANTE.find((k) => !temTexto(fab[k]))}`, 'O fabricante está incompleto: a lei pede o nome, a morada e o email (Regulamento (UE) 2023/988, art. 19.º). Até estar completo, a ficha mostra os dados da marca.');
      }
    }
  }
  if (!ausente(a.naoBrinquedo) && typeof a.naoBrinquedo !== 'boolean') avisa('naoBrinquedo', 'naoBrinquedo', '«Não é um brinquedo» tem de ser sim ou não.');
  texto('referencia', TAMANHOS.referencia);
  texto('avisos', TAMANHOS.avisos, { linha: false });
  texto('perigos', TAMANHOS.perigos, { linha: false });
  texto('idade', TAMANHOS.idade);
  for (const campo of ['referencia', 'avisos', 'perigos', 'idade']) {
    if (!ausente(a[campo]) && a[campo] !== '' && typeof a[campo] !== 'string') avisa(`${campo}:tipo`, campo, `«${NOMES_CAMPOS[campo]}» tem de ser texto.`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Uma coleção (o portefólio de eventos reais)                      */
/* ------------------------------------------------------------------ */

export const CAMPOS_COLECAO = Object.freeze(['titulo', 'epoca', 'quando', 'resumo', 'texto', 'fotos', 'produtos', 'destaque', 'publicado', 'ordem']);
export const NOMES_CAMPOS_COLECAO = Object.freeze({
  titulo: 'Título', epoca: 'Época', quando: 'Quando', resumo: 'Frase curta', texto: 'Texto', fotos: 'Fotografias',
  produtos: 'Peças desta coleção', destaque: 'Na página inicial', publicado: 'Publicada no site', ordem: 'Posição na lista',
});
export const nomeDaColecao = (c, slug) => (eObjecto(c) && temTexto(c.titulo) ? c.titulo.replace(/\s+/g, ' ').trim().slice(0, 80) : slug || 'coleção sem título');

/* ctx = { nome, fotos?: Set | null, artigos?: [slug] | null } */
export function problemasDaColecao(c, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const ficheiro = ficheiroDaColecao(nome);
  const fotosExistem = ctx.fotos instanceof Set ? ctx.fotos : null;
  const artigos = Array.isArray(ctx.artigos) ? ctx.artigos : null;
  const out = [];
  const ecra = `Coleções › ${nomeDaColecao(c, slug)}`;
  const base = { ficheiro, ecra, slug };
  const chave = (regra) => `colecao:${slug}:${regra}`;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ classe: 'neutraliza', chave: chave(regra), campo, efeito, mensagem, ...base, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: chave(regra), campo, mensagem, ...base, ...extra });
  if (!eObjecto(c)) return out;
  for (const [campo, falta] of [['titulo', 'o título'], ['epoca', 'a época'], ['resumo', 'a frase curta']]) {
    const x = c[campo];
    if (vazio(x)) neutraliza(campo, 'esconder', campo, `Falta ${falta}: a coleção fica escondida do site até estar preenchida.`);
    else if (typeof x !== 'string') neutraliza(campo, 'esconder', campo, `«${NOMES_CAMPOS_COLECAO[campo]}» tem de ser texto: a coleção fica escondida até ser corrigida.`);
  }
  for (const [caminho, t] of textosDe(c)) {
    if (RE_PARTE_A_PAGINA.test(t)) { neutraliza('partia-a-pagina', 'esconder', caminho.split('.')[0], 'Há um texto com «</script» ou «<!--», que não podem ir para o site. A coleção fica escondida até isso ser corrigido.'); break; }
  }
  for (const [caminho, t] of textosDe(c)) {
    const m = t.match(RE_ALEGACOES);
    if (m) { neutraliza('alegacoes', 'esconder', caminho.split('.')[0], `«${m[0]}» é uma palavra que a lei só deixa usar com prova: a coleção fica escondida até a tirar.`); break; }
  }
  const lista = Array.isArray(c.fotos) ? c.fotos : [];
  if (!ausente(c.fotos) && !Array.isArray(c.fotos)) avisa('fotos', 'fotos', 'As fotografias não estão gravadas como uma lista. Escolha-as outra vez.');
  const boas = conferirFotos(lista, { fotosExistem, neutraliza, avisa, max: 24, quem: 'a coleção' });
  if (!boas) neutraliza('sem-fotos', 'esconder', 'fotos', 'A coleção não tem fotografias: fica escondida do site até ter pelo menos uma.');
  const ps = c.produtos;
  if (!ausente(ps)) {
    if (!Array.isArray(ps)) avisa('produtos', 'produtos', 'As peças desta coleção não estão gravadas como uma lista. Escolha-as outra vez.');
    else {
      if (ps.length > TAMANHOS.colProdutos) avisa('produtos:quantas', 'produtos', `Há ${ps.length} peças; o máximo é ${TAMANHOS.colProdutos}.`);
      ps.forEach((s, i) => {
        if (!slugValido(s) || (artigos && !artigos.includes(s))) avisa(`produtos.${i}`, 'produtos', 'Uma das peças desta coleção já não existe: não aparece. Tire-a da lista.', { indice: i });
      });
    }
  }
  for (const [campo, max, linha] of [['titulo', TAMANHOS.colTitulo, true], ['epoca', TAMANHOS.colEpoca, true], ['quando', TAMANHOS.colQuando, true], ['resumo', TAMANHOS.colResumo, false], ['texto', TAMANHOS.colTexto, false]]) {
    const x = c[campo];
    if (ausente(x) || typeof x !== 'string') continue;
    if (x.length > max) avisa(`${campo}:tamanho`, campo, `«${NOMES_CAMPOS_COLECAO[campo]}» tem mais de ${max} caracteres (tem ${x.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(x)) avisa(`${campo}:controlo`, campo, `«${NOMES_CAMPOS_COLECAO[campo]}» tem caracteres invisíveis. Escreva-o outra vez.`);
  }
  for (const b of ['destaque', 'publicado']) if (!ausente(c[b]) && typeof c[b] !== 'boolean') avisa(b, b, `«${NOMES_CAMPOS_COLECAO[b]}» tem de ser sim ou não.`);
  const o = c.ordem;
  if (!ausente(o) && o !== '' && (typeof o !== 'number' || !Number.isInteger(o) || o < LIMITES.ordem[0] || o > LIMITES.ordem[1])) avisa('ordem', 'ordem', `A posição é um número inteiro de 0 a ${LIMITES.ordem[1]}.`);
  return out;
}

/* ------------------------------------------------------------------ */
/* content/site.json                                                   */
/* ------------------------------------------------------------------ */

export const SECCOES_SITE = Object.freeze({ contactos: 'Contactos', aviso: 'Aviso do topo', pedido: 'Pedidos, pagamento e entrega', empresa: 'Dados legais', marca: 'A marca' });
/* O que o painel nunca muda: a marca (o nome comercial, nos textos legais e no Google) e a
   localidade. */
export const BLOQUEADOS_SITE = Object.freeze(['marca', 'local']);

export function problemasDoSite(d, { producao = false } = {}) {
  const ficheiro = FICHEIROS.site;
  const out = [];
  const ecraDe = (s) => `Dados da marca › ${SECCOES_SITE[s] || s}`;
  const bloqueia = (chave, s, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `site:${chave}`, ficheiro, ecra: ecraDe(s), campo, mensagem });
  const avisa = (chave, s, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `site:${chave}`, ficheiro, ecra: ecraDe(s), campo, mensagem, ...extra });
  const legal = (chave, s, campo, mensagem) => (producao ? bloqueia(`${chave}:producao`, s, campo, mensagem) : avisa(chave, s, campo, mensagem, { lembrete: true }));
  if (!eObjecto(d)) { bloqueia('forma', 'marca', undefined, 'Os dados da marca não têm a forma certa. Só o Renato os pode corrigir.'); return out; }

  if (!temTexto(d.marca)) bloqueia('marca', 'marca', 'marca', 'Falta o nome da marca. Só o Renato o pode repor.');
  for (const s of ['contactos', 'empresa', 'pedido', 'local']) {
    if (!eObjecto(d[s])) bloqueia(`${s}:forma`, s, s, `A secção «${SECCOES_SITE[s] || s}» não está gravada, e sem ela o site não se consegue gerar. Só o Renato a pode repor.`);
  }
  const c = eObjecto(d.contactos) ? d.contactos : {};
  const e = eObjecto(d.empresa) ? d.empresa : {};
  const pd = eObjecto(d.pedido) ? d.pedido : {};
  /* A localidade ainda não foi dita pela Sara: lembra-se, sem parar (no domínio aberto, a morada da empresa
     já o pede). */
  if (eObjecto(d.local) && (!temTexto(d.local.localidade) || !temTexto(d.local.distrito))) avisa('local', 'marca', 'local', 'Falta a localidade e o distrito da marca (aparecem nos Contactos e no Google).', { lembrete: true });

  /* Textos simples: tamanho, caracteres invisíveis, «</script», alegações. */
  const textoSimples = (v, chave, s, campo, rotulo, max, { linha = true } = {}) => {
    if (ausente(v)) return;
    if (typeof v !== 'string') { avisa(`${chave}:tipo`, s, campo, `«${rotulo}» tem de ser texto.`); return; }
    if (v.length > max) avisa(`${chave}:tamanho`, s, campo, `«${rotulo}» tem mais de ${max} caracteres (tem ${v.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(v)) avisa(`${chave}:controlo`, s, campo, `«${rotulo}» tem caracteres invisíveis. Escreva-o outra vez.`);
    if (RE_PARTE_A_PAGINA.test(v)) bloqueia(`${chave}:parte`, s, campo, `«${rotulo}» tem «</script» ou «<!--», que não podem ir para o site.`);
    const m = v.match(RE_ALEGACOES);
    if (m) bloqueia(`${chave}:alegacao`, s, campo, `«${rotulo}»: «${m[0]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos). Tire-a.`);
  };

  // --- contactos ---------------------------------------------------------------
  /* Os pedidos seguem pelo Instagram (e pelo email ou pelo WhatsApp, quando houver): sem nenhum dos três o
     pedido não tem para onde ir. O email, a lei pede-o no site (DL 7/2004, art. 10.º): lembrado na
     pré-visualização, pára a publicação no domínio aberto. */
  if (!ausente(c.email) && c.email !== '' && !emailValido(c.email)) bloqueia('contactos.email', 'contactos', 'contactos.email', 'O email não parece estar certo (ex.: nome@exemplo.pt).');
  if (vazio(c.email)) legal('contactos.email:vazio', 'contactos', 'contactos.email', 'Falta o email: a lei pede um endereço de email no site (DL 7/2004, art. 10.º).');
  if (vazio(c.email) && vazio(c.instagram) && vazio(c.whatsapp)) bloqueia('contactos:nenhum', 'contactos', 'contactos.instagram', 'Falta por onde se recebem os pedidos: o Instagram, o email ou o WhatsApp.');
  if (!vazio(c.whatsapp) && !eTelemovel(c.whatsapp)) bloqueia('contactos.whatsapp', 'contactos', 'contactos.whatsapp', 'O WhatsApp tem de ser um telemóvel português de 9 algarismos (ex.: 912 345 678), ou fica vazio.');
  if (!vazio(c.telefone) && !numeroPortugues(c.telefone)) avisa('contactos.telefone', 'contactos', 'contactos.telefone', 'O telefone tem de ser um número português de 9 algarismos; até lá, a página de contactos não o mostra.');
  for (const [k, rotulo, exemplo] of [['instagram', 'Instagram', 'terrazo_decor'], ['facebook', 'Facebook', '61573808382422']]) {
    const v = c[k];
    if (!vazio(v) && (typeof v !== 'string' || !/^[A-Za-z0-9._-]{1,60}$/.test(v))) avisa(`contactos.${k}`, 'contactos', `contactos.${k}`, `${rotulo}: escreva só o nome da conta, sem @ nem endereço (ex.: ${exemplo}).`);
  }
  textoSimples(c.horario, 'contactos.horario', 'contactos', 'contactos.horario', 'Horário', TAMANHOS.horario);

  // --- empresa (os dados que a lei pede) ----------------------------------------
  if (vazio(e.nome)) legal('empresa.nome:vazio', 'empresa', 'empresa.nome', 'Falta o nome da empresa ou do empresário em nome individual (a lei pede-o no site).');
  if (!vazio(e.nif) && !nifValido(e.nif)) bloqueia('empresa.nif', 'empresa', 'empresa.nif', 'O NIF não é um NIF português válido: confira os 9 algarismos.');
  if (vazio(e.morada) && vazio(e.localidade)) legal('empresa.morada:vazio', 'empresa', 'empresa.morada', 'Falta a morada (ou, pelo menos, a localidade): a lei pede-a no site.');
  if (!vazio(e.codigoPostal) && !/^\d{4}-\d{3}$/.test(String(e.codigoPostal).trim())) avisa('empresa.codigoPostal', 'empresa', 'empresa.codigoPostal', 'O código postal tem a forma 3000-000.');
  /* O NIF, a morada completa e o IVA: lembrados, sem parar a publicação na pré-visualização (DL
     7/2004, art. 10.º: nome, morada geográfica, email e NIF, sempre à vista no site); no domínio
     aberto, o nome e o NIF param-na. */
  if (vazio(e.nif)) legal('empresa.nif:vazio', 'empresa', 'empresa.nif', 'Falta o NIF: a lei pede-o no site (DL 7/2004, art. 10.º).');
  if (vazio(e.morada) || vazio(e.codigoPostal)) avisa('empresa.morada:incompleta', 'empresa', vazio(e.morada) ? 'empresa.morada' : 'empresa.codigoPostal', 'A morada está incompleta: a lei pede a morada geográfica, com a rua, o número e o código postal (DL 7/2004, art. 10.º).', { lembrete: true });
  if (vazio(e.iva)) avisa('empresa.iva:vazio', 'empresa', 'empresa.iva', 'Falta dizer se os preços incluem IVA ou se há isenção (art. 53.º do CIVA): os termos dizem-no ao cliente.', { lembrete: true });
  for (const [k, max, rotulo] of [['nome', TAMANHOS.empresaNome, 'Nome'], ['tipo', TAMANHOS.empresaTipo, 'Tipo'], ['morada', TAMANHOS.morada, 'Morada'], ['localidade', TAMANHOS.localidade, 'Localidade'], ['concelho', TAMANHOS.concelho, 'Concelho'], ['iva', TAMANHOS.iva, 'IVA']]) {
    textoSimples(e[k], `empresa.${k}`, 'empresa', `empresa.${k}`, rotulo, max);
  }

  // --- aviso do topo ------------------------------------------------------------
  const av = d.aviso;
  if (!ausente(av)) {
    if (!eObjecto(av)) avisa('aviso:forma', 'aviso', 'aviso', 'O aviso do topo não está gravado como deve ser: escreva-o outra vez.');
    else {
      textoSimples(av.texto, 'aviso.texto', 'aviso', 'aviso.texto', 'Texto do aviso', TAMANHOS.avisoTexto);
      if (!vazio(av.ate) && !dataValida(av.ate)) avisa('aviso.ate', 'aviso', 'aviso.ate', 'A data até quando o aviso aparece não é uma data válida.');
      if (!vazio(av.ligacao) && (typeof av.ligacao !== 'string' || !/^\/[a-z0-9/-]*$/.test(av.ligacao))) avisa('aviso.ligacao', 'aviso', 'aviso.ligacao', 'A ligação do aviso tem de ser uma página do site (ex.: /criacoes/).');
    }
  }

  // --- pedidos, pagamento e entrega ---------------------------------------------
  if (vazio(pd.prazo)) legal('pedido.prazo:vazio', 'pedido', 'pedido.prazo', 'Falta o prazo: a lei pede que o cliente o saiba antes de encomendar.');
  if (vazio(pd.pagamento)) legal('pedido.pagamento:vazio', 'pedido', 'pedido.pagamento', 'Faltam as formas de pagamento: a lei pede que o cliente as saiba antes de encomendar.');
  textoSimples(pd.prazo, 'pedido.prazo', 'pedido', 'pedido.prazo', 'Prazos', TAMANHOS.prazo, { linha: false });
  textoSimples(pd.pagamento, 'pedido.pagamento', 'pedido', 'pedido.pagamento', 'Pagamento', TAMANHOS.pagamento, { linha: false });
  textoSimples(pd.levantamento, 'pedido.levantamento', 'pedido', 'pedido.levantamento', 'Levantamento', TAMANHOS.levantamento, { linha: false });
  textoSimples(pd.envio, 'pedido.envio', 'pedido', 'pedido.envio', 'Envio', TAMANHOS.envio, { linha: false });
  textoSimples(pd.portes, 'pedido.portes', 'pedido', 'pedido.portes', 'Portes', TAMANHOS.portes, { linha: false });
  if (vazio(pd.levantamento) && vazio(pd.envio)) avisa('pedido.entrega:vazia', 'pedido', 'pedido.envio', 'Diga como se recebe uma encomenda: levantamento, envio, ou os dois.', { lembrete: true });

  // --- a marca ----------------------------------------------------------------------
  textoSimples(d.descricao, 'descricao', 'marca', 'descricao', 'Descrição da marca', TAMANHOS.descricaoSite, { linha: false });
  textoSimples(d.assinatura, 'assinatura', 'marca', 'assinatura', 'Assinatura do rodapé', TAMANHOS.assinatura);
  return out;
}

/* ------------------------------------------------------------------ */
/* content/categorias.json                                             */
/* ------------------------------------------------------------------ */

export function problemasDasCategorias(valor, { fotos = null } = {}) {
  const ficheiro = FICHEIROS.categorias;
  const out = [];
  const bloqueia = (chave, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `categorias:${chave}`, ficheiro, ecra: 'Categorias', campo, mensagem });
  const avisa = (chave, campo, mensagem) => out.push({ classe: 'avisa', chave: `categorias:${chave}`, ficheiro, ecra: 'Categorias', campo, mensagem });
  const l = lerJson(valor);
  if (!Array.isArray(l.obj) || !l.obj.length) { bloqueia('forma', undefined, 'As categorias não se conseguem ler: sem elas o site não se consegue gerar. Só o Renato as pode corrigir.'); return out; }
  const slugs = new Set();
  l.obj.forEach((c, i) => {
    if (!eObjecto(c) || !slugValido(c.slug)) { bloqueia(`${i}:forma`, `${i}`, `A categoria ${i + 1} não tem a forma certa. Só o Renato a pode corrigir.`); return; }
    if (slugs.has(c.slug)) bloqueia(`${c.slug}:repetida`, `${i}`, `A categoria «${c.slug}» está repetida. Só o Renato a pode corrigir.`);
    slugs.add(c.slug);
    for (const [k, max, rotulo, obrigatorio] of [['nome', TAMANHOS.catNome, 'Nome', true], ['titulo', TAMANHOS.catTitulo, 'Título da página', true], ['resumo', TAMANHOS.catResumo, 'Texto da página', true]]) {
      const v = c[k];
      if (vazio(v)) { if (obrigatorio) bloqueia(`${c.slug}.${k}:vazio`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} está vazio.`); continue; }
      if (typeof v !== 'string') { bloqueia(`${c.slug}.${k}:tipo`, `${i}.${k}`, `«${rotulo}» da categoria ${c.slug} tem de ser texto.`); continue; }
      if (v.length > max) avisa(`${c.slug}.${k}:tamanho`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} tem mais de ${max} caracteres.`);
      if (RE_CONTROLO_TEXTO.test(v) || RE_PARTE_A_PAGINA.test(v)) bloqueia(`${c.slug}.${k}:controlo`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} tem caracteres que não podem ir para o site.`);
      const m = v.match(RE_ALEGACOES);
      if (m) bloqueia(`${c.slug}.${k}:alegacao`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug}: «${m[0]}» é uma palavra que a lei só deixa usar com prova. Tire-a.`);
    }
    if (!nomeDeFotoValido(c.foto) || (fotos && !fotos.has(c.foto))) bloqueia(`${c.slug}.foto`, `${i}.foto`, `A fotografia da categoria ${c.nome || c.slug} não existe na biblioteca: escolha outra.`);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* content/inicio.json                                                 */
/* ------------------------------------------------------------------ */

/* As secções da página inicial, pela ordem da página (a proposta A, «Linho», escolhida pelo Renato a 17 nov
   2026): a CAPA (a etiqueta, o título — o h1 — com a parte em itálico, a frase, o botão e duas fotografias, a
   grande e a pequena por cima), a COLEÇÃO em destaque (uma das coleções, num cartão verde-salva, com três
   fotografias das peças dela), a LOJA (a montra: uma fotografia grande por categoria, as que têm peças), os
   NOMES (a fila das caixas com o nome a dourado), os AROMAS (a lista dos Wax Melts, com a cor de cada um) e a
   SARA (a fotografia, a frase e a ligação para a história dela).
   NUNCA os passos («como funciona») nem uma chamada de fecho com frase feita: o Renato não as quer em site
   nenhum (16 nov 2026). */
export const SECCOES_INICIO = Object.freeze(['seo', 'capa', 'colecao', 'loja', 'nomes', 'aromas', 'sara']);
export const LIMITES_INICIO = Object.freeze({ fotosCapa: [1, 2], fotosNomes: [0, 8], aromas: [0, 12] });
const RE_COR = /^#[0-9A-Fa-f]{6}$/;

/* As fotografias que a página inicial usa (para saber se uma se pode apagar). */
export function fotosDoInicio(h) {
  if (!eObjecto(h)) return [];
  const out = [];
  if (eObjecto(h.capa) && Array.isArray(h.capa.fotos)) out.push(...h.capa.fotos);
  if (eObjecto(h.nomes) && Array.isArray(h.nomes.fotos)) out.push(...h.nomes.fotos);
  if (eObjecto(h.aromas)) out.push(h.aromas.foto);
  if (eObjecto(h.sara)) out.push(h.sara.foto);
  return out.filter((x) => typeof x === 'string' && x);
}

/* ctx = { fotos?: Set | null, artigos?: [slug] | null (as peças publicadas), colecoes?: [slug] | null } */
export function problemasDoInicio(valor, { fotos = null, artigos = null, colecoes = null } = {}) {
  const ficheiro = FICHEIROS.inicio;
  const out = [];
  const ecra = 'Página inicial';
  const bloqueia = (chave, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `inicio:${chave}`, ficheiro, ecra, campo, mensagem });
  const avisa = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `inicio:${chave}`, ficheiro, ecra, campo, mensagem, ...extra });
  const l = lerJson(valor);
  if (l.ilegivel || !eObjecto(l.obj)) { bloqueia('forma', undefined, 'A página inicial não se consegue ler. Só o Renato a pode corrigir.'); return out; }
  const h = l.obj;
  for (const k of SECCOES_INICIO) {
    if (!eObjecto(h[k])) bloqueia(`${k}:forma`, k, `A secção «${k}» da página inicial não está gravada. Só o Renato a pode repor.`);
  }
  if (out.length) return out;
  const valorEm = (caminho) => caminho.split('.').reduce((o, k) => (eObjecto(o) || Array.isArray(o) ? o[k] : undefined), h);
  const umTexto = (caminho, max, obrigatorio) => {
    const v = valorEm(caminho);
    if (vazio(v)) { if (obrigatorio) bloqueia(`${caminho}:vazio`, caminho, 'Este texto da página inicial está vazio: escreva-o.'); return; }
    if (typeof v !== 'string') { bloqueia(`${caminho}:tipo`, caminho, 'Este texto da página inicial não está gravado como texto.'); return; }
    if (v.length > max) avisa(`${caminho}:tamanho`, caminho, `Este texto tem mais de ${max} caracteres (tem ${v.length}).`);
    if (RE_CONTROLO_TEXTO.test(v) || RE_PARTE_A_PAGINA.test(v)) bloqueia(`${caminho}:controlo`, caminho, 'Este texto tem caracteres que não podem ir para o site. Escreva-o outra vez.');
    const m = v.match(RE_ALEGACOES);
    if (m) bloqueia(`${caminho}:alegacao`, caminho, `«${m[0]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos). Tire-a.`);
  };
  const T = TAMANHOS;
  const textos = [
    ['seo.titulo', T.inicioTitulo, true], ['seo.descricao', T.inicioTexto, true],
    ['capa.etiqueta', T.inicioCurto, false], ['capa.titulo', T.inicioTitulo, true], ['capa.tituloItalico', T.inicioCurto, false], ['capa.texto', T.inicioTexto, false], ['capa.botao', T.inicioCurto, true],
    ['colecao.etiqueta', T.inicioCurto, false], ['colecao.botao', T.inicioCurto, true],
    ['loja.titulo', T.inicioTitulo, true],
    ['nomes.titulo', T.inicioTitulo, true], ['nomes.texto', T.inicioTexto, false], ['nomes.botao', T.inicioCurto, false],
    ['aromas.etiqueta', T.inicioCurto, false], ['aromas.titulo', T.inicioTitulo, true],
    ['sara.etiqueta', T.inicioCurto, false], ['sara.titulo', T.inicioTitulo, true], ['sara.texto', T.inicioLongo, true], ['sara.citacao', T.inicioTexto, false], ['sara.botao', T.inicioCurto, false],
  ];
  for (const [c, max, ob] of textos) umTexto(c, max, ob);
  const umaLigacao = (caminho, obrigatoria) => {
    const lig = valorEm(caminho);
    if (vazio(lig)) { if (obrigatoria) bloqueia(`${caminho}:vazio`, caminho, 'Falta a página para onde o botão leva.'); return; }
    if (typeof lig !== 'string' || !/^\/[a-z0-9/-]*$/.test(lig)) avisa(caminho, caminho, 'A ligação do botão tem de ser uma página do site (ex.: /loja/flower-boxes/).');
  };
  umaLigacao('capa.ligacao', true); umaLigacao('nomes.ligacao', false); umaLigacao('aromas.ligacao', false); umaLigacao('sara.ligacao', false);
  const umaFoto = (caminho, f, obrigatoria) => {
    if (vazio(f)) { if (obrigatoria) bloqueia(`${caminho}:vazia`, caminho, 'Falta a fotografia.'); return; }
    if (!nomeDeFotoValido(f) || (fotos && !fotos.has(f))) bloqueia(`${caminho}:foto`, caminho, 'Uma fotografia da página inicial já não está na biblioteca: escolha outra.');
  };
  /* As fotografias da capa: uma ou duas (a grande e a pequena por cima). */
  const fs = h.capa.fotos;
  const [minF, maxF] = LIMITES_INICIO.fotosCapa;
  if (!Array.isArray(fs) || fs.length < minF) bloqueia('capa.fotos:vazia', 'capa.fotos', 'A capa precisa de pelo menos uma fotografia.');
  else {
    if (fs.length > maxF) avisa('capa.fotos:muitas', 'capa.fotos', `A capa tem ${fs.length} fotografias; o máximo é ${maxF} (as outras não aparecem).`);
    fs.forEach((f, i) => umaFoto(`capa.fotos.${i}`, f, true));
  }
  const fn = h.nomes.fotos;
  if (!ausente(fn)) {
    if (!Array.isArray(fn)) avisa('nomes.fotos', 'nomes.fotos', 'As fotografias dos nomes não estão gravadas como uma lista.');
    else {
      if (fn.length > LIMITES_INICIO.fotosNomes[1]) avisa('nomes.fotos:muitas', 'nomes.fotos', `Há ${fn.length} fotografias na fila dos nomes; o máximo é ${LIMITES_INICIO.fotosNomes[1]}.`);
      fn.forEach((f, i) => umaFoto(`nomes.fotos.${i}`, f, true));
    }
  }
  umaFoto('aromas.foto', h.aromas.foto, false);
  umaFoto('sara.foto', h.sara.foto, true);
  /* Os aromas: o nome, uma nota curta e a cor (#RRGGBB) da bolinha. */
  const ar = h.aromas.lista;
  if (!ausente(ar)) {
    if (!Array.isArray(ar)) avisa('aromas.lista', 'aromas.lista', 'Os aromas não estão gravados como uma lista.');
    else {
      if (ar.length > LIMITES_INICIO.aromas[1]) avisa('aromas.lista:muitos', 'aromas.lista', `Há ${ar.length} aromas; o máximo é ${LIMITES_INICIO.aromas[1]}.`);
      ar.forEach((x, i) => {
        if (!eObjecto(x) || !temTexto(x.nome)) { avisa(`aromas.lista.${i}`, `aromas.lista.${i}`, `O aroma ${i + 1} não tem nome.`); return; }
        if (x.nome.length > T.inicioCurto || (typeof x.nota === 'string' && x.nota.length > T.inicioCurto)) avisa(`aromas.lista.${i}:tamanho`, `aromas.lista.${i}`, `O aroma ${i + 1} tem um texto comprido de mais (até ${T.inicioCurto} caracteres).`);
        if (!vazio(x.cor) && !RE_COR.test(String(x.cor))) avisa(`aromas.lista.${i}.cor`, `aromas.lista.${i}.cor`, `A cor do aroma ${i + 1} tem a forma #C5763A.`);
        for (const t of [x.nome, x.nota]) if (typeof t === 'string' && (RE_CONTROLO_LINHA.test(t) || RE_PARTE_A_PAGINA.test(t))) bloqueia(`aromas.lista.${i}:controlo`, `aromas.lista.${i}`, 'Um aroma tem caracteres que não podem ir para o site.');
      });
    }
  }
  /* A coleção em destaque: uma das coleções publicadas. Escondida ou apagada, a secção sai da página. */
  const cs = h.colecao.slug;
  if (vazio(cs) || (Array.isArray(colecoes) && !colecoes.includes(cs))) avisa('colecao.slug', 'colecao.slug', 'A coleção em destaque não existe ou está escondida do site: a secção não aparece na página inicial. Escolha outra.', { lembrete: true });
  return out;
}

/* ------------------------------------------------------------------ */
/* content/fotos.json                                                  */
/* ------------------------------------------------------------------ */

/* Cada fotografia tem o texto alternativo (o que um leitor de ecrã diz, e o que o Google lê), o ponto
   de foco (onde se corta, em «x% y%») e, nas de um fotógrafo, o crédito. */
const RE_FOCO = /^(\d{1,3})% (\d{1,3})%$/;
export const focoValido = (f) => { const m = RE_FOCO.exec(String(f ?? '')); return Boolean(m) && Number(m[1]) <= 100 && Number(m[2]) <= 100; };

export function problemasDasFotos(valor, ficheirosFotos = null) {
  const ficheiro = FICHEIROS.fotos;
  const out = [];
  const bloqueia = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'bloqueia', chave: `fotos:${chave}`, ficheiro, ecra: 'Fotografias', campo, mensagem, ...extra });
  const avisa = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `fotos:${chave}`, ficheiro, ecra: 'Fotografias', campo, mensagem, ...extra });
  const l = lerJson(valor);
  if (l.ilegivel || !eObjecto(l.obj)) { bloqueia('forma', undefined, 'A lista das fotografias não se consegue ler. Só o Renato a pode corrigir.'); return out; }
  for (const [nome, f] of Object.entries(l.obj)) {
    if (!nomeDeFotoValido(nome)) { bloqueia(`${nome.slice(0, 60)}:nome`, nome, `«${nome.slice(0, 60)}» não é um nome de fotografia válido. Só o Renato o pode corrigir.`); continue; }
    if (!eObjecto(f)) { bloqueia(`${nome}:forma`, nome, `A fotografia «${nome}» não tem a forma certa.`); continue; }
    if (!temTexto(f.alt)) bloqueia(`${nome}:alt`, `${nome}.alt`, 'Uma fotografia não tem descrição (o que um leitor de ecrã diz): escreva-a.', { foto: nome });
    else {
      if (f.alt.length > TAMANHOS.alt) avisa(`${nome}:alt:tamanho`, `${nome}.alt`, `A descrição de uma fotografia tem mais de ${TAMANHOS.alt} caracteres.`, { foto: nome });
      if (RE_CONTROLO_LINHA.test(f.alt) || RE_PARTE_A_PAGINA.test(f.alt)) bloqueia(`${nome}:alt:controlo`, `${nome}.alt`, 'A descrição de uma fotografia tem caracteres que não podem ir para o site.', { foto: nome });
    }
    if (!ausente(f.foco) && !focoValido(f.foco)) avisa(`${nome}:foco`, `${nome}.foco`, 'O ponto de foco de uma fotografia não está como devia.', { foto: nome });
    if (!ausente(f.credito) && f.credito !== '' && (typeof f.credito !== 'string' || f.credito.length > TAMANHOS.credito || RE_CONTROLO_LINHA.test(f.credito) || RE_PARTE_A_PAGINA.test(f.credito))) avisa(`${nome}:credito`, `${nome}.credito`, `O crédito de uma fotografia tem de ser um texto curto, numa linha (até ${TAMANHOS.credito} caracteres).`, { foto: nome });
  }
  if (Array.isArray(ficheirosFotos)) {
    for (const n of ficheirosFotos) {
      if (!nomeDeFotoValido(n)) { bloqueia(`${String(n).slice(0, 60)}:nome-do-ficheiro`, undefined, `Há uma fotografia na biblioteca com um nome que o site não aceita («${String(n).slice(0, 60)}»: só minúsculas, algarismos e hífens). Só o Renato a pode corrigir.`, { foto: n }); continue; }
      if (!tem(l.obj, n)) bloqueia(`${n}:sem-entrada`, n, `A fotografia «${n}» não tem descrição: escreva-a.`, { foto: n });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Todos                                                               */
/* ------------------------------------------------------------------ */

/* problemas(dados, opcoes) → [problema]
 *   opcoes: { producao?: boolean } */
export function problemas(dados = {}, opcoes = {}) {
  const lista = [];
  const d = eObjecto(dados) ? dados : {};
  const fotos = fotosQueExistem(d);
  const videos = Array.isArray(d.videos) ? d.videos : null;
  let categorias = null;
  if (tem(d, 'categorias')) { const cs = categoriasDe(d.categorias); if (cs) categorias = cs.map((c) => c.slug); }
  const slugsArtigos = eObjecto(d.artigos) ? Object.keys(d.artigos).map(slugDoFicheiro) : null;

  const umFicheiro = (k, rotulo, fn) => {
    if (!tem(d, k)) return;
    const l = lerJson(d[k]);
    const ficheiro = FICHEIROS[k];
    if (l.ausente) lista.push({ classe: 'bloqueia', chave: `${k}:ausente`, ficheiro, ecra: rotulo, mensagem: `Falta o ficheiro ${ficheiro}: sem ele o site não se consegue gerar. Só o Renato o pode repor.` });
    else if (l.ilegivel) lista.push({ classe: 'bloqueia', chave: `${k}:ilegivel`, ficheiro, ecra: rotulo, mensagem: `${rotulo}: o ficheiro não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` });
    else lista.push(...fn(l.obj));
  };
  umFicheiro('site', 'Dados da marca', (o) => problemasDoSite(o, { producao: Boolean(opcoes.producao) }));
  umFicheiro('fotos', 'Fotografias', (o) => problemasDasFotos(o, Array.isArray(d.ficheirosFotos) ? d.ficheirosFotos : null));
  umFicheiro('categorias', 'Categorias', (o) => problemasDasCategorias(o, { fotos }));
  /* As peças publicadas (para a peça em destaque da página inicial). */
  const publicadas = eObjecto(d.artigos) ? Object.keys(d.artigos).filter((n) => { const a = lerJson(d.artigos[n]).obj; return eObjecto(a) && a.publicado !== false; }).map(slugDoFicheiro) : null;
  const colecoesPublicadas = eObjecto(d.colecoes) ? Object.keys(d.colecoes).filter((n) => { const c = lerJson(d.colecoes[n]).obj; return eObjecto(c) && c.publicado !== false; }).map(slugDoFicheiro) : null;
  umFicheiro('inicio', 'Página inicial', (o) => problemasDoInicio(o, { fotos, artigos: publicadas, colecoes: colecoesPublicadas }));

  const umaPasta = (mapa, ficheiroDe, ecraDe, prefixo, fn, tecto) => {
    if (!eObjecto(mapa)) return;
    for (const nome of Object.keys(mapa).sort()) {
      const valor = mapa[nome];
      if (ausente(valor)) continue;
      const slug = slugDoFicheiro(nome);
      const ficheiro = ficheiroDe(nome);
      const ecra = ecraDe(slug);
      const base = { ficheiro, slug };
      const l = lerJson(valor);
      if (l.ilegivel) { lista.push({ classe: 'bloqueia', chave: `${prefixo}:${slug}:ilegivel`, ecra, ...base, mensagem: `Este ficheiro não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` }); continue; }
      if (!eObjecto(l.obj)) { lista.push({ classe: 'bloqueia', chave: `${prefixo}:${slug}:forma`, ecra, ...base, mensagem: 'Este ficheiro não tem a forma certa. Só o Renato o pode corrigir.' }); continue; }
      if (!slugValido(slug)) { lista.push({ classe: 'bloqueia', chave: `${prefixo}:${slug}:endereco`, ecra, ...base, mensagem: `O nome do ficheiro («${nome}») não é um endereço válido (só minúsculas, algarismos e hífenes). Só o Renato o pode corrigir.` }); continue; }
      lista.push(...fn(l.obj, nome));
      const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
      if (tecto && bytes > TECTOS.artigoBytes * TECTOS.aviso) lista.push({ classe: 'avisa', lembrete: true, chave: `${prefixo}:${slug}:tecto`, ecra, ...base, mensagem: `Está a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.artigoBytes / 1024} KB): encurte a descrição.` });
    }
  };
  umaPasta(d.artigos, ficheiroDoArtigo, (s) => `Peças › ${s}`, 'artigo', (o, nome) => problemasDoArtigo(o, { nome, categorias, fotos, videos, producao: Boolean(opcoes.producao) }), true);
  umaPasta(d.colecoes, ficheiroDaColecao, (s) => `Coleções › ${s}`, 'colecao', (o, nome) => problemasDaColecao(o, { nome, fotos, artigos: slugsArtigos }), true);
  return lista;
}

/* ------------------------------------------------------------------ */
/* A cópia que o gerador lê                                            */
/* ------------------------------------------------------------------ */

/* neutralizar(dados, lista) → { artigos, colecoes, efeitos, mudou }
 *   Os problemas «neutraliza» aplicados a uma CÓPIA das peças e das coleções (o repositório não
 *   muda):
 *     · esconder       — publicado: false (sai do site, como um rascunho);
 *     · sem_fotografia — a fotografia sai da lista.
 *   efeitos: o que muda NO SITE, por ficheiro: [{ ficheiro, slug, nome, efeitos, motivos }] */
export function neutralizar(dados = {}, lista = []) {
  const d = eObjecto(dados) ? dados : {};
  const porFicheiro = new Map();
  for (const p of Array.isArray(lista) ? lista : []) {
    if (p && p.classe === 'neutraliza' && typeof p.ficheiro === 'string') porFicheiro.set(p.ficheiro, [...(porFicheiro.get(p.ficheiro) || []), p]);
  }
  const efeitos = [];
  let mudou = false;
  const umMapa = (mapa, ficheiroDe, nomeDe) => {
    const saida = {};
    for (const nome of Object.keys(eObjecto(mapa) ? mapa : {}).sort()) {
      const l = lerJson(mapa[nome]);
      if (!eObjecto(l.obj)) continue;
      const a = JSON.parse(JSON.stringify(l.obj));
      const prs = porFicheiro.get(ficheiroDe(nome)) || [];
      const feitos = []; const motivos = [];
      if (prs.some((p) => p.efeito === 'esconder')) {
        if (a.publicado !== false) { a.publicado = false; feitos.push('esconder'); mudou = true; }
        motivos.push(...prs.filter((p) => p.efeito === 'esconder').map((p) => p.mensagem));
      }
      const tirar = new Set(prs.filter((p) => p.efeito === 'sem_fotografia').map((p) => String(p.foto)));
      if (tirar.size && Array.isArray(a.fotos)) {
        a.fotos = a.fotos.filter((f) => !tirar.has(String(f)));
        mudou = true;
        if (!feitos.includes('esconder')) { feitos.push('sem_fotografia'); motivos.push(...prs.filter((p) => p.efeito === 'sem_fotografia').map((p) => p.mensagem)); }
      }
      saida[nome] = a;
      if (feitos.length) efeitos.push({ ficheiro: ficheiroDe(nome), slug: slugDoFicheiro(nome), nome: nomeDe(l.obj, slugDoFicheiro(nome)), efeitos: feitos, motivos });
    }
    return saida;
  };
  const artigos = umMapa(d.artigos, ficheiroDoArtigo, nomeDoArtigo);
  const colecoes = umMapa(d.colecoes, ficheiroDaColecao, nomeDaColecao);
  return { artigos, colecoes, efeitos, mudou };
}

const DESCRICAO_EFEITOS = { esconder: 'escondida do site', sem_fotografia: 'com fotografias que não aparecem' };
export const descreverEfeitos = (e) => e.efeitos.map((x) => DESCRICAO_EFEITOS[x] || x).join(' e ');

/* ------------------------------------------------------------------ */
/* O que o painel não pode mudar ao gravar                             */
/* ------------------------------------------------------------------ */

const valorEmCaminho = (o, caminho) => caminho.split('.').reduce((x, k) => (eObjecto(x) ? x[k] : undefined), o);

/* mudancasBloqueadas(antes, depois, qual) → [{ caminho, motivo }] ([] = pode gravar)
 *   'artigo':     as chaves que não são CAMPOS_ARTIGO não mudam;
 *   'colecao': as chaves que não são CAMPOS_COLECAO não mudam;
 *   'site':       BLOQUEADOS_SITE não mudam, e não aparecem secções novas;
 *   'categorias': as categorias são as mesmas, pela mesma ordem (o slug);
 *   'inicio':     não aparecem nem desaparecem secções. */
export function mudancasBloqueadas(antes, depois, qual = 'site') {
  const out = [];
  if (qual === 'artigo' || qual === 'colecao') {
    const campos = qual === 'artigo' ? CAMPOS_ARTIGO : CAMPOS_COLECAO;
    const a = eObjecto(antes) ? antes : {}; const d = eObjecto(depois) ? depois : {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
      if (campos.includes(k) || mesmoValor(a[k], d[k])) continue;
      out.push({ caminho: k, motivo: tem(a, k) ? 'mudou' : 'chave_nova' });
    }
    return out;
  }
  if (qual === 'categorias') {
    const a = Array.isArray(antes) ? antes : []; const d = Array.isArray(depois) ? depois : [];
    if (a.length !== d.length) return [{ caminho: 'categorias', motivo: 'quantas' }];
    a.forEach((c, i) => {
      if (!mesmoValor(eObjecto(c) ? c.slug : null, eObjecto(d[i]) ? d[i].slug : null)) out.push({ caminho: `${i}.slug`, motivo: 'mudou' });
    });
    return out;
  }
  const a = eObjecto(antes) ? antes : {}; const d = eObjecto(depois) ? depois : {};
  if (qual === 'inicio') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) if (!tem(a, k) || !tem(d, k)) out.push({ caminho: k, motivo: tem(a, k) ? 'saiu' : 'chave_nova' });
    return out;
  }
  for (const caminho of BLOQUEADOS_SITE) if (!mesmoValor(valorEmCaminho(a, caminho), valorEmCaminho(d, caminho))) out.push({ caminho, motivo: 'mudou' });
  const conhecidas = new Set([...Object.keys(a), ...Object.keys(SECCOES_SITE), 'descricao', 'assinatura']);
  for (const k of Object.keys(d)) if (!conhecidas.has(k)) out.push({ caminho: k, motivo: 'chave_nova' });
  return out;
}

/* A ORDEM DAS CHAVES AO GRAVAR: as que já estavam no ficheiro ficam onde estavam; uma nova entra
   antes da primeira que, na ordem do formulário, vem depois dela (e no fim, se nenhuma vier); as que
   o formulário não conhece vão para o fim. As que saíram, saem. */
export function ordenarComo(antes, depois, ordem = CAMPOS_ARTIGO) {
  if (!eObjecto(depois)) return depois;
  const a = eObjecto(antes) ? antes : {};
  const chaves = Object.keys(a).filter((k) => tem(depois, k));
  const novas = Object.keys(depois).filter((k) => !chaves.includes(k));
  for (const k of novas.filter((x) => ordem.includes(x))) {
    const i = ordem.indexOf(k);
    const j = chaves.findIndex((x) => ordem.includes(x) && ordem.indexOf(x) > i);
    if (j < 0) chaves.push(k); else chaves.splice(j, 0, k);
  }
  chaves.push(...novas.filter((x) => !ordem.includes(x)));
  const out = {};
  for (const k of chaves) out[k] = depois[k];
  return out;
}

/* A fotografia de cada página de texto (content/paginas/*.md): a linha «foto: <nome>» do cabeçalho,
   antes do «---». `paginas`: { <nome>: texto }. → [nome] */
export function fotosDasPaginas(paginas = {}) {
  const out = [];
  for (const t of Object.values(eObjecto(paginas) ? paginas : {})) {
    if (typeof t !== 'string') continue;
    const cabeca = t.split(/\n---\n/)[0];
    const m = /^foto:\s*(\S+)\s*$/m.exec(cabeca);
    if (m) out.push(m[1]);
  }
  return out;
}

/* AS FOTOGRAFIAS EM USO, em todo o conteúdo: as das peças, das coleções, das categorias, da
   página inicial e das páginas de texto (dados.paginas). Uma fotografia só sai da biblioteca se não
   estiver aqui. → Set */
export function fotosEmUso(dados = {}, extra = []) {
  const d = eObjecto(dados) ? dados : {};
  const usadas = new Set();
  /* Um nome com espaços à volta (escrito à mão) não aparece no site, mas conta como usado: na dúvida,
     uma fotografia nunca sai da biblioteca. */
  const juntar = (f) => { if (typeof f === 'string') { usadas.add(f); usadas.add(f.trim()); } };
  [...extra, ...fotosDasPaginas(d.paginas)].forEach(juntar);
  for (const mapa of [d.artigos, d.colecoes]) {
    if (eObjecto(mapa)) for (const v of Object.values(mapa)) { const a = lerJson(v).obj; if (eObjecto(a) && Array.isArray(a.fotos)) a.fotos.forEach(juntar); }
  }
  const cs = lerJson(d.categorias).obj;
  if (Array.isArray(cs)) for (const c of cs) if (eObjecto(c)) juntar(c.foto);
  fotosDoInicio(lerJson(d.inicio).obj).forEach(juntar);
  return usadas;
}
