/* O pedido: juntar peças na ficha, e a página /pedido/ (as peças, os dados, e o envio pelo Instagram — ou
   pelo email ou pelo WhatsApp, quando houver —, com a mensagem já escrita). Não há pagamentos no site: a
   Sara responde com o preço total e o prazo, e a encomenda fica feita quando o cliente aceita.
   A mesma peça com as mesmas escolhas e a mesma personalização junta-se à linha que já existe. */
(function () {
  'use strict';
  var BC = window.BC;

  var chaveDe = function (i) { return JSON.stringify([i.slug, i.opcoes || {}, i.pers || {}]); };

  // ---------------------------------------------------------------- juntar (na ficha)
  var form = document.querySelector('[data-juntar]');
  if (form) {
    var qtd = form.querySelector('input[name="quantidade"]');
    var caixa = form.querySelector('[data-quantidade]');
    var minimo = Number(caixa && caixa.getAttribute('data-minimo')) || 1;
    var ajustar = function (d) {
      var v = Math.max(minimo, Math.min(9999, (parseInt(qtd.value, 10) || minimo) + d));
      qtd.value = String(v);
    };
    if (caixa) {
      caixa.querySelector('[data-menos]').addEventListener('click', function () { ajustar(-1); });
      caixa.querySelector('[data-mais]').addEventListener('click', function () { ajustar(1); });
      qtd.addEventListener('change', function () { ajustar(0); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ajustar(0);
      var item = { slug: form.getAttribute('data-juntar'), qtd: parseInt(qtd.value, 10) || minimo, opcoes: {}, pers: {} };
      form.querySelectorAll('fieldset.escolha').forEach(function (fs) {
        var marcado = fs.querySelector('input:checked');
        var nome = fs.querySelector('legend').textContent.trim();
        if (marcado) item.opcoes[nome] = marcado.value;
      });
      form.querySelectorAll('.campos input, .campos textarea').forEach(function (el) {
        var v = el.value.trim();
        if (v) item.pers[el.name] = v;
      });
      var pedido = BC.ler();
      if (pedido.enviadoEm) pedido = { itens: [] };   // um pedido já enviado não se mistura com um novo
      var k = chaveDe(item);
      var igual = pedido.itens.find(function (i) { return chaveDe(i) === k; });
      if (igual) igual.qtd = Math.min(9999, igual.qtd + item.qtd); else pedido.itens.push(item);
      BC.gravar(pedido);
      BC.contar(true);
      var base = document.body.getAttribute('data-base') || '/';
      BC.recado('Juntaste ao pedido.', { url: base + 'pedido/', texto: 'Ver o pedido' });
      form.querySelectorAll('.campos input, .campos textarea').forEach(function (el) { el.value = ''; });
    });
  }

  // ---------------------------------------------------------------- a página do pedido
  var raiz = document.querySelector('[data-pedido]');
  if (!raiz) return;
  var linhas = raiz.querySelector('[data-linhas]');
  var vazio = raiz.querySelector('[data-vazio]');
  var formulario = raiz.querySelector('[data-formulario]');
  var enviado = raiz.querySelector('[data-enviado]');
  var erro = raiz.querySelector('[data-erro]');
  var grelha = raiz.querySelector('.pedido__grelha');
  var ultimoTexto = '';

  function nomeDoCampo(p, id) {
    var f = (p.pers || []).find(function (x) { return x.id === id; });
    return f ? f.rotulo : id;
  }

  function desenhar(cat) {
    var pedido = BC.ler();
    var itens = pedido.itens.filter(function (i) { return cat.produtos[i.slug]; });
    raiz.classList.toggle('vazio', !itens.length);
    vazio.hidden = itens.length > 0;
    linhas.innerHTML = itens.map(function (i, n) {
      var p = cat.produtos[i.slug];
      var det = [];
      Object.keys(i.opcoes || {}).forEach(function (k) { det.push(BC.esc(k) + ': ' + BC.esc(i.opcoes[k])); });
      Object.keys(i.pers || {}).forEach(function (k) { det.push(BC.esc(nomeDoCampo(p, k)) + ': ' + BC.esc(i.pers[k])); });
      return '<li class="linha" data-i="' + n + '">' +
        '<a class="linha__foto" href="' + BC.esc(p.url) + '" tabindex="-1" aria-hidden="true"><img src="' + BC.esc(BC.fotoMini(cat, p.img)) + '" width="84" height="105" alt="" loading="lazy"></a>' +
        '<div><p class="linha__nome"><a href="' + BC.esc(p.url) + '">' + BC.esc(p.nome) + '</a></p>' +
        (det.length ? '<p class="linha__det">' + det.join(' · ') + '</p>' : '') +
        '<div class="linha__acoes"><div class="quantidade"><button type="button" class="botao-icone" data-menos aria-label="Menos uma de ' + BC.esc(p.nome) + '"><svg class="i" aria-hidden="true"><use href="#i-menos"/></svg></button>' +
        '<input type="number" inputmode="numeric" min="' + p.minimo + '" max="9999" value="' + i.qtd + '" aria-label="Quantidade de ' + BC.esc(p.nome) + '">' +
        '<button type="button" class="botao-icone" data-mais aria-label="Mais uma de ' + BC.esc(p.nome) + '"><svg class="i" aria-hidden="true"><use href="#i-mais"/></svg></button></div>' +
        '<button type="button" class="linha__tirar" data-tirar><svg class="i" aria-hidden="true"><use href="#i-lixo"/></svg>Tirar<span class="so-leitor"> ' + BC.esc(p.nome) + '</span></button></div></div></li>';
    }).join('');
    // as linhas guardam a posição no pedido verdadeiro (as peças que já não existem ficam de fora)
    linhas.querySelectorAll('.linha').forEach(function (li, n) { li.setAttribute('data-i', String(pedido.itens.indexOf(itens[n]))); });
  }

  function mudar(li, fn) {
    var pedido = BC.ler();
    var i = Number(li.getAttribute('data-i'));
    if (!pedido.itens[i]) return;
    fn(pedido, i);
    delete pedido.enviadoEm;
    BC.gravar(pedido);
  }

  linhas.addEventListener('click', function (e) {
    var li = e.target.closest('.linha');
    if (!li) return;
    if (e.target.closest('[data-tirar]')) mudar(li, function (p, i) { p.itens.splice(i, 1); });
    else if (e.target.closest('[data-mais]')) mudar(li, function (p, i) { p.itens[i].qtd = Math.min(9999, p.itens[i].qtd + 1); });
    else if (e.target.closest('[data-menos]')) {
      var min = Number(li.querySelector('input').min) || 1;
      mudar(li, function (p, i) { p.itens[i].qtd = Math.max(min, p.itens[i].qtd - 1); });
    }
  });
  linhas.addEventListener('change', function (e) {
    var li = e.target.closest('.linha');
    if (!li || e.target.type !== 'number') return;
    var min = Number(e.target.min) || 1;
    var v = Math.max(min, Math.min(9999, parseInt(e.target.value, 10) || min));
    mudar(li, function (p, i) { p.itens[i].qtd = v; });
  });

  // a localidade só no envio
  var soEnvio = formulario.querySelector('[data-so-envio]');
  formulario.addEventListener('change', function (e) {
    if (e.target.name === 'entrega') soEnvio.hidden = e.target.value !== 'envio';
  });

  var euros = function (v) { return v.toFixed(2).replace('.', ',') + ' €'; };
  function texto(cat, dados) {
    var pedido = BC.ler();
    var itens = pedido.itens.filter(function (i) { return cat.produtos[i.slug]; });
    var l = ['Olá, Sara! Gostava de fazer esta encomenda:', ''];
    itens.forEach(function (i, n) {
      var p = cat.produtos[i.slug];
      var preco = typeof p.preco === 'number' ? ' (' + (p.desde ? 'desde ' : '') + euros(p.preco) + ')' : '';
      l.push((n + 1) + ') ' + p.nome + preco + ' — ' + i.qtd + (i.qtd === 1 ? ' unidade' : ' unidades'));
      Object.keys(i.opcoes || {}).forEach(function (k) { l.push('   ' + k + ': ' + i.opcoes[k]); });
      Object.keys(i.pers || {}).forEach(function (k) { l.push('   ' + nomeDoCampo(p, k) + ': ' + i.pers[k]); });
      l.push('   ' + cat.origem + p.url);
      l.push('');
    });
    if (dados.ocasiao) l.push('Ocasião: ' + dados.ocasiao);
    if (dados.data) l.push('Para: ' + dados.data);
    l.push('Entrega: ' + (dados.entrega === 'envio' ? 'envio' + (dados.localidade ? ' para ' + dados.localidade : '') : 'em mão'));
    if (dados.mensagem) { l.push(''); l.push(dados.mensagem); }
    l.push('');
    l.push('Nome: ' + dados.nome);
    l.push('Contacto: ' + dados.contacto);
    return l.join('\n');
  }

  function validar(dados, temPecas) {
    var falta = [];
    if (!dados.nome) falta.push(['nome', 'o teu nome']);
    var c = dados.contacto;
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) || /^(\+?\d[\d\s]{7,15})$/.test(c);
    if (!ok) falta.push(['contacto', c ? 'um email ou um telemóvel válido' : 'um email ou um telemóvel']);
    if (!temPecas && !dados.mensagem) falta.push(['mensagem', 'as peças que queres ou a tua ideia']);
    formulario.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    falta.forEach(function (f) { var el = formulario.elements[f[0]]; if (el) el.setAttribute('aria-invalid', 'true'); });
    if (falta.length) {
      erro.textContent = 'Falta ' + falta.map(function (f) { return f[1]; }).join(', ') + '.';
      erro.hidden = false;
      var primeiro = formulario.elements[falta[0][0]];
      if (primeiro) primeiro.focus();
      return false;
    }
    erro.hidden = true;
    return true;
  }

  formulario.addEventListener('submit', function (e) {
    e.preventDefault();
    var canal = (e.submitter && e.submitter.getAttribute('data-canal')) || 'instagram';
    var f = formulario.elements;
    var dados = {
      nome: f.nome.value.trim(), contacto: f.contacto.value.trim(), ocasiao: f.ocasiao.value,
      data: f.data.value.trim(), entrega: (formulario.querySelector('input[name="entrega"]:checked') || {}).value || 'mao',
      localidade: f.localidade.value.trim(), mensagem: f.mensagem.value.trim(),
    };
    BC.catalogo().then(function (cat) {
      var temPecas = BC.ler().itens.some(function (i) { return cat.produtos[i.slug]; });
      if (!validar(dados, temPecas)) return;
      var msg = texto(cat, dados);
      ultimoTexto = msg;
      var assunto = 'Encomenda — ' + dados.nome + (dados.ocasiao ? ' (' + dados.ocasiao.toLowerCase() + ')' : '');
      var aviso = '';
      var toque = window.matchMedia('(pointer: coarse)').matches;
      if (canal === 'whatsapp' && cat.whatsapp) {
        window.open('https://wa.me/' + cat.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        aviso = 'Abri o WhatsApp com o pedido escrito: falta só carregar em enviar.';
      } else if (canal === 'instagram' && cat.instagram) {
        // o Instagram não deixa levar o texto na ligação: copia-se, e abre-se a conversa (na app, num ecrã de
        // toque) ou o perfil (no computador, onde se carrega em «Mensagem»)
        var copiado = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(msg) : Promise.reject();
        copiado.then(function () { BC.recado('Pedido copiado: cola-o na conversa do Instagram.'); }, function () {});
        window.open(toque ? 'https://ig.me/m/' + encodeURIComponent(cat.instagram) : 'https://www.instagram.com/' + encodeURIComponent(cat.instagram) + '/', '_blank', 'noopener');
        aviso = toque
          ? 'Copiei o pedido e abri a nossa conversa no Instagram: cola-o lá (tocar e manter, «Colar») e envia.'
          : 'Copiei o pedido e abri o meu Instagram: carrega em «Mensagem», cola o pedido e envia.';
      } else {
        location.href = 'mailto:' + cat.email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(msg);
        aviso = 'Abri o teu email com o pedido escrito, para ' + cat.email + ': falta só carregar em enviar.';
      }
      var pedido = BC.ler();
      pedido.enviadoEm = new Date().toISOString();
      BC.gravar(pedido);
      raiz.querySelector('[data-enviado-texto]').textContent = aviso + ' Respondo com o preço total e o prazo.' + (cat.instagram ? ' Se nada abriu, copia o pedido e envia-mo no Instagram, @' + cat.instagram + '.' : '');
      grelha.hidden = true;
      vazio.hidden = true;
      enviado.hidden = false;
      enviado.scrollIntoView({ block: 'start' });
    });
  });

  enviado.querySelector('[data-copiar]').addEventListener('click', function () {
    if (!ultimoTexto) return;
    var ok = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(ultimoTexto) : Promise.reject();
    ok.then(function () { BC.recado('Pedido copiado.'); }, function () { BC.recado('Não foi possível copiar.'); });
  });
  enviado.querySelector('[data-novo]').addEventListener('click', function () {
    BC.limpar();
    formulario.reset();
    soEnvio.hidden = true;
    enviado.hidden = true;
    grelha.hidden = false;
    BC.catalogo().then(desenhar);
  });

  document.addEventListener('bc:pedido', function () { BC.catalogo().then(desenhar); });
  BC.catalogo().then(desenhar).catch(function () { vazio.hidden = false; });
})();
