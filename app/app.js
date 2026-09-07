/* Questões por Tema — lógica do simulado.
   O banco vem de window.BANCO_QUESTOES, gerado por gerar_banco.py. */
(function () {
  "use strict";

  var CHAVE_HISTORICO = "questoes-por-tema:historico:v1";
  var LETRAS = ["A", "B", "C", "D", "E", "F"];
  var ROTULO_DIFICULDADE = { facil: "Fácil", medio: "Média", dificil: "Difícil" };

  var banco = Array.isArray(window.BANCO_QUESTOES) ? window.BANCO_QUESTOES : [];

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

  function mostrarTela(id) {
    ["tela-config", "tela-quiz", "tela-resultado"].forEach(function (t) {
      $(t).hidden = t !== id;
    });
    window.scrollTo(0, 0);
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
      tema: tema,
      enunciado: q.enunciado,
      alternativas: indices.map(function (i) { return q.alternativas[i]; }),
      correta: indices.indexOf(q.correta),
      explicacao: q.explicacao,
      dificuldade: q.dificuldade
    };
  }

  function temasSelecionados() {
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
    var temas = temasSelecionados();
    var dificuldade = valorRadio("dificuldade");
    var resultado = [];
    banco.forEach(function (t) {
      if (temas.indexOf(t.tema) === -1) return;
      t.questoes.forEach(function (q) {
        if (dificuldade !== "todas" && q.dificuldade !== dificuldade) return;
        resultado.push({ questao: q, tema: t.tema });
      });
    });
    return resultado;
  }

  /* ---------- tela de configuração ---------- */

  function montarListaTemas() {
    var container = $("lista-temas");
    container.innerHTML = "";

    if (!banco.length) {
      container.innerHTML =
        '<p class="aviso">Nenhuma questão carregada. Verifique se <code>app/banco.js</code> ' +
        "existe — para gerá-lo, rode <code>python3 gerar_banco.py</code>.</p>";
      $("btn-comecar").disabled = true;
      return;
    }

    banco.forEach(function (t) {
      var label = document.createElement("label");
      label.className = "item-tema";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "tema";
      input.value = t.tema;
      input.checked = true;

      var texto = document.createElement("span");
      var nome = document.createElement("span");
      nome.className = "nome-tema";
      nome.textContent = t.tema;
      var info = document.createElement("small");
      info.className = "info-tema";
      info.textContent =
        t.questoes.length + " questões" + (t.descricao ? " · " + t.descricao : "");

      texto.appendChild(nome);
      texto.appendChild(info);
      label.appendChild(input);
      label.appendChild(texto);
      container.appendChild(label);
    });
  }

  function atualizarDisponiveis() {
    var total = questoesFiltradas().length;
    var slider = $("qtd-questoes");
    var aviso = $("aviso-config");

    $("qtd-disponivel").textContent =
      total + (total === 1 ? " questão disponível" : " questões disponíveis") +
      " com os filtros atuais.";

    slider.max = Math.max(1, total);
    slider.value = Math.min(qtdDesejada, Math.max(1, total));
    $("qtd-valor").textContent = slider.value;

    var semQuestoes = total === 0;
    $("btn-comecar").disabled = semQuestoes;
    aviso.hidden = !semQuestoes;
    if (semQuestoes) {
      aviso.textContent = temasSelecionados().length
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
        (i + 1) + " · " + q.tema + " · " +
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

  function lerHistorico() {
    try {
      var bruto = localStorage.getItem(CHAVE_HISTORICO);
      var dados = bruto ? JSON.parse(bruto) : {};
      return dados && typeof dados === "object" ? dados : {};
    } catch (e) {
      return {};
    }
  }

  function registrarHistorico() {
    var historico = lerHistorico();
    estado.questoes.forEach(function (q, i) {
      var registro = historico[q.tema] || { respondidas: 0, acertos: 0 };
      registro.respondidas++;
      if (estado.respostas[i] === q.correta) registro.acertos++;
      historico[q.tema] = registro;
    });
    try {
      localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    } catch (e) {
      /* modo privativo ou armazenamento bloqueado: o simulado segue funcionando */
    }
    renderizarDesempenho();
  }

  function renderizarDesempenho() {
    var historico = lerHistorico();
    var temas = Object.keys(historico).sort();
    var cartao = $("cartao-desempenho");

    if (!temas.length) {
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
    temas.forEach(function (tema) {
      var r = historico[tema];
      var pct = r.respondidas ? Math.round((r.acertos / r.respondidas) * 100) : 0;
      var linha = document.createElement("tr");
      [tema, r.respondidas, r.acertos, pct + "%"].forEach(function (valor, i) {
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
    $("lista-temas").addEventListener("change", atualizarDisponiveis);
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
