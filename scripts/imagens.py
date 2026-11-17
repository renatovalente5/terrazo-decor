#!/usr/bin/env python3
"""Imagens do site: versões para a web, cartões de partilha e ícones.

Lê:
  media/fotos/*.jpg        as fotografias (cada uma tem de estar em content/fotos.json, com o
                           texto alternativo e o ponto de foco)
  media/video/*.jpg        a imagem de capa de cada vídeo (se houver)
  media/marca/logo.png     o logótipo da Terrazo.Decor, com transparência (o desenho dela, «terrazo.» e
                           «Decor» a preto, só sem o fundo de linho: _cliente/ferramentas/logo-recorte.py)
  media/marca/tulipas.png  o desenho das capas dos destaques (tulipas e borboleta), sem o fundo
  content/produtos/*.json  para saber a primeira fotografia de cada peça (o cartão de partilha)
  content/colecoes/*.json  idem, de cada coleção

Escreve em .cache/imagens/ (fica entre publicações; cada ficheiro leva no nome um resumo do
original, por isso só se refaz o que mudou) e um manifesto, .cache/imagens/manifesto.json, que o
scripts/build.mjs lê para escrever os <picture> e copia para _site/assets/img/.

    python3 scripts/imagens.py              # faz o que falta
    python3 scripts/imagens.py --verificar  # só confere que fotos.json e media/fotos batem certo
"""
import glob
import hashlib
import json
import os
import shutil
import sys

from PIL import Image, ImageOps, features

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FOTOS = os.path.join(RAIZ, 'media', 'fotos')
VIDEO = os.path.join(RAIZ, 'media', 'video')
MARCA = os.path.join(RAIZ, 'media', 'marca')
INDICE = os.path.join(RAIZ, 'content', 'fotos.json')
PRODUTOS = os.path.join(RAIZ, 'content', 'produtos')
COLECOES = os.path.join(RAIZ, 'content', 'colecoes')
CACHE = os.path.join(RAIZ, '.cache', 'imagens')

LARGURAS = [360, 540, 720, 960, 1280, 1600]
QUALIDADE_AVIF = 55
QUALIDADE_WEBP = 80
PARTILHA = (1200, 630)
LINHO = (242, 239, 232)          # o linho do fundo do logótipo (#F2EFE8): o fundo do cartão de partilha
FORMATOS = ('avif', 'webp') if features.check('avif') else ('webp',)
VERSAO = f'v1-{LARGURAS}-{QUALIDADE_AVIF}-{QUALIDADE_WEBP}-{PARTILHA}'


def resumo(*caminhos, extra=''):
    h = hashlib.sha256((VERSAO + extra).encode())
    for c in caminhos:
        with open(c, 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:10]


def abrir(caminho):
    im = Image.open(caminho)
    im = ImageOps.exif_transpose(im)
    return im


def guardar(im, destino, formato):
    if os.path.exists(destino):
        return
    tmp = destino + '.tmp'
    if formato == 'avif':
        im.save(tmp, 'AVIF', quality=QUALIDADE_AVIF, speed=6)
    elif formato == 'webp':
        im.save(tmp, 'WEBP', quality=QUALIDADE_WEBP, method=6)
    elif formato == 'png':
        im.save(tmp, 'PNG', optimize=True)
    else:
        im.save(tmp, 'JPEG', quality=84, optimize=True, progressive=True)
    os.replace(tmp, destino)


def versoes(nome, origem):
    """AVIF + WebP nas larguras que a fotografia aguenta (nunca se aumenta)."""
    im = abrir(origem).convert('RGB')
    h = resumo(origem)
    larguras = [w for w in LARGURAS if w < im.width] + [im.width]
    for w in larguras:
        alto = round(im.height * w / im.width)
        reduzida = im if w == im.width else im.resize((w, alto), Image.LANCZOS)
        for fmt in FORMATOS:
            guardar(reduzida, os.path.join(CACHE, f'{nome}-{h}-{w}.{fmt}'), fmt)
    return {'largura': im.width, 'altura': im.height, 'resumo': h, 'larguras': larguras,
            'formatos': list(FORMATOS)}


