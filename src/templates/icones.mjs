// Os desenhos do site, num só <svg> escondido no início de cada página (o sprite), e o atalho para
// os usar: ico('lupa'). Traço de 1,6 px, cantos redondos, sobre uma grelha de 24 — calmos, como o
// resto da página. Os desenhos são decorativos (aria-hidden): o nome vai sempre no botão ou na
// ligação (aria-label ou texto).
const D = {
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  saco: '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  menu: '<path d="M4 8h16M4 16h16"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  seta: '<path d="M5 12h13M13 7l5 5-5 5"/>',
  voltar: '<path d="M19 12H6M11 7l-5 5 5 5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  lixo: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  certo: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6" fill="currentColor"/>',
  facebook: '<path d="M13.5 20v-7h2.4l.4-2.8h-2.8V8.5c0-.8.3-1.4 1.4-1.4h1.5V4.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2H8.2V13h2.4v7"/>',
  carta: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
  local: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  whatsapp: '<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z"/><path d="M9.6 9.2c.3 1.8 1.6 3.4 3.4 4.2l.9-.9 1.6.7-.3 1.4c-2.9.1-6.4-3-6.6-6l1.4-.4.8 1.5z"/>',
  conversa: '<path d="M5 18V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6.5a2.5 2.5 0 0 1-2.5 2.5H9z"/>',
  pincel: '<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M6.5 12.5L4 20l7.5-2.5"/>',
  cartao: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10h17M7 14.5h3"/>',
  caixa: '<path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5l8 4.5 8-4.5M12 13v7"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pausa: '<path d="M9 6v12M15 6v12"/>',
  pausa: '<path d="M8 5v14M16 5v14"/>',
  copiar: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
};
export const NOMES_ICONES = Object.keys(D);

export function sprite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true" focusable="false">${Object.entries(D).map(([n, d]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${d}</symbol>`).join('')}</svg>`;
}

export function ico(nome, classe = '') {
  if (!D[nome]) throw new Error(`ícone «${nome}» não existe em icones.mjs`);
  return `<svg class="i${classe ? ` ${classe}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${nome}"/></svg>`;
}
