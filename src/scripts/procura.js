/* A procura: no catálogo, pelo nome, a frase curta e a categoria, sem acentos nem maiúsculas. Todas
   as palavras escritas têm de aparecer (por qualquer ordem). Os resultados: a miniatura, o nome e a
   categoria; com Enter, a primeira peça. */
(function () {
  'use strict';
  var BC = window.BC;
  var form = document.querySelector('[data-procura]');
  if (!form) return;
  var campo = form.querySelector('input[type="search"]');
  var caixa = document.querySelector('[data-procura-resultados]');
  var inicio = document.querySelector('[data-procura-inicio]');
  var estado = document.querySelector('[data-procura-estado]');
  var lista = null;

  function preparar(cat) {
    return Object.keys(cat.produtos).map(function (slug) {
      var p = cat.produtos[slug];
      return { p: p, txt: BC.semAcentos([p.nome, p.resumo, p.catNome].join(' ')) };
    });
  }

  function mostrar() {
    var q = BC.semAcentos(campo.value).trim();
    if (!q) { caixa.hidden = true; inicio.hidden = false; estado.textContent = ''; return; }
    BC.catalogo().then(function (cat) {
      if (!lista) lista = preparar(cat);
      var palavras = q.split(/\s+/).filter(Boolean);
      var r = lista.filter(function (x) { return palavras.every(function (w) { return x.txt.indexOf(w) >= 0; }); }).slice(0, 24);
      inicio.hidden = true;
      caixa.hidden = false;
      if (!r.length) {
        caixa.innerHTML = '<p class="procura__vazio">Não encontrei nada com «' + BC.esc(campo.value.trim()) + '». Experimenta outra palavra, ou <a href="' + BC.esc(cat.pedido) + '">conta-me a tua ideia</a>.</p>';
        estado.textContent = 'Sem resultados.';
        return;
      }
      caixa.innerHTML = '<ul role="list">' + r.map(function (x) {
        return '<li><a href="' + BC.esc(x.p.url) + '"><img class="mini" src="' + BC.esc(BC.fotoMini(cat, x.p.img)) + '" width="52" height="52" alt="" loading="lazy"><span><b>' + BC.esc(x.p.nome) + '</b><small>' + BC.esc(x.p.catNome) + '</small></span></a></li>';
      }).join('') + '</ul>';
      estado.textContent = r.length === 1 ? '1 peça encontrada.' : r.length + ' peças encontradas.';
    }).catch(function () { caixa.hidden = false; caixa.innerHTML = '<p class="procura__vazio">Sem ligação: não foi possível procurar.</p>'; });
  }

  var espera = null;
  campo.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(mostrar, 120); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var primeiro = caixa.querySelector('a');
    if (primeiro) location.href = primeiro.href;
  });
})();
