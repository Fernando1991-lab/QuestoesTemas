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

## Organizando em pastas

As pastas dentro de `banco/` viram grupos no app, em qualquer profundidade:

```
banco/
├── Linguagens/
│   ├── _pasta.json          (opcional: nome, descrição e ordem do grupo)
│   └── portugues.json
├── Exatas/
│   ├── matematica.json
│   └── Nível Avançado/      pastas podem ser aninhadas à vontade
│       └── calculo.json
└── avulso.json              arquivo solto na raiz aparece sem grupo
```

A pasta `Geral/` existe para receber questões novas antes de você triá-las.

No app, cada pasta vira um grupo que você abre, fecha e marca por inteiro.
A caixa da pasta fica com um traço quando só parte dos temas dentro dela está
selecionada. O app lembra quais grupos você deixou abertos.

Para reorganizar, basta mover os arquivos e rodar `python3 gerar_banco.py`
de novo — nada no código precisa mudar.

### Nomeando e ordenando as pastas

Por padrão a pasta usa o próprio nome da pasta no disco, e os grupos aparecem
em ordem alfabética. Para mudar isso, coloque um `_pasta.json` dentro dela:

```json
{
  "nome": "Linguagens",
  "descricao": "Língua portuguesa, literatura e interpretação.",
  "ordem": 1
}
```

Todos os campos são opcionais. `ordem` é um número: quanto menor, mais acima o
grupo aparece; empates caem na ordem alfabética. Os temas também aceitam um
campo `"ordem"` para a mesma finalidade.

Arquivos cujo nome começa com `_` nunca são lidos como banco de questões —
é assim que o `_pasta.json` não vira um tema.

## Organizando pelo site (modo Organizar)

Além de mover arquivos na mão, dá para reorganizar o banco pela própria página
e gravar o resultado direto no repositório.

Clique em **Organizar**, na caixa de Temas. A lista vira um editor:

- **Mover para**, embaixo de cada tema, troca o grupo dele. É o caminho que
  funciona em qualquer aparelho, inclusive celular;
- no computador dá para **arrastar** o tema para dentro de outro grupo, e soltar
  na faixa **Sem grupo** para tirá-lo de todos;
- **+** cria um subgrupo, **✎** renomeia, **×** exclui um grupo vazio;
- **Novo grupo** cria um grupo na raiz.

Nada é gravado enquanto você não clicar em **Salvar no GitHub**. O botão mostra
quantas mudanças estão pendentes, e **Descartar** recarrega a página jogando
tudo fora.

> O arrastar depende de mouse — o drag-and-drop do navegador não responde a
> gestos de toque. Em telas de toque a alça de arrastar e a faixa "Sem grupo"
> ficam ocultas, e o **Mover para** cobre as duas funções.

### O que o Salvar faz

Um único commit na branch configurada, contendo:

- o arquivo do tema movido — o mesmo conteúdo, no caminho novo (é um *move*
  de verdade: nada é reescrito nem reformatado);
- o `_pasta.json` dos grupos criados, renomeados ou removidos;
- o `app/banco.js` regerado, byte a byte igual ao que o `gerar_banco.py`
  produziria, para os dois caminhos não desfazerem o trabalho um do outro.

Cerca de um minuto depois, o GitHub Pages republica o site já atualizado.

### Conectando ao GitHub

Na primeira vez que você mandar salvar, aparece o painel de conexão. Ele pede um
**fine-grained personal access token**, que você cria em
[github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens/new)
com:

- **Repository access**: apenas este repositório;
- **Permissions → Contents**: `Read and write`;
- uma **data de expiração** curta, que você renova quando vencer.

Sobre esse token, sem rodeios:

- ele fica no `localStorage` **do seu navegador** e nunca vai para o
  repositório — mas qualquer pessoa com acesso ao seu navegador desbloqueado
  consegue lê-lo;
- por isso ele deve ser restrito a este repositório e a `Contents`, e nada mais;
- outras pessoas que abrirem o site publicado **não** conseguem salvar: elas não
  têm o seu token, e o token não é publicado em lugar nenhum;
- **Conexão → Remover token deste navegador** apaga o token. Se desconfiar dele,
  revogue direto nas configurações do GitHub — isso invalida o token na hora.

## Como adicionar ou trocar questões

Cada tema é um arquivo `.json` dentro de `banco/` (na raiz ou em qualquer
subpasta). Para criar um tema novo, crie o arquivo e depois rode:

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
| `ordem` | não | Número que ordena o tema dentro do grupo. Padrão: 0. |
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
- O `id` precisa ser único no banco inteiro, não só dentro do arquivo.
  Dois temas em pastas diferentes não podem repetir o mesmo `id`.

## Estrutura do projeto

```
index.html          telas do app
app/estilo.css      estilos (tema claro e escuro, conforme o sistema)
app/app.js          lógica do simulado
app/organizar.js    modo Organizar: arrastar grupos e gravar via API do GitHub
app/banco.js        GERADO — não edite à mão
banco/              as questões: um arquivo por tema, pastas viram grupos
banco/**/_pasta.json  opcional: nome, descrição e ordem de um grupo
gerar_banco.py      valida os JSON e gera app/banco.js
```

## Temas incluídos

Os três temas atuais são **exemplos de partida** para o app já abrir
funcionando. Podem ser editados, movidos ou apagados à vontade — inclusive as
pastas, que só existem para demonstrar o agrupamento:

- Linguagens › Português — 12 questões
- Exatas › Matemática e Raciocínio Lógico — 12 questões
- Humanas › História do Brasil — 12 questões

## Requisitos

- Um navegador (Chrome, Firefox, Edge, Safari).
- Python 3 apenas para rodar `gerar_banco.py` ao editar as questões.
  Para só responder simulados, o Python não é necessário.
