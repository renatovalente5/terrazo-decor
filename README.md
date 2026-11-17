# Terrazo.Decor — o site

Proposta de site para a **Terrazo.Decor | Presentes & Lifestyle** (a Sara, [@terrazo_decor](https://www.instagram.com/terrazo_decor/)):
flower boxes com nome, velas e Wax Melts em cera vegetal, coffrets e peças em Jesmonite, feitos à mão.

Pré-visualização: **https://renatovalente5.github.io/terrazo-decor/** (fechada ao Google até haver domínio).

## Como está feito

Um gerador estático em Node 22, sem dependências (a infraestrutura dos outros sites do Renato), com o desenho
A «Linho» (escolhido a 17 nov 2026): o fundo de linho do logótipo, a Newsreader nos títulos e a Poppins no texto.

- `content/` — os dados: `site.json` (marca, contactos, dados legais, entregas), `inicio.json` (as secções da
  página inicial), `categorias.json`, `produtos/*.json` (as peças), `colecoes/*.json` (as coleções de cada época),
  `fotos.json` (o texto alternativo e o ponto de foco de cada fotografia) e `paginas/*.md`.
- `media/` — as fotografias (`fotos/`), os vídeos sem som (`video/`), o logótipo e o desenho das tulipas
  (`marca/`) e o aviso oficial da garantia (`legal/`).
- `src/lib/regras.mjs` — as regras dos dados (as mesmas que o painel há de usar).
- `src/templates/` — as páginas; `src/estilos/site.css`; `src/scripts/` — o pedido, a procura, a galeria.

```bash
python3 scripts/imagens.py            # as versões web das fotografias, os ícones e os cartões de partilha
node scripts/build.mjs --sem-imagens  # o site em _site/ (local: http://localhost:4992/)
node scripts/testar.mjs               # os testes (as regras e o site construído)
```

Os pedidos seguem pelo Instagram (o texto do pedido é copiado e abre-se a conversa). Falta pedir à Sara os
dados legais (nome, NIF, morada, email), as entregas, o pagamento, os prazos e confirmar os preços: o gerador
recusa publicar no domínio sem eles.
