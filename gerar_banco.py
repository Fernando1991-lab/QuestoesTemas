#!/usr/bin/env python3
"""Valida os arquivos JSON de banco/ e gera app/banco.js para o app web.

Uso:
    python3 gerar_banco.py          # valida e gera app/banco.js
    python3 gerar_banco.py --check  # apenas valida, não escreve nada

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


def carregar_tema(caminho: Path) -> dict:
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ErroDeValidacao(f"{caminho.name}: JSON inválido — {e}") from e

    _exigir(isinstance(dados, dict), f"{caminho.name}: o arquivo deve conter um objeto")
    _exigir(
        isinstance(dados.get("tema"), str) and dados["tema"].strip() != "",
        f"{caminho.name}: falta o campo 'tema'",
    )
    _exigir(
        isinstance(dados.get("questoes"), list) and dados["questoes"],
        f"{caminho.name}: 'questoes' deve ser uma lista com ao menos uma questão",
    )

    questoes = [
        validar_questao(q, f"{caminho.name} → questão {i + 1}")
        for i, q in enumerate(dados["questoes"])
    ]

    return {
        "arquivo": caminho.stem,
        "tema": dados["tema"].strip(),
        "descricao": str(dados.get("descricao", "")).strip(),
        "questoes": questoes,
    }


def main(argv: list[str]) -> int:
    apenas_checar = "--check" in argv

    if not DIR_BANCO.is_dir():
        print(f"erro: pasta '{DIR_BANCO.name}/' não encontrada", file=sys.stderr)
        return 1

    arquivos = sorted(DIR_BANCO.glob("*.json"))
    if not arquivos:
        print(f"erro: nenhum arquivo .json em '{DIR_BANCO.name}/'", file=sys.stderr)
        return 1

    temas: list[dict] = []
    erros: list[str] = []
    for caminho in arquivos:
        try:
            temas.append(carregar_tema(caminho))
        except ErroDeValidacao as e:
            erros.append(str(e))

    vistos: dict[str, str] = {}
    for tema in temas:
        for q in tema["questoes"]:
            anterior = vistos.get(q["id"])
            if anterior:
                erros.append(
                    f"id duplicado {q['id']!r}: aparece em {anterior} e em "
                    f"{tema['arquivo']}.json"
                )
            else:
                vistos[q["id"]] = f"{tema['arquivo']}.json"

    if erros:
        print("Foram encontrados problemas no banco de questões:\n", file=sys.stderr)
        for e in erros:
            print(f"  - {e}", file=sys.stderr)
        return 1

    temas.sort(key=lambda t: t["tema"].lower())
    total = sum(len(t["questoes"]) for t in temas)

    for tema in temas:
        contagem = {d: 0 for d in sorted(DIFICULDADES)}
        for q in tema["questoes"]:
            contagem[q["dificuldade"]] += 1
        detalhe = ", ".join(f"{n} {d}" for d, n in contagem.items() if n)
        print(f"  {tema['tema']}: {len(tema['questoes'])} questões ({detalhe})")
    print(f"\nTotal: {total} questões em {len(temas)} tema(s).")

    if apenas_checar:
        print("Validação concluída (nada foi escrito).")
        return 0

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    conteudo = json.dumps(temas, ensure_ascii=False, indent=2)
    SAIDA.write_text(
        "// Arquivo gerado automaticamente por gerar_banco.py — não edite à mão.\n"
        "// Edite os arquivos em banco/*.json e rode: python3 gerar_banco.py\n"
        f"window.BANCO_QUESTOES = {conteudo};\n",
        encoding="utf-8",
    )
    print(f"Gerado: {SAIDA.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
