# Questões por Tema

App web local para praticar estudos com questões de múltipla escolha organizadas
por tema. Funciona offline, sem instalação e sem servidor: é só abrir o
`index.html` no navegador.

As questões ficam em arquivos JSON que você mesmo edita.

## Como usar

1. Abra `index.html` no navegador (duplo clique no arquivo já resolve).
2. Escolha os temas, a dificuldade e quantas questões quer responder.
3. Escolha a correção:
   - **Imediata** — mostra certo/errado e a explicação a cada questão;
   - **Só no final** — estilo prova, você só vê o resultado ao terminar.
4. Ao final, veja a nota, a revisão questão a questão e o botão
   **Refazer só os erros**.

Atalhos durante o simulado: teclas `1`–`6` respondem, `Enter` avança.

O desempenho acumulado por tema fica salvo no navegador (localStorage) e aparece
na tela inicial. O botão **Apagar histórico** zera tudo.

## Como adicionar ou trocar questões

Cada tema é um arquivo em `banco/`. Para criar um tema novo, crie um arquivo
`banco/meu-tema.json` e depois rode:

```bash
python3 gerar_banco.py
```

Esse comando valida os arquivos e regera `app/banco.js`, que é o que o app
carrega. **Toda vez que editar um JSON, rode o comando de novo**, senão o app
continua mostrando a versão anterior.

Para só conferir se os arquivos estão válidos, sem gerar nada:

```bash
python3 gerar_banco.py --check
```

### Formato do arquivo

```json
{
  "tema": "Nome do tema",
  "descricao": "Uma linha explicando o que o tema cobre.",
  "questoes": [
    {
      "id": "abc-001",
      "enunciado": "Texto da pergunta?",
      "alternativas": ["Primeira", "Segunda", "Terceira", "Quarta"],
      "correta": 0,
      "explicacao": "Por que essa é a resposta certa.",
      "dificuldade": "facil",
      "tags": ["assunto", "subassunto"]
    }
  ]
}
```

| Campo | Obrigatório | Observações |
|---|---|---|
| `tema` | sim | Nome exibido na seleção de temas. |
| `descricao` | não | Aparece embaixo do nome do tema. |
| `id` | sim | Único em **todo** o banco; o validador acusa duplicatas. |
| `enunciado` | sim | Texto da pergunta. |
| `alternativas` | sim | De 2 a 6 opções, sem repetições. |
| `correta` | sim | Índice da alternativa certa, **começando em 0**. |
| `explicacao` | não | Mostrada na correção e na revisão. Vale muito a pena preencher. |
| `dificuldade` | não | `facil`, `medio` ou `dificil`. Padrão: `medio`. |
| `tags` | não | Lista de textos, para organização futura. |

Detalhes que evitam erro:

- `"correta": 0` é a **primeira** alternativa, não a segunda.
- Não precisa variar a posição da resposta certa: o app embaralha as
  alternativas a cada rodada.
- Não precisa embaralhar as questões: o app sorteia a ordem também.
- O JSON precisa ser válido — atenção a vírgulas sobrando e aspas.
  Se algo estiver errado, `gerar_banco.py` aponta o arquivo e a questão.

## Estrutura do projeto

```
index.html          telas do app
app/estilo.css      estilos (tema claro e escuro, conforme o sistema)
app/app.js          lógica do simulado
app/banco.js        GERADO — não edite à mão
banco/*.json        as questões, um arquivo por tema
gerar_banco.py      valida os JSON e gera app/banco.js
```

## Temas incluídos

Os três temas atuais são **exemplos de partida** para o app já abrir
funcionando. Podem ser editados ou apagados à vontade:

- Português — 12 questões
- Matemática e Raciocínio Lógico — 12 questões
- História do Brasil — 12 questões

## Requisitos

- Um navegador (Chrome, Firefox, Edge, Safari).
- Python 3 apenas para rodar `gerar_banco.py` ao editar as questões.
  Para só responder simulados, o Python não é necessário.
