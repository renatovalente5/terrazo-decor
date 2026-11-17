/* O núcleo do site: o pedido guardado no browser, o catálogo, o recado e uns ajudantes.
   O pedido guarda-se em localStorage («terrazo:pedido»): as peças, as quantidades, as escolhas e a
   personalização, e o dia em que foi enviado. Nunca o nome, o contacto nem a mensagem (a política de
   privacidade di-lo). Sem localStorage (navegação privada antiga, bloqueado), o site funciona na
   mesma: o pedido vive enquanto a página está aberta. */
(function () {
  'use strict';
  var CHAVE = 'terrazo:pedido';
  var memoria = null;
  var BC = window.BC = {};

  BC.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  BC.semAcentos = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };

  BC.ler = function () {
    var v = null;
    try { v = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { v = memoria; }
    if (!v || typeof v !== 'object' || !Array.isArray(v.itens)) v = { itens: [] };
    v.itens = v.itens.filter(function (i) { return i && typeof i.slug === 'string' && typeof i.qtd === 'number' && i.qtd > 0; });
    return v;
  };
  BC.gravar = function (v) {
    memoria = v;
    try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) { /* sem armazenamento: fica em memória */ }
    BC.contar();
    document.dispatchEvent(new CustomEvent('bc:pedido'));
  };
  BC.limpar = function () {
    memoria = null;
    try { localStorage.removeItem(CHAVE); } catch (e) {}
    BC.contar();
  };

  /* O número no saco do cabeçalho: quantas peças diferentes há no pedido. */
  BC.contar = function (saltar) {
    var n = BC.ler().itens.length;
    document.querySelectorAll('[data-conta]').forEach(function (el) {
      el.textContent = n ? String(n) : '';
      el.hidden = !n;
      if (saltar && n) { el.classList.remove('salta'); void el.offsetWidth; el.classList.add('salta'); }
    });
    document.querySelectorAll('.pedido-icone').forEach(function (a) {
      a.setAttribute('aria-label', n ? 'O meu pedido: ' + n + (n === 1 ? ' peça' : ' peças') : 'O meu pedido');
    });
  };

  /* O catálogo (assets/catalogo-*.json): os nomes, as escolhas e as fotografias das peças. */
  var catalogo = null;
  BC.catalogo = function () {
    if (!catalogo) {
      var url = document.body.getAttribute('data-catalogo');
      catalogo = fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('catálogo ' + r.status);
        return r.json();
      });
      catalogo.catch(function () { catalogo = null; });
    }
    return catalogo;
  };
  /* A miniatura de uma peça (a versão de 360 da primeira fotografia). */
  BC.fotoMini = function (cat, img) {
    return cat.assets + 'img/' + img.n + '-' + img.r + '-' + img.l[0] + '.webp';
  };

  /* O recado: uma linha em baixo, com uma ligação opcional. */
  var tempo = null;
  BC.recado = function (texto, ligacao) {
    var el = document.querySelector('[data-recado]');
    if (!el) return;
    el.innerHTML = '<span>' + BC.esc(texto) + '</span>' + (ligacao ? '<a href="' + BC.esc(ligacao.url) + '">' + BC.esc(ligacao.texto) + '</a>' : '');
    el.classList.add('ver');
    clearTimeout(tempo);
    tempo = setTimeout(function () { el.classList.remove('ver'); }, 5200);
  };

  /* Datas: o campo escreve as barras sozinho («12042026» → «12/04/2026»). */
  BC.ligarDatas = function (raiz) {
    (raiz || document).querySelectorAll('[data-data]').forEach(function (el) {
      if (el.dataset.ligado) return;
      el.dataset.ligado = '1';
      el.addEventListener('input', function () {
        var d = el.value.replace(/\D/g, '').slice(0, 8);
        var out = d.slice(0, 2) + (d.length > 2 ? '/' + d.slice(2, 4) : '') + (d.length > 4 ? '/' + d.slice(4) : '');
        if (out !== el.value) el.value = out;
      });
    });
  };

  document.addEventListener('DOMContentLoaded', function () { BC.contar(); BC.ligarDatas(); });
})();
