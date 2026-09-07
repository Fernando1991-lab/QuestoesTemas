#!/usr/bin/env python3
"""Valida os arquivos JSON de banco/ e gera app/banco.js para o app web.

Uso:
    python3 gerar_banco.py          # valida e gera app/banco.js
    python3 gerar_banco.py --check  # apenas valida, não escreve nada

As pastas dentro de banco/ viram grupos no app, em qualquer profundidade:

    banco/Exatas/matematica.json          -> grupo "Exatas"
    banco/Concursos/Direito/const.json    -> grupo "Concursos > Direito"
    banco/avulso.json                     -> sem grupo (fica no topo)

Cada pasta pode ter um arquivo opcional _pasta.json para definir nome de
exibição, descrição e ordem. Arquivos começados por "_" nunca são lidos
como banco de questões.

O app web é aberto direto do disco (file://), e navegadores bloqueiam
fetch() de arquivos locais. Por isso o banco é empacotado num .js que
apenas atribui os dados a window.BANCO_QUESTOES.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DIR_BANCO = RAIZ / "banco"
SAIDA = RAIZ / "app" / "banco.js"

ARQUIVO_PASTA = "_pasta.json"
DIFICULDADES = {"facil", "medio", "dificil"}
MIN_ALTERNATIVAS = 2
MAX_ALTERNATIVAS = 6


class ErroDeValidacao(Exception):
    pass


def _exigir(condicao: bool, mensagem: str) -> None:
    if not condicao:
        raise ErroDeValidacao(mensagem)


def validar_questao(q: object, onde: str) -> dict:
    _exigir(isinstance(q, dict), f"{onde}: questão deve ser um objeto JSON")
    assert isinstance(q, dict)

    for campo in ("id", "enunciado", "alternativas", "correta"):
        _exigir(campo in q, f"{onde}: falta o campo obrigatório '{campo}'")

    _exigir(
        isinstance(q["id"], str) and q["id"].strip() != "",
        f"{onde}: 'id' deve ser um texto não vazio",
    )
    _exigir(
        isinstance(q["enunciado"], str) and q["enunciado"].strip() != "",
        f"{onde}: 'enunciado' deve ser um texto não vazio",
    )

    alts = q["alternativas"]
    _exigir(isinstance(alts, list), f"{onde}: 'alternativas' deve ser uma lista")
    _exigir(
        MIN_ALTERNATIVAS <= len(alts) <= MAX_ALTERNATIVAS,
        f"{onde}: são esperadas de {MIN_ALTERNATIVAS} a {MAX_ALTERNATIVAS} "
        f"alternativas, encontrei {len(alts)}",
    )
    for i, alt in enumerate(alts):
        _exigir(
            isinstance(alt, str) and alt.strip() != "",
            f"{onde}: alternativa {i} deve ser um texto não vazio",
        )
    _exigir(
        len({a.strip().lower() for a in alts}) == len(alts),
        f"{onde}: há alternativas repetidas",
    )

    correta = q["correta"]
    _exigir(
        isinstance(correta, int) and not isinstance(correta, bool),
        f"{onde}: 'correta' deve ser um número inteiro (índice da alternativa, "
        f"começando em 0)",
    )
    _exigir(
        0 <= correta < len(alts),
        f"{onde}: 'correta' = {correta} está fora do intervalo 0..{len(alts) - 1}",
    )

    dificuldade = q.get("dificuldade", "medio")
    _exigir(
        dificuldade in DIFICULDADES,
        f"{onde}: 'dificuldade' deve ser uma de {sorted(DIFICULDADES)}, "
        f"recebi {dificuldade!r}",
    )

    tags = q.get("tags", [])
    _exigir(isinstance(tags, list), f"{onde}: 'tags' deve ser uma lista")
    _exigir(
        all(isinstance(t, str) for t in tags),
        f"{onde}: todas as 'tags' devem ser textos",
    )

    explicacao = q.get("explicacao", "")
    _exigir(isinstance(explicacao, str), f"{onde}: 'explicacao' deve ser um texto")

    return {
        "id": q["id"].strip(),
        "enunciado": q["enunciado"].strip(),
        "alternativas": [a.strip() for a in alts],
        "correta": correta,
        "explicacao": explicacao.strip(),
        "dificuldade": dificuldade,
        "tags": [t.strip() for t in tags if t.strip()],
    }


def ler_json(caminho: Path, rotulo: str) -> object:
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ErroDeValidacao(f"{rotulo}: JSON inválido — {e}") from e


def carregar_tema(caminho: Path) -> dict:
    rotulo = caminho.relative_to(DIR_BANCO).as_posix()
    dados = ler_json(caminho, rotulo)

    _exigir(isinstance(dados, dict), f"{rotulo}: o arquivo deve conter um objeto")
    assert isinstance(dados, dict)
    _exigir(
        isinstance(dados.get("tema"), str) and dados["tema"].strip() != "",
        f"{rotulo}: falta o campo 'tema'",
    )
    _exigir(
        isinstance(dados.get("questoes"), list) and dados["questoes"],
        f"{rotulo}: 'questoes' deve ser uma lista com ao menos uma questão",
    )

    ordem = dados.get("ordem", 0)
    _exigir(
        isinstance(ordem, int) and not isinstance(ordem, bool),
        f"{rotulo}: 'ordem' deve ser um número inteiro",
    )

    questoes = [
        validar_questao(q, f"{rotulo} → questão {i + 1}")
        for i, q in enumerate(dados["questoes"])
    ]

    return {
        # Chave estável: dois temas homônimos em pastas diferentes não colidem.
        "chave": rotulo,
        "caminho": list(caminho.relative_to(DIR_BANCO).parts[:-1]),
        "tema": dados["tema"].strip(),
        "descricao": str(dados.get("descricao", "")).strip(),
        "ordem": ordem,
        "questoes": questoes,
    }


def carregar_pasta(caminho_pasta: Path) -> dict:
    partes = list(caminho_pasta.relative_to(DIR_BANCO).parts)
    meta = {
        "caminho": partes,
        "nome": partes[-1],
        "descricao": "",
        "ordem": 0,
    }

    arquivo = caminho_pasta / ARQUIVO_PASTA
    if not arquivo.is_file():
        return meta

    rotulo = arquivo.relative_to(DIR_BANCO).as_posix()
    dados = ler_json(arquivo, rotulo)
    _exigir(isinstance(dados, dict), f"{rotulo}: o arquivo deve conter um objeto")
    assert isinstance(dados, dict)

    if "nome" in dados:
        _exigir(
            isinstance(dados["nome"], str) and dados["nome"].strip() != "",
            f"{rotulo}: 'nome' deve ser um texto não vazio",
        )
        meta["nome"] = dados["nome"].strip()
    if "descricao" in dados:
        _exigir(isinstance(dados["descricao"], str), f"{rotulo}: 'descricao' deve ser um texto")
        meta["descricao"] = dados["descricao"].strip()
    if "ordem" in dados:
        _exigir(
            isinstance(dados["ordem"], int) and not isinstance(dados["ordem"], bool),
            f"{rotulo}: 'ordem' deve ser um número inteiro",
        )
        meta["ordem"] = dados["ordem"]

    return meta


def main(argv: list[str]) -> int:
    apenas_checar = "--check" in argv

    if not DIR_BANCO.is_dir():
        print(f"erro: pasta '{DIR_BANCO.name}/' não encontrada", file=sys.stderr)
        return 1

    arquivos = sorted(
        p for p in DIR_BANCO.rglob("*.json") if not p.name.startswith("_")
    )

    temas: list[dict] = []
    erros: list[str] = []
    for caminho in arquivos:
        try:
            temas.append(carregar_tema(caminho))
        except ErroDeValidacao as e:
            erros.append(str(e))

    # Vira grupo toda pasta que contenha temas e toda pasta que declare um
    # _pasta.json — esta segunda regra é o que permite existir um grupo ainda
    # vazio, criado para receber temas depois.
    caminhos_pastas: set[tuple[str, ...]] = set()

    def registrar(partes: tuple[str, ...]) -> None:
        for i in range(1, len(partes) + 1):
            caminhos_pastas.add(partes[:i])

    for tema in temas:
        registrar(tuple(tema["caminho"]))
    for marcador in DIR_BANCO.rglob(ARQUIVO_PASTA):
        registrar(tuple(marcador.parent.relative_to(DIR_BANCO).parts))

    pastas: list[dict] = []
    for partes in sorted(caminhos_pastas):
        try:
            pastas.append(carregar_pasta(DIR_BANCO.joinpath(*partes)))
        except ErroDeValidacao as e:
            erros.append(str(e))

    vistos: dict[str, str] = {}
    for tema in temas:
        for q in tema["questoes"]:
            anterior = vistos.get(q["id"])
            if anterior:
                erros.append(
                    f"id duplicado {q['id']!r}: aparece em {anterior} e em "
                    f"{tema['chave']}"
                )
            else:
                vistos[q["id"]] = tema["chave"]

    if erros:
        print("Foram encontrados problemas no banco de questões:\n", file=sys.stderr)
        for e in erros:
            print(f"  - {e}", file=sys.stderr)
        return 1

    pastas.sort(key=lambda p: (len(p["caminho"]), p["ordem"], p["nome"].lower()))

    nomes = {tuple(p["caminho"]): p["nome"] for p in pastas}
    ordens = {tuple(p["caminho"]): p["ordem"] for p in pastas}

    def chave_pasta(partes: list[str]) -> list[tuple[int, str]]:
        """Ordena uma pasta pela cadeia (ordem, nome) de cada ancestral, para
        que o 'ordem' de _pasta.json valha também nos níveis de cima."""
        return [
            (
                ordens.get(tuple(partes[: i + 1]), 0),
                nomes.get(tuple(partes[: i + 1]), partes[i]).lower(),
            )
            for i in range(len(partes))
        ]

    temas.sort(key=lambda t: (chave_pasta(t["caminho"]), t["ordem"], t["tema"].lower()))
    pastas.sort(key=lambda p: chave_pasta(p["caminho"]))
    for tema in temas:
        rotulo_pasta = " › ".join(
            nomes.get(tuple(tema["caminho"][: i + 1]), tema["caminho"][i])
            for i in range(len(tema["caminho"]))
        )
        prefixo = f"{rotulo_pasta} › " if rotulo_pasta else ""
        print(f"  {prefixo}{tema['tema']}: {len(tema['questoes'])} questões")

    total = sum(len(t["questoes"]) for t in temas)
    vazias = [p["nome"] for p in pastas if not any(
        t["caminho"][: len(p["caminho"])] == p["caminho"] for t in temas
    )]
    if vazias:
        print("  (pastas ainda sem questões: " + ", ".join(vazias) + ")")
    print(
        f"\nTotal: {total} questões em {len(temas)} tema(s) "
        f"e {len(pastas)} pasta(s)."
    )

    if apenas_checar:
        print("Validação concluída (nada foi escrito).")
        return 0

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    conteudo = json.dumps(
        {"versao": 2, "pastas": pastas, "temas": temas},
        ensure_ascii=False,
        indent=2,
    )
    SAIDA.write_text(
        "// Arquivo gerado automaticamente por gerar_banco.py — não edite à mão.\n"
        "// Edite os arquivos em banco/ e rode: python3 gerar_banco.py\n"
        f"window.BANCO_QUESTOES = {conteudo};\n",
        encoding="utf-8",
    )
    print(f"Gerado: {SAIDA.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
