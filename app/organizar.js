/* Modo "Organizar": arrastar temas entre grupos e gravar o resultado
   direto no repositório, via API do GitHub.

   O banco de verdade continua sendo os arquivos em banco/. Mover um tema
   aqui vira, no commit, um "move" de arquivo: o mesmo blob passa a existir
   no caminho novo e some do antigo. O app/banco.js é regerado junto, para
   o site já subir consistente sem precisar rodar o gerar_banco.py. */
(function () {
  "use strict";

  var QT = window.QT;
  if (!QT) return;

  var CHAVE_TOKEN = "questoes-por-tema:github-token:v1";
  var CHAVE_CONFIG = "questoes-por-tema:github-config:v1";

  var CONFIG_PADRAO = {
    dono: "Fernando1991-lab",
    repo: "QuestoesTemas",
    branch: "claude/programa-questoes-estudos-5yhk3u"
  };

  var organizando = false;
  var arrastando = null;   // chave do tema sendo arrastado
  var alvoAtual = null;
  var pastasOriginais = null;
  var salvando = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- configuração e token ---------- */

  function config() {
    var salvo = QT.lerJson(CHAVE_CONFIG, {});
    return {
      dono: salvo.dono || CONFIG_PADRAO.dono,
      repo: salvo.repo || CONFIG_PADRAO.repo,
      branch: salvo.branch || CONFIG_PADRAO.branch
    };
  }

  function token() {
    try { return localStorage.getItem(CHAVE_TOKEN) || ""; } catch (e) { return ""; }
  }

  function guardarToken(valor) {
    try {
      if (valor) localStorage.setItem(CHAVE_TOKEN, valor);
      else localStorage.removeItem(CHAVE_TOKEN);
    } catch (e) { /* armazenamento bloqueado */ }
  }

  /* ---------- chamadas à API ---------- */

  function api(caminho, metodo, corpo) {
    var cfg = config();
    var cabecalhos = {
      "Authorization": "Bearer " + token(),
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (corpo) cabecalhos["Content-Type"] = "application/json";

    return fetch(
      "https://api.github.com/repos/" + cfg.dono + "/" + cfg.repo + caminho,
      { method: metodo || "GET", headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined }
    ).then(function (r) {
      if (r.ok) return r.json();
      return r.text().then(function (texto) {
        var detalhe = texto;
        try { detalhe = JSON.parse(texto).message || texto; } catch (e) { /* texto cru */ }
        if (r.status === 401) detalhe = "token inválido ou expirado";
        if (r.status === 403) detalhe = "token sem permissão de escrita neste repositório";
        if (r.status === 404) detalhe = "repositório ou branch não encontrado (confira os campos abaixo)";
        throw new Error(detalhe);
      });
    });
  }

  /* ---------- estado do que mudou ---------- */

  function iniciarSnapshot() {
    QT.temas.forEach(function (t) {
      if (t.chaveOriginal === undefined) t.chaveOriginal = t.chave;
    });
    pastasOriginais = {};
    QT.pastas.forEach(function (p) {
      pastasOriginais[p.caminho.join("/")] = {
        nome: p.nome, descricao: p.descricao || "", ordem: p.ordem || 0
      };
    });
  }

  function mudancas() {
    var movidos = QT.temas.filter(function (t) { return t.chave !== t.chaveOriginal; });

    var criadas = [];
    var alteradas = [];
    var atuais = {};
    QT.pastas.forEach(function (p) {
      var chave = p.caminho.join("/");
      atuais[chave] = true;
      var antes = pastasOriginais[chave];
      if (!antes) criadas.push(p);
      else if (antes.nome !== p.nome || antes.descricao !== (p.descricao || "") ||
               antes.ordem !== (p.ordem || 0)) alteradas.push(p);
    });

    var removidas = Object.keys(pastasOriginais).filter(function (c) { return !atuais[c]; });

    return { movidos: movidos, criadas: criadas, alteradas: alteradas, removidas: removidas };
  }

  function total(m) {
    return m.movidos.length + m.criadas.length + m.alteradas.length + m.removidas.length;
  }

  function descrever(m) {
    var partes = [];
    if (m.movidos.length) partes.push(m.movidos.length + (m.movidos.length === 1 ? " tema movido" : " temas movidos"));
    if (m.criadas.length) partes.push(m.criadas.length + (m.criadas.length === 1 ? " grupo criado" : " grupos criados"));
    if (m.alteradas.length) partes.push(m.alteradas.length + (m.alteradas.length === 1 ? " grupo alterado" : " grupos alterados"));
    if (m.removidas.length) partes.push(m.removidas.length + (m.removidas.length === 1 ? " grupo removido" : " grupos removidos"));
    return partes.join(", ");
  }

  /* ---------- regeração do app/banco.js ---------- */

  // Precisa espelhar a ordenação do gerar_banco.py, senão o arquivo fica
  // diferente do que o Python produziria e cada lado desfaz o do outro.
  function chaveDeOrdem(caminho) {
    var nomes = {}, ordens = {};
    QT.pastas.forEach(function (p) {
      var c = p.caminho.join("/");
      nomes[c] = p.nome;
      ordens[c] = p.ordem || 0;
    });
    return caminho.map(function (_, i) {
      var c = caminho.slice(0, i + 1).join("/");
      return [ordens[c] || 0, (nomes[c] || caminho[i]).toLowerCase()];
    });
  }

  function compararCadeia(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
      if (a[i][0] !== b[i][0]) return a[i][0] - b[i][0];
      if (a[i][1] !== b[i][1]) return a[i][1] < b[i][1] ? -1 : 1;
    }
    return a.length - b.length;
  }

  function gerarBancoJs() {
    var pastas = QT.pastas.slice().sort(function (a, b) {
      return compararCadeia(chaveDeOrdem(a.caminho), chaveDeOrdem(b.caminho));
    }).map(function (p) {
      return { caminho: p.caminho, nome: p.nome, descricao: p.descricao || "", ordem: p.ordem || 0 };
    });

    var temas = QT.temas.slice().sort(function (a, b) {
      var c = compararCadeia(chaveDeOrdem(a.caminho), chaveDeOrdem(b.caminho));
      if (c) return c;
      if ((a.ordem || 0) !== (b.ordem || 0)) return (a.ordem || 0) - (b.ordem || 0);
      var na = a.tema.toLowerCase(), nb = b.tema.toLowerCase();
      return na < nb ? -1 : (na > nb ? 1 : 0);
    }).map(function (t) {
      // Sem as propriedades que o app cria em memória (rótulos, snapshot).
      return {
        chave: t.chave,
        caminho: t.caminho,
        tema: t.tema,
        descricao: t.descricao || "",
        ordem: t.ordem || 0,
        questoes: t.questoes
      };
    });

    return "// Arquivo gerado automaticamente por gerar_banco.py — não edite à mão.\n" +
      "// Edite os arquivos em banco/ e rode: python3 gerar_banco.py\n" +
      "window.BANCO_QUESTOES = " +
      JSON.stringify({ versao: 2, pastas: pastas, temas: temas }, null, 2) + ";\n";
  }

  /* ---------- gravação ---------- */

  function salvar() {
    var m = mudancas();
    if (!total(m) || salvando) return;

    salvando = true;
    atualizarBarra();
    var cfg = config();
    var commitSha, treeSha, shaPorCaminho = {};
    var entradas = {};

    function entrada(caminho, sha) {
      entradas[caminho] = { path: caminho, mode: "100644", type: "blob", sha: sha };
    }

    function blob(conteudo) {
      return api("/git/blobs", "POST", { content: conteudo, encoding: "utf-8" });
    }

    informar("Lendo o estado atual do repositório…");

    api("/git/ref/heads/" + cfg.branch)
      .then(function (ref) {
        commitSha = ref.object.sha;
        return api("/git/commits/" + commitSha);
      })
      .then(function (commit) {
        treeSha = commit.tree.sha;
        return api("/git/trees/" + treeSha + "?recursive=1");
      })
      .then(function (arvore) {
        if (arvore.truncated) {
          throw new Error("a listagem do repositório veio truncada; salve pelo terminal desta vez");
        }
        arvore.tree.forEach(function (e) {
          if (e.type === "blob") shaPorCaminho[e.path] = e.sha;
        });

        // Apagar os caminhos antigos primeiro; as inclusões abaixo
        // sobrescrevem a entrada caso um destino coincida com uma origem.
        m.movidos.forEach(function (t) { entrada("banco/" + t.chaveOriginal, null); });
        m.removidas.forEach(function (c) {
          var alvo = "banco/" + c + "/_pasta.json";
          if (shaPorCaminho[alvo]) entrada(alvo, null);
        });
        m.movidos.forEach(function (t) {
          var origem = "banco/" + t.chaveOriginal;
          var sha = shaPorCaminho[origem];
          if (!sha) throw new Error("não encontrei " + origem + " no repositório");
          entrada("banco/" + t.chave, sha);
        });

        informar("Preparando os arquivos…");
        var marcadores = m.criadas.concat(m.alteradas).map(function (p) {
          var conteudo = JSON.stringify(
            { nome: p.nome, descricao: p.descricao || "", ordem: p.ordem || 0 }, null, 2) + "\n";
          return blob(conteudo).then(function (b) {
            entrada("banco/" + p.caminho.join("/") + "/_pasta.json", b.sha);
          });
        });
        return Promise.all(marcadores);
      })
      .then(function () {
        return blob(gerarBancoJs());
      })
      .then(function (b) {
        entrada("app/banco.js", b.sha);
        informar("Criando o commit…");
        return api("/git/trees", "POST", {
          base_tree: treeSha,
          tree: Object.keys(entradas).map(function (k) { return entradas[k]; })
        });
      })
      .then(function (arvore) {
        return api("/git/commits", "POST", {
          message: "Organiza banco pelo site: " + descrever(m),
          tree: arvore.sha,
          parents: [commitSha]
        });
      })
      .then(function (commit) {
        return api("/git/refs/heads/" + cfg.branch, "PATCH", { sha: commit.sha });
      })
      .then(function () {
        QT.temas.forEach(function (t) { t.chaveOriginal = t.chave; });
        iniciarSnapshot();
        informar("Salvo. O site publicado atualiza em cerca de 1 minuto.", "ok");
      })
      .catch(function (e) {
        informar("Não deu para salvar: " + e.message, "erro");
      })
      .then(function () {
        salvando = false;
        atualizarBarra();
      });
  }

  /* ---------- operações de organização ---------- */

  function mover(chave, caminho) {
    var tema = null;
    QT.temas.forEach(function (t) { if (t.chave === chave) tema = t; });
    if (!tema) return;
    if (tema.caminho.join("/") === caminho.join("/")) return;

    var arquivo = chave.split("/").pop();
    var nova = caminho.concat([arquivo]).join("/");
    var ocupado = QT.temas.some(function (t) { return t !== tema && t.chave === nova; });
    if (ocupado) {
      informar("Já existe um arquivo chamado " + arquivo + " nesse grupo.", "erro");
      return;
    }

    tema.chave = nova;
    tema.caminho = caminho.slice();
    remontar();
    informar("");
  }

  function segmentoValido(nome, irmaos) {
    var base = nome
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // tira acentos do nome no disco
      .replace(/[^A-Za-z0-9 ._-]/g, "")
      .trim().replace(/\s+/g, " ") || "Grupo";
    var candidato = base, n = 2;
    while (irmaos.indexOf(candidato) !== -1) candidato = base + " " + (n++);
    return candidato;
  }

  function criarGrupo(pai) {
    var nome = prompt("Nome do novo grupo:", "");
    if (!nome || !nome.trim()) return;
    nome = nome.trim();

    var irmaos = QT.pastas
      .filter(function (p) { return p.caminho.slice(0, -1).join("/") === pai.join("/"); })
      .map(function (p) { return p.caminho[p.caminho.length - 1]; });

    QT.pastas.push({
      caminho: pai.concat([segmentoValido(nome, irmaos)]),
      nome: nome,
      descricao: "",
      ordem: 0
    });
    remontar();
    informar("");
  }

  function renomearGrupo(caminho) {
    var chave = caminho.join("/");
    var pasta = null;
    QT.pastas.forEach(function (p) { if (p.caminho.join("/") === chave) pasta = p; });
    if (!pasta) return;
    var nome = prompt("Novo nome do grupo:", pasta.nome);
    if (!nome || !nome.trim()) return;
    // Renomear muda só o rótulo (_pasta.json); a pasta no disco continua a
    // mesma, então nenhum arquivo de questão precisa ser movido.
    pasta.nome = nome.trim();
    remontar();
    informar("");
  }

  function excluirGrupo(caminho) {
    var chave = caminho.join("/");
    var temTemas = QT.temas.some(function (t) { return t.caminho.join("/").indexOf(chave) === 0; });
    var temSub = QT.pastas.some(function (p) {
      var c = p.caminho.join("/");
      return c !== chave && c.indexOf(chave + "/") === 0;
    });
    if (temTemas || temSub) {
      informar("Esvazie o grupo antes de excluí-lo.", "erro");
      return;
    }
    if (!confirm("Excluir o grupo vazio?")) return;
    // splice, e não reatribuição: o app.js mantém a mesma referência de array.
    for (var i = QT.pastas.length - 1; i >= 0; i--) {
      if (QT.pastas[i].caminho.join("/") === chave) QT.pastas.splice(i, 1);
    }
    remontar();
    informar("");
  }

  /* ---------- interface ---------- */

  function informar(texto, tipo) {
    var el = $("status-organizar");
    el.textContent = texto || "";
    el.className = "status-organizar" + (tipo ? " " + tipo : "");
  }

  function atualizarBarra() {
    var m = mudancas();
    var n = total(m);
    var botao = $("btn-salvar-github");
    botao.disabled = n === 0 || salvando;
    botao.textContent = salvando ? "Salvando…"
      : n ? "Salvar no GitHub (" + n + ")" : "Salvar no GitHub";
    $("btn-descartar").hidden = n === 0 || salvando;
    $("resumo-organizar").textContent = n ? descrever(m) : "Nenhuma mudança pendente.";
  }

  function remontar() {
    QT.remontar();
    if (organizando) decorar();
    atualizarBarra();
  }

  function caminhoDe(el) {
    if (!el || el.id === "lista-temas") return [];
    var bruto = el.dataset.caminho || "";
    return bruto ? bruto.split("/") : [];
  }

  function alvoDe(no) {
    if (!no || !no.closest) return null;
    // A zona neutra vem antes das pastas: é o único ponto da lista que não
    // está dentro de um grupo, e portanto o único jeito de desagrupar.
    return no.closest(".zona-raiz") || no.closest("details.pasta") || $("lista-temas");
  }

  function destacar(alvo) {
    if (alvoAtual === alvo) return;
    if (alvoAtual) alvoAtual.classList.remove("alvo-drop");
    alvoAtual = alvo;
    if (alvoAtual) alvoAtual.classList.add("alvo-drop");
  }

  function decorar() {
    var lista = $("lista-temas");

    Array.prototype.forEach.call(lista.querySelectorAll(".item-tema"), function (item) {
      item.draggable = true;
    });

    if (!lista.querySelector(".zona-raiz")) {
      var zona = document.createElement("div");
      zona.className = "zona-raiz";
      zona.dataset.caminho = "";
      zona.textContent = "Sem grupo — solte aqui para tirar um tema de todos os grupos";
      lista.appendChild(zona);
    }

    Array.prototype.forEach.call(lista.querySelectorAll("details.pasta"), function (det) {
      var cabecalho = det.querySelector(".cabecalho-pasta");
      if (!cabecalho || cabecalho.querySelector(".acoes-pasta")) return;

      var acoes = document.createElement("span");
      acoes.className = "acoes-pasta";
      [
        ["+", "Criar subgrupo", function (c) { criarGrupo(c); }],
        ["✎", "Renomear grupo", function (c) { renomearGrupo(c); }],
        ["×", "Excluir grupo vazio", function (c) { excluirGrupo(c); }]
      ].forEach(function (def) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "acao-pasta";
        b.textContent = def[0];
        b.title = def[1];
        b.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          def[2](caminhoDe(det));
        });
        acoes.appendChild(b);
      });
      cabecalho.appendChild(acoes);
    });
  }

  function alternarModo() {
    organizando = !organizando;
    document.body.classList.toggle("modo-organizar", organizando);
    $("barra-organizar").hidden = !organizando;
    $("btn-organizar").textContent = organizando ? "Concluir organização" : "Organizar";
    if (organizando) { iniciarSnapshot(); decorar(); atualizarBarra(); }
    else { $("painel-token").hidden = true; informar(""); }
  }

  function descartar() {
    if (!confirm("Descartar as mudanças que ainda não foram salvas?")) return;
    location.reload();
  }

  /* ---------- painel do token ---------- */

  function abrirPainelToken(mensagem) {
    var cfg = config();
    $("campo-dono").value = cfg.dono;
    $("campo-repo").value = cfg.repo;
    $("campo-branch").value = cfg.branch;
    $("campo-token").value = "";
    $("aviso-token").textContent = mensagem || "";
    $("aviso-token").className = "ajuda" + (mensagem ? " erro" : "");
    $("btn-desconectar").hidden = !token();
    $("painel-token").hidden = false;
    $("campo-token").focus();
  }

  function conectar() {
    var novoToken = $("campo-token").value.trim();
    QT.gravarJson(CHAVE_CONFIG, {
      dono: $("campo-dono").value.trim() || CONFIG_PADRAO.dono,
      repo: $("campo-repo").value.trim() || CONFIG_PADRAO.repo,
      branch: $("campo-branch").value.trim() || CONFIG_PADRAO.branch
    });
    if (novoToken) guardarToken(novoToken);
    if (!token()) { abrirPainelToken("Cole um token para continuar."); return; }

    $("aviso-token").textContent = "Testando o acesso…";
    $("aviso-token").className = "ajuda";
    api("/git/ref/heads/" + config().branch)
      .then(function () {
        $("painel-token").hidden = true;
        informar("Conectado ao GitHub.", "ok");
        salvar();
      })
      .catch(function (e) { abrirPainelToken("Falhou: " + e.message); });
  }

  function desconectar() {
    guardarToken("");
    abrirPainelToken("Token removido deste navegador.");
  }

  function pedirSalvar() {
    if (!token()) { abrirPainelToken(""); return; }
    salvar();
  }

  /* ---------- eventos ---------- */

  function ligar() {
    var lista = $("lista-temas");

    lista.addEventListener("dragstart", function (e) {
      var item = e.target.closest && e.target.closest(".item-tema");
      if (!organizando || !item) return;
      var campo = item.querySelector("input[name=tema]");
      if (!campo) return;
      arrastando = campo.value;
      item.classList.add("arrastando");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", arrastando);
    });

    lista.addEventListener("dragend", function () {
      arrastando = null;
      destacar(null);
      Array.prototype.forEach.call(
        lista.querySelectorAll(".arrastando"),
        function (el) { el.classList.remove("arrastando"); }
      );
    });

    lista.addEventListener("dragover", function (e) {
      if (!organizando || !arrastando) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      destacar(alvoDe(e.target));
    });

    lista.addEventListener("drop", function (e) {
      if (!organizando || !arrastando) return;
      e.preventDefault();
      var alvo = alvoDe(e.target);
      var chave = arrastando;
      arrastando = null;
      destacar(null);
      mover(chave, caminhoDe(alvo));
    });

    $("btn-organizar").addEventListener("click", alternarModo);
    $("btn-novo-grupo").addEventListener("click", function () { criarGrupo([]); });
    $("btn-salvar-github").addEventListener("click", pedirSalvar);
    $("btn-descartar").addEventListener("click", descartar);
    $("btn-conectar").addEventListener("click", conectar);
    $("btn-desconectar").addEventListener("click", desconectar);
    $("btn-config-token").addEventListener("click", function () { abrirPainelToken(""); });

    window.addEventListener("beforeunload", function (e) {
      if (organizando && total(mudancas()) > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // Exposto para dar como conferir, de fora, que o arquivo gerado aqui bate
  // com o que o gerar_banco.py produziria — se divergirem, cada lado desfaz
  // o do outro no commit seguinte.
  QT.gerarBancoJs = gerarBancoJs;

  iniciarSnapshot();
  ligar();
})();