# As duas versões que o PAINEL mostra (o painel só sabe o nome da fotografia, não o resumo das
# versões web): a miniatura das grelhas e a grande da janela de cada fotografia.
PAINEL = {'miniatura': 320, 'grande': 1024}


def para_o_painel(nome, origem, tipo):
    """assets/img/<tipo>-<nome>.webp, com o lado maior de PAINEL[tipo] px. Nome fixo de propósito:
    uma fotografia nova tem sempre um nome novo, por isso o conteúdo de um nome nunca muda. O
    <ficheiro>.resumo ao lado diz de que original foi feita (e não vai para o site)."""
    destino = os.path.join(CACHE, f'{tipo}-{nome}.webp')
    marca = destino + '.resumo'
    h = resumo(origem, extra=f'{tipo}-{PAINEL[tipo]}')
    if os.path.exists(destino) and os.path.exists(marca) and open(marca).read() == h:
        return os.path.basename(destino)
    im = abrir(origem).convert('RGB')
    im.thumbnail((PAINEL[tipo], PAINEL[tipo]), Image.LANCZOS)
    if os.path.exists(destino):
        os.remove(destino)
    guardar(im, destino, 'webp')
    with open(marca, 'w') as f:
        f.write(h)
    return os.path.basename(destino)


def cartao_produto(nome, origem):
    """Cartão de partilha de uma peça: a fotografia num quadrado ao centro, sobre o linho.
    O WhatsApp mostra a miniatura QUADRADA e cortada ao centro (x 285–915 num 1200×630): a
    peça tem de caber aí inteira."""
    h = resumo(origem, __file__, extra='cartao')
    destino = os.path.join(CACHE, f'{nome}-{h}-partilha.jpg')
    if not os.path.exists(destino):
        im = abrir(origem).convert('RGB')
        lado = PARTILHA[1]
        # corta ao centro um quadrado e reduz a 630×630
        menor = min(im.width, im.height)
        x = (im.width - menor) // 2
        y = (im.height - menor) // 2
        quadrado = im.crop((x, y, x + menor, y + menor)).resize((lado, lado), Image.LANCZOS)
        cartao = Image.new('RGB', PARTILHA, LINHO)
        cartao.paste(quadrado, ((PARTILHA[0] - lado) // 2, 0))
        guardar(cartao, destino, 'jpg')
    return os.path.basename(destino)


def cartao_logotipo(logo):
    """O cartão da página inicial e das páginas sem artigo: só o logótipo, ao centro."""
    h = resumo(logo, __file__, extra='cartao-logo')
    destino = os.path.join(CACHE, f'terrazo-decor-{h}-partilha.jpg')
    if not os.path.exists(destino):
        marca = Image.open(logo).convert('RGBA')
        alto = min(440, marca.height)   # nunca aumentar o logótipo
        largo = round(marca.width * alto / marca.height)
        marca = marca.resize((largo, alto), Image.LANCZOS)
        cartao = Image.new('RGBA', PARTILHA, LINHO + (255,))
        cartao.alpha_composite(marca, ((PARTILHA[0] - largo) // 2, (PARTILHA[1] - alto) // 2))
        guardar(cartao.convert('RGB'), destino, 'jpg')
    return os.path.basename(destino)


def inicial(marca):
    """A primeira letra do logótipo (o «t» de «terrazo.»), para os ícones pequenos da aba do browser: é um
    recorte do desenho dela, não um desenho novo. A faixa mais alta é «terrazo.» (por baixo fica «Decor»);
    a letra acaba na primeira coluna vazia."""
    alfa = marca.getchannel('A')
    W, H = marca.size
    px = alfa.load()
    linhas = [any(px[x, y] > 24 for x in range(0, W, 2)) for y in range(H)]
    faixas, ini = [], None
    for y, tem in enumerate(linhas + [False]):
        if tem and ini is None:
            ini = y
        elif not tem and ini is not None:
            faixas.append((ini, y)); ini = None
    a, b = max(faixas, key=lambda f: f[1] - f[0])
    palavra = marca.crop((0, a, W, b))
    palavra = palavra.crop(palavra.getbbox())
    pa = palavra.getchannel('A').load()
    pw, ph = palavra.size
    colunas = [any(pa[x, y] > 24 for y in range(ph)) for x in range(pw)]
    fim = next((x for x in range(1, pw) if colunas[x - 1] and not colunas[x]), pw)
    letra = palavra.crop((0, 0, fim, ph))
    return palavra, letra.crop(letra.getbbox())


def num_quadrado(desenho, lado, margem, fundo):
    q = Image.new('RGBA', (lado, lado), fundo + (255,))
    caber = lado - 2 * margem
    esc = min(caber / desenho.width, caber / desenho.height)
    d = desenho.resize((max(1, round(desenho.width * esc)), max(1, round(desenho.height * esc))), Image.LANCZOS)
    q.alpha_composite(d, ((lado - d.width) // 2, (lado - d.height) // 2))
    return q


def logotipo(logo):
    """O logótipo em PNG e WebP a várias alturas, e os ícones: a aba do browser com o «t» do logótipo, e o
    ecrã inicial do telemóvel com «terrazo.» inteiro, os dois sobre o linho do fundo do logótipo."""
    h = resumo(logo, __file__, extra='logo')
    marca = Image.open(logo).convert('RGBA')
    saida = {'resumo': h, 'w': marca.width, 'h': marca.height, 'altura': {}, 'icones': {}}
    for alto in (52, 64, 72, 88, 104, 128, 168, 208, 231):
        alto = min(alto, marca.height)
        largo = round(marca.width * alto / marca.height)
        r = marca.resize((largo, alto), Image.LANCZOS)
        for fmt in ('webp', 'png'):
            nome = f'logo-{h}-{alto}.{fmt}'
            guardar(r, os.path.join(CACHE, nome), fmt)
        saida['altura'][alto] = {'largura': largo, 'webp': f'logo-{h}-{alto}.webp', 'png': f'logo-{h}-{alto}.png'}
    if 256 not in saida['altura']:
        saida['altura'][256] = saida['altura'][max(saida['altura'])]   # o JSON-LD pede a maior
    palavra, letra = inicial(marca)
    for px in (32, 48):
        nome = f'icone-{h}-{px}.png'
        guardar(num_quadrado(letra, px * 4, round(px * 4 * .14), LINHO).resize((px, px), Image.LANCZOS).convert('RGB'), os.path.join(CACHE, nome), 'png')
        saida['icones'][px] = nome
    for px, chave in ((180, 'apple'), (192, 192), (512, 512)):
        nome = f'icone-{h}-{chave}.png'
        guardar(num_quadrado(palavra, px, round(px * .12), LINHO).convert('RGB'), os.path.join(CACHE, nome), 'png')
        saida['icones'][chave] = nome
    return saida


def motivo(caminho):
    """O desenho das tulipas com a borboleta (das capas dos destaques), em WebP com transparência."""
    h = resumo(caminho, extra='motivo')
    im = Image.open(caminho).convert('RGBA')
    if im.width > 640:
        im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
    nome = f'tulipas-{h}.webp'
    guardar(im, os.path.join(CACHE, nome), 'webp')
    return {'webp': nome, 'w': im.width, 'h': im.height}


def verificar():
    """→ (erros, avisos). Uma fotografia sem descrição pára (o site não a pode mostrar sem o texto
    alternativo); uma descrição sem fotografia só avisa (não faz mal a nada: o gerador nunca a
    usa)."""
    indice = json.load(open(INDICE, encoding='utf-8'))
    ficheiros = {os.path.splitext(f)[0] for f in os.listdir(FOTOS) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))}
    erros, avisos = [], []
    for nome in sorted(ficheiros - set(indice)):
        erros.append(f'Fotografias: a fotografia «{nome}» não tem descrição (texto alternativo) em content/fotos.json')
    for nome in sorted(set(indice) - ficheiros):
        avisos.append(f'Fotografias: a descrição de «{nome}» não tem fotografia em media/fotos/')
    for nome, d in indice.items():
        if nome in ficheiros and not (d.get('alt') or '').strip():
            erros.append(f'Fotografias: a fotografia «{nome}» não tem descrição (texto alternativo)')
    return erros, avisos


def anotar(nivel, texto):
    """No GitHub Actions, a mensagem vai também como anotação: é o que o painel lê para dizer porque
    é que a publicação parou (o título é o ecrã, antes dos dois pontos)."""
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        return
    dados = lambda t: t.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    titulo, _, resto = texto.partition(': ')
    if resto:
        print(f'::{nivel} title={dados(titulo).replace(":", "%3A").replace(",", "%2C")}::{dados(resto)}')
    else:
        print(f'::{nivel}::{dados(texto)}')


def principal():
    erros, avisos = verificar()
    for a in avisos:
        print(f'  ! {a}', file=sys.stderr)
        anotar('warning', a)
    if erros:
        print('\n'.join(erros), file=sys.stderr)
        for e in erros[:10]:
            anotar('error', e)
        sys.exit(1)
    if '--verificar' in sys.argv:
        print('fotografias conferidas:', len(json.load(open(INDICE, encoding='utf-8'))))
        return
    os.makedirs(CACHE, exist_ok=True)
    manifesto = {'fotos': {}, 'posters': {}, 'partilha': {}, 'logo': None, 'motivo': None}
    origens = {}
    for f in sorted(os.listdir(FOTOS)):
        nome, ext = os.path.splitext(f)
        if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        origens[nome] = os.path.join(FOTOS, f)
        manifesto['fotos'][nome] = versoes(nome, origens[nome])
        manifesto['fotos'][nome]['painel'] = [para_o_painel(nome, origens[nome], t) for t in PAINEL]
    for f in sorted(glob.glob(os.path.join(VIDEO, '*.jpg'))):
        nome = 'video-' + os.path.splitext(os.path.basename(f))[0]
        manifesto['posters'][nome] = versoes(nome, f)
    # cartões de partilha: um por peça e um por coleção (a primeira fotografia de cada)
    for pasta, prefixo in ((PRODUTOS, ''), (COLECOES, 'colecao-')):
        for f in sorted(glob.glob(os.path.join(pasta, '*.json'))):
            slug = prefixo + os.path.splitext(os.path.basename(f))[0]
            p = json.load(open(f, encoding='utf-8'))
            fotos = p.get('fotos') or []
            if fotos and fotos[0] in origens:
                manifesto['partilha'][slug] = cartao_produto(slug, origens[fotos[0]])
    logo = os.path.join(MARCA, 'logo.png')
    if os.path.exists(logo):
        manifesto['logo'] = logotipo(logo)
        manifesto['partilha']['_site'] = cartao_logotipo(logo)
    tulipas = os.path.join(MARCA, 'tulipas.png')
    if os.path.exists(tulipas):
        manifesto['motivo'] = motivo(tulipas)
    # tira da cache o que já não é de nenhuma versão actual (fotografias trocadas ou apagadas)
    vivos = set()
    for grupo in ('fotos', 'posters'):
        for nome, d in manifesto[grupo].items():
            for w in d['larguras']:
                for fmt in d['formatos']:
                    vivos.add(f'{nome}-{d["resumo"]}-{w}.{fmt}')
    vivos.update(manifesto['partilha'].values())
    for d in manifesto['fotos'].values():
        for f in d['painel']:
            vivos.update([f, f + '.resumo'])
    if manifesto['logo']:
        for d in manifesto['logo']['altura'].values():
            vivos.update([d['webp'], d['png']])
        vivos.update(manifesto['logo']['icones'].values())
    if manifesto['motivo']:
        vivos.add(manifesto['motivo']['webp'])
    for f in os.listdir(CACHE):
        if f != 'manifesto.json' and f not in vivos:
            os.remove(os.path.join(CACHE, f))
    with open(os.path.join(CACHE, 'manifesto.json'), 'w', encoding='utf-8') as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=1)
    print(f'imagens: {len(manifesto["fotos"])} fotografias, {len(manifesto["posters"])} capas de vídeo, '
          f'{len(manifesto["partilha"])} cartões de partilha')


if __name__ == '__main__':
    principal()
