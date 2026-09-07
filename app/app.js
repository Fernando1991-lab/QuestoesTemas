/* Questões por Tema — lógica do simulado.
   O banco vem de window.BANCO_QUESTOES, gerado por gerar_banco.py. */
(function () {
  "use strict";

  var CHAVE_HISTORICO = "questoes-por-tema:historico:v2";
  var CHAVE_PASTAS = "questoes-por-tema:pastas-abertas:v1";
  var LETRAS = ["A", "B", "C", "D", "E", "F"];
  var ROTULO_DIFICULDADE = { facil: "Fácil", medio: "Média", dificil: "Difícil" };
  var SEPARADOR = " › ";

  /* ---------- leitura do banco ---------- */

  var bruto = window.BANCO_QUESTOES;
  var temas = [];
  var pastas = [];

  if (Array.isArray(bruto)) {
    // Formato antigo (sem pastas): lista de temas na raiz.
    temas = bruto.map(function (t, i) {
      return {
        chave: t.arquivo || String(i),
        caminho: [],
        tema: t.tema,
        descricao: t.descricao || "",
        questoes: t.questoes || []
      };
    });
  } else if (bruto && typeof bruto === "object") {
    temas = Array.isArray(bruto.temas) ? bruto.temas : [];
    pastas = Array.isArray(bruto.pastas) ? bruto.pastas : [];
  }

  var estado = {
    questoes: [],      // questões sorteadas para a rodada atual
    indice: 0,
    respostas: [],     // índice marcado pelo usuário, ou null se pulou
    acertos: 0,
    modo: "imediato",
    respondida: false  // a questão atual já foi respondida?
  };

  // Quantidade pedida pelo usuário. Guardada à parte porque o slider é
  // limitado pelo total disponível: se os filtros reduzem e depois voltam a
  // ampliar o banco, a preferência original é restaurada.
  var qtdDesejada = 10;

  function $(id) { return document.getElementById(id); }

  function plural(n) { return n + (n === 1 ? " questão" : " questões"); }

  function mostrarTela(id) {
    ["tela-config", "tela-quiz", "tela-resultado"].forEach(function (t) {
      $(t).hidden = t !== id;
    });
    window.scrollTo(0, 0);
  }

  /* ---------- árvore de pastas ---------- */

  var porChave = {};   // chave do tema -> tema
  var arvore = montarArvore();

  function montarArvore() {
    var raiz = { caminho: [], nome: "", descricao: "", filhos: [], temas: [] };
    var indice = { "": raiz };

    // Pastas rasas primeiro, para o pai já existir quando o filho chegar.
    // O sort é estável, então a ordem definida em _pasta.json é preservada.
    pastas
      .slice()
      .sort(function (a, b) { return a.caminho.length - b.caminho.length; })
      .forEach(function (p) {
        var no = {
          caminho: p.caminho,
          nome: p.nome,
          descricao: p.descricao || "",
          filhos: [],
          temas: []
        };
        indice[p.caminho.join("/")] = no;
        var pai = indice[p.caminho.slice(0, -1).join("/")] || raiz;
        pai.filhos.push(no);
      });

    temas.forEach(function (t) {
      var pai = indice[(t.caminho || []).join("/")] || raiz;
      pai.temas.push(t);
      t.rotuloPasta = (t.caminho || [])
        .map(function (_, i) {
          var no = indice[t.caminho.slice(0, i + 1).join("/")];
          return no ? no.nome : t.caminho[i];
        })
        .join(SEPARADOR);
      t.rotuloCompleto = t.rotuloPasta
        ? t.rotuloPasta + SEPARADOR + t.tema
        : t.tema;
      porChave[t.chave] = t;
    });

    return raiz;
  }

  function contarQuestoes(no) {
    var total = no.temas.reduce(function (soma, t) {
      return soma + t.questoes.length;
    }, 0);
    return no.filhos.reduce(function (soma, f) {
      return soma + contarQuestoes(f);
    }, total);
  }

  /* ---------- utilidades ---------- */

  function embaralhar(lista) {
    var copia = lista.slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copia[i];
      copia[i] = copia[j];
      copia[j] = tmp;
    }
    return copia;
  }

  // Embaralha as alternativas mantendo o rastro de qual é a correta.
  function prepararQuestao(q, tema) {
    var indices = embaralhar(q.alternativas.map(function (_, i) { return i; }));
    return {
      id: q.id,
      tema: tema.tema,
      pasta: tema.rotuloPasta,
      rotulo: tema.rotuloCompleto,
      enunciado: q.enunciado,
      alternativas: indices.map(function (i) { return q.alternativas[i]; }),
      correta: indices.indexOf(q.correta),
      explicacao: q.explicacao,
      dificuldade: q.dificuldade
    };
  }

  function chavesSelecionadas() {
    return Array.prototype.slice
      .call(document.querySelectorAll("input[name=tema]:checked"))
      .map(function (el) { return el.value; });
  }

  function valorRadio(nome) {
    var el = document.querySelector("input[name=" + nome + "]:checked");
    return el ? el.value : null;
  }

  // Todas as questões que atendem aos filtros atuais da tela de configuração.
  function questoesFiltradas() {
    var dificuldade = valorRadio("dificuldade");
    var resultado = [];
    chavesSelecionadas().forEach(function (chave) {
      var tema = porChave[chave];
      if (!tema) return;
      tema.questoes.forEach(function (q) {
        if (dificuldade !== "todas" && q.dificuldade !== dificuldade) return;
        resultado.push({ questao: q, tema: tema });
      });
    });
    return resultado;
  }

  /* ---------- estado aberto/fechado das pastas ---------- */

  function lerJson(chave, padrao) {
    try {
      var texto = localStorage.getItem(chave);
      var dados = texto ? JSON.parse(texto) : padrao;
      return dados && typeof dados === "object" ? dados : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravarJson(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      /* modo privativo ou armazenamento bloqueado: o app segue funcionando */
    }
  }

  function pastaAberta(chave) {
    var abertas = lerJson(CHAVE_PASTAS, {});
    return abertas[chave] !== false;  // aberta por padrão
  }

  function salvarPasta(chave, aberta) {
    var abertas = lerJson(CHAVE_PASTAS, {});
    abertas[chave] = aberta;
    gravarJson(CHAVE_PASTAS, abertas);
  }

  /* ---------- tela de configuração ---------- */

  function criarTema(t) {
    var label = document.createElement("label");
    label.className = "item-tema";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.name = "tema";
    input.value = t.chave;
    input.checked = true;

    var texto = document.createElement("span");
    var nome = document.createElement("span");
    nome.className = "nome-tema";
    nome.textContent = t.tema;
    var info = document.createElement("small");
    info.className = "info-tema";
    info.textContent =
      plural(t.questoes.length) + (t.descricao ? " · " + t.descricao : "");

    texto.appendChild(nome);
    texto.appendChild(info);
    label.appendChild(input);
    label.appendChild(texto);
    return label;
  }

  function criarPasta(no) {
    var chave = no.caminho.join("/");
    var det = document.createElement("details");
    det.className = "pasta";
    det.dataset.caminho = chave;
    det.open = pastaAberta(chave);
    det.addEventListener("toggle", function () { salvarPasta(chave, det.open); });

    var sumario = document.createElement("summary");
    sumario.className = "cabecalho-pasta";

    var marca = document.createElement("input");
    marca.type = "checkbox";
    marca.className = "check-pasta";
    marca.checked = true;
    // Sem isto, clicar na caixa também abriria/fecharia a pasta.
    marca.addEventListener("click", function (e) { e.stopPropagation(); });
    marca.addEventListener("change", function () {
      Array.prototype.forEach.call(
        det.querySelectorAll("input[name=tema]"),
        function (el) { el.checked = marca.checked; }
      );
      atualizarDisponiveis();
    });

    var titulo = document.createElement("span");
    titulo.className = "nome-pasta";
    titulo.textContent = no.nome;

    var contagem = document.createElement("span");
    contagem.className = "contagem-pasta";
    contagem.textContent = plural(contarQuestoes(no));

    sumario.appendChild(marca);
    sumario.appendChild(titulo);
    sumario.appendChild(contagem);
    det.appendChild(sumario);

    if (no.descricao) {
      var desc = document.createElement("p");
      desc.className = "descricao-pasta";
      desc.textContent = no.descricao;
      det.appendChild(desc);
    }

    var corpo = document.createElement("div");
    corpo.className = "conteudo-pasta";
    preencher(no, corpo);
    det.appendChild(corpo);

    return det;
  }

  function preencher(no, container) {
    no.filhos.forEach(function (f) { container.appendChild(criarPasta(f)); });
    no.temas.forEach(function (t) { container.appendChild(criarTema(t)); });
  }

  function montarListaTemas() {
    var container = $("lista-temas");
    container.innerHTML = "";

    if (!temas.length) {
      container.innerHTML =
        '<p class="aviso">Nenhuma questão carregada. Verifique se <code>app/banco.js</code> ' +
        "existe — para gerá-lo, rode <code>python3 gerar_banco.py</code>.</p>";
      $("btn-comecar").disabled = true;
      return;
    }

    preencher(arvore, container);
  }

  // Deixa cada caixa de pasta refletindo os temas que estão dentro dela:
  // marcada, desmarcada, ou traço quando a seleção é parcial.
  function atualizarEstadoPastas() {
    Array.prototype.forEach.call(
      document.querySelectorAll("details.pasta"),
      function (det) {
        var dentro = det.querySelectorAll("input[name=tema]");
        var marcados = det.querySelectorAll("input[name=tema]:checked").length;
        var marca = det.querySelector(".check-pasta");
        if (!marca) return;
        marca.checked = dentro.length > 0 && marcados === dentro.length;
        marca.indeterminate = marcados > 0 && marcados < dentro.length;
      }
    );
  }

  function atualizarDisponiveis() {
    atualizarEstadoPastas();

    var total = questoesFiltradas().length;
    var slider = $("qtd-questoes");
    var aviso = $("aviso-config");

    $("qtd-disponivel").textContent =
      plural(total) + (total === 1 ? " disponível" : " disponíveis") +
      " com os filtros atuais.";

    slider.max = Math.max(1, total);
    slider.value = Math.min(qtdDesejada, Math.max(1, total));
    $("qtd-valor").textContent = slider.value;

    var semQuestoes = total === 0;
    $("btn-comecar").disabled = semQuestoes;
    aviso.hidden = !semQuestoes;
    if (semQuestoes) {
      aviso.textContent = chavesSelecionadas().length
        ? "Nenhuma questão combina com essa dificuldade nos temas escolhidos."
        : "Selecione pelo menos um tema.";
    }
  }

  /* ---------- rodada ---------- */

  function iniciarRodada(questoesPreparadas) {
    estado.questoes = questoesPreparadas;
    estado.indice = 0;
    estado.respostas = new Array(questoesPreparadas.length).fill(null);
    estado.acertos = 0;
    estado.respondida = false;
    mostrarTela("tela-quiz");
    renderizarQuestao();
  }

  function comecar() {
    var disponiveis = questoesFiltradas();
    if (!disponiveis.length) return;

    var quantidade = Math.min(Number($("qtd-questoes").value), disponiveis.length);
    estado.modo = valorRadio("modo");

    var sorteadas = embaralhar(disponiveis)
      .slice(0, quantidade)
      .map(function (item) { return prepararQuestao(item.questao, item.tema); });

    iniciarRodada(sorteadas);
  }

  function renderizarQuestao() {
    var q = estado.questoes[estado.indice];
    var total = estado.questoes.length;

    $("contador").textContent = "Questão " + (estado.indice + 1) + " de " + total;
    $("progresso").style.width = (estado.indice / total) * 100 + "%";
    $("placar-parcial").textContent =
      estado.modo === "imediato" ? estado.acertos + " acerto(s)" : "";

    var etiquetaPasta = $("etiqueta-pasta");
    etiquetaPasta.textContent = q.pasta || "";
    etiquetaPasta.hidden = !q.pasta;

    $("etiqueta-tema").textContent = q.tema;
    var etiquetaDif = $("etiqueta-dificuldade");
    etiquetaDif.textContent = ROTULO_DIFICULDADE[q.dificuldade] || q.dificuldade;
    etiquetaDif.className = "etiqueta " + q.dificuldade;

    $("enunciado").textContent = q.enunciado;

    var container = $("alternativas");
    container.innerHTML = "";
    q.alternativas.forEach(function (texto, i) {
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "alternativa";
      botao.dataset.indice = String(i);

      var letra = document.createElement("span");
      letra.className = "letra";
      letra.textContent = LETRAS[i];
      var conteudo = document.createElement("span");
      conteudo.textContent = texto;

      botao.appendChild(letra);
      botao.appendChild(conteudo);
      botao.addEventListener("click", function () { responder(i); });
      container.appendChild(botao);
    });

    $("feedback").hidden = true;
    estado.respondida = false;
    var proxima = $("btn-proxima");
    proxima.disabled = true;
    proxima.textContent =
      estado.indice === total - 1 ? "Ver resultado" : "Próxima";
  }

  function responder(escolha) {
    if (estado.respondida) return;
    estado.respondida = true;
    estado.respostas[estado.indice] = escolha;

    var q = estado.questoes[estado.indice];
    var acertou = escolha === q.correta;
    if (acertou) estado.acertos++;

    var botoes = $("alternativas").querySelectorAll(".alternativa");
    Array.prototype.forEach.call(botoes, function (botao, i) {
      botao.disabled = true;
      if (estado.modo === "imediato") {
        if (i === q.correta) botao.classList.add("certa");
        else if (i === escolha) botao.classList.add("errada");
      } else if (i === escolha) {
        botao.classList.add("marcada");
      }
    });

    if (estado.modo === "imediato") {
      var feedback = $("feedback");
      feedback.className = "feedback " + (acertou ? "acerto" : "erro");
      feedback.innerHTML = "";

      var titulo = document.createElement("strong");
      titulo.className = "titulo-feedback";
      titulo.textContent = acertou
        ? "Correto!"
        : "Incorreto — a resposta certa é a " + LETRAS[q.correta] + ".";
      feedback.appendChild(titulo);

      if (q.explicacao) {
        var texto = document.createElement("span");
        texto.textContent = q.explicacao;
        feedback.appendChild(texto);
      }
      feedback.hidden = false;
      $("placar-parcial").textContent = estado.acertos + " acerto(s)";
    }

    $("btn-proxima").disabled = false;
    $("btn-proxima").focus();
  }

  function proxima() {
    if (!estado.respondida) return;
    if (estado.indice < estado.questoes.length - 1) {
      estado.indice++;
      renderizarQuestao();
    } else {
      finalizar();
    }
  }

  /* ---------- resultado ---------- */

  function finalizar() {
    var total = estado.questoes.length;
    var percentual = total ? Math.round((estado.acertos / total) * 100) : 0;

    $("nota").textContent = percentual + "%";
    $("resumo").textContent =
      estado.acertos + " de " + total + " questões corretas.";
    $("mensagem").textContent =
      percentual === 100 ? "Gabaritou! 🎉"
        : percentual >= 70 ? "Bom desempenho — siga revisando os erros."
        : percentual >= 50 ? "Deu para o começo. Revise as explicações abaixo."
        : "Vale reler o conteúdo e refazer só os erros.";

    montarRevisao();
    registrarHistorico();
    $("btn-so-erros").hidden = estado.acertos === total;
    mostrarTela("tela-resultado");
  }

  function montarRevisao() {
    var container = $("revisao");
    container.innerHTML = "";

    estado.questoes.forEach(function (q, i) {
      var escolha = estado.respostas[i];
      var acertou = escolha === q.correta;

      var item = document.createElement("div");
      item.className = "item-revisao " + (acertou ? "acerto" : "erro");

      var cabecalho = document.createElement("div");
      cabecalho.className = "cabecalho-revisao";
      cabecalho.textContent =
        (i + 1) + " · " + q.rotulo + " · " +
        (ROTULO_DIFICULDADE[q.dificuldade] || q.dificuldade);
      item.appendChild(cabecalho);

      var pergunta = document.createElement("p");
      pergunta.className = "pergunta";
      pergunta.textContent = q.enunciado;
      item.appendChild(pergunta);

      var sua = document.createElement("p");
      sua.className = "linha sua-resposta" + (acertou ? "" : " errado");
      sua.textContent = escolha === null
        ? "Você não respondeu."
        : "Sua resposta: " + LETRAS[escolha] + ") " + q.alternativas[escolha];
      item.appendChild(sua);

      if (!acertou) {
        var certa = document.createElement("p");
        certa.className = "linha resposta-certa";
        certa.textContent =
          "Resposta correta: " + LETRAS[q.correta] + ") " + q.alternativas[q.correta];
        item.appendChild(certa);
      }

      if (q.explicacao) {
        var explicacao = document.createElement("p");
        explicacao.className = "explicacao";
        explicacao.textContent = q.explicacao;
        item.appendChild(explicacao);
      }

      container.appendChild(item);
    });
  }

  function refazerSoErros() {
    var erradas = estado.questoes.filter(function (q, i) {
      return estado.respostas[i] !== q.correta;
    });
    if (!erradas.length) return;
    iniciarRodada(embaralhar(erradas));
  }

  /* ---------- histórico (localStorage) ---------- */

  function registrarHistorico() {
    var historico = lerJson(CHAVE_HISTORICO, {});
    estado.questoes.forEach(function (q, i) {
      var registro = historico[q.rotulo] || { respondidas: 0, acertos: 0 };
      registro.respondidas++;
      if (estado.respostas[i] === q.correta) registro.acertos++;
      historico[q.rotulo] = registro;
    });
    gravarJson(CHAVE_HISTORICO, historico);
    renderizarDesempenho();
  }

  function renderizarDesempenho() {
    var historico = lerJson(CHAVE_HISTORICO, {});
    var rotulos = Object.keys(historico).sort();
    var cartao = $("cartao-desempenho");

    if (!rotulos.length) {
      cartao.hidden = true;
      return;
    }
    cartao.hidden = false;

    var tabela = document.createElement("table");
    tabela.className = "tabela-desempenho";
    tabela.innerHTML =
      "<thead><tr><th>Tema</th><th class='numero'>Respondidas</th>" +
      "<th class='numero'>Acertos</th><th class='numero'>%</th></tr></thead>";

    var corpo = document.createElement("tbody");
    rotulos.forEach(function (rotulo) {
      var r = historico[rotulo];
      var pct = r.respondidas ? Math.round((r.acertos / r.respondidas) * 100) : 0;
      var linha = document.createElement("tr");
      [rotulo, r.respondidas, r.acertos, pct + "%"].forEach(function (valor, i) {
        var celula = document.createElement("td");
        if (i > 0) celula.className = "numero";
        celula.textContent = valor;
        linha.appendChild(celula);
      });
      corpo.appendChild(linha);
    });
    tabela.appendChild(corpo);

    var destino = $("tabela-desempenho");
    destino.innerHTML = "";
    destino.appendChild(tabela);
  }

  /* ---------- eventos ---------- */

  function marcarTodos(marcado) {
    Array.prototype.forEach.call(
      document.querySelectorAll("input[name=tema]"),
      function (el) { el.checked = marcado; }
    );
    atualizarDisponiveis();
  }

  document.addEventListener("keydown", function (e) {
    if ($("tela-quiz").hidden) return;
    if (e.key === "Enter") {
      if (!$("btn-proxima").disabled) { e.preventDefault(); proxima(); }
      return;
    }
    var n = Number(e.key);
    if (n >= 1 && n <= LETRAS.length && !estado.respondida) {
      var alvo = $("alternativas").children[n - 1];
      if (alvo) { e.preventDefault(); responder(n - 1); }
    }
  });

  function ligarEventos() {
    $("btn-todos").addEventListener("click", function () { marcarTodos(true); });
    $("btn-nenhum").addEventListener("click", function () { marcarTodos(false); });
    $("lista-temas").addEventListener("change", function (e) {
      if (e.target.name === "tema") atualizarDisponiveis();
    });
    $("grupo-dificuldade").addEventListener("change", atualizarDisponiveis);
    $("qtd-questoes").addEventListener("input", function () {
      qtdDesejada = Number(this.value);
      $("qtd-valor").textContent = this.value;
    });
    $("btn-comecar").addEventListener("click", comecar);
    $("btn-proxima").addEventListener("click", proxima);
    $("btn-sair").addEventListener("click", function () {
      if (confirm("Encerrar o simulado e voltar à configuração?")) {
        mostrarTela("tela-config");
      }
    });
    $("btn-refazer").addEventListener("click", function () {
      mostrarTela("tela-config");
      atualizarDisponiveis();
    });
    $("btn-so-erros").addEventListener("click", refazerSoErros);
    $("btn-limpar-historico").addEventListener("click", function () {
      if (!confirm("Apagar todo o histórico de desempenho?")) return;
      try { localStorage.removeItem(CHAVE_HISTORICO); } catch (e) { /* ignora */ }
      renderizarDesempenho();
    });
  }

  montarListaTemas();
  ligarEventos();
  atualizarDisponiveis();
  renderizarDesempenho();
})();
