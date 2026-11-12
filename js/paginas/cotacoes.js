// paginas/cotacoes.js — Ronda de cotação (manhã, tarde, noite)

const PaginaCotacoes = {
  // o que está escolhido no topo da tela
  data: null,
  periodo: null,
  itemId: "rc",

  render(main) {
    if (!PaginaCotacoes.data) PaginaCotacoes.data = Formato.hoje();
    if (!PaginaCotacoes.periodo) PaginaCotacoes.periodo = Formato.periodoAgora();
    const { data, periodo, itemId } = PaginaCotacoes;

    const opcoesItens = Dados.itens()
      .map((i) => `<option value="${i.id}" ${i.id === itemId ? "selected" : ""}>${i.nome}</option>`)
      .join("");

    const botoesPeriodo = ["manha", "tarde", "noite"]
      .map((p) => `<button data-periodo="${p}" class="${p === periodo ? "ativo" : ""}">${Formato.nomePeriodo[p]}</button>`)
      .join("");

    main.innerHTML = `
      <div class="cabecalho">
        <h1>Ronda de cotação</h1>
        <input type="date" id="ronda-data" value="${data}" style="width:auto">
        <div class="grupo" id="ronda-periodo">${botoesPeriodo}</div>
        <select id="ronda-item" style="width:auto">${opcoesItens}</select>
      </div>

      <div class="dica">
        Mundos com posição aberta aparecem primeiro. Digite <b>74k</b>, <b>57,5k</b> ou <b>1,5kk</b>.
        Enter pula para o próximo campo. Campo em branco = não muda nada.
      </div>

      <div class="caixa">
        <table>
          <thead>
            <tr>
              <th>Mundo</th>
              <th>Melhor oferta de venda</th>
              <th>Melhor oferta de compra</th>
              <th class="num">vs. última</th>
              <th class="num">vs. média 7 dias</th>
              <th class="num">Spread</th>
              <th class="num">Idade</th>
            </tr>
          </thead>
          <tbody id="ronda-linhas"></tbody>
        </table>
      </div>

      <div class="acoes">
        <span class="fraco" id="ronda-contagem"></span>
        <button class="principal" id="ronda-salvar">Salvar ronda</button>
      </div>
    `;

    PaginaCotacoes.desenharLinhas();

    // eventos do topo
    main.querySelector("#ronda-data").addEventListener("change", (e) => {
      PaginaCotacoes.data = e.target.value || Formato.hoje();
      PaginaCotacoes.render(main);
    });
    main.querySelectorAll("#ronda-periodo button").forEach((b) =>
      b.addEventListener("click", () => {
        PaginaCotacoes.periodo = b.dataset.periodo;
        PaginaCotacoes.render(main);
      })
    );
    main.querySelector("#ronda-item").addEventListener("change", (e) => {
      PaginaCotacoes.itemId = e.target.value;
      PaginaCotacoes.render(main);
    });
    main.querySelector("#ronda-salvar").addEventListener("click", PaginaCotacoes.salvar);
  },

  desenharLinhas() {
    const { data, periodo, itemId } = PaginaCotacoes;
    const tbody = document.getElementById("ronda-linhas");

    tbody.innerHTML = Dados.mundosParaRonda()
      .map((m) => {
        // se já existe cotação deste dia/período, mostra para poder corrigir
        const desta = Dados.cotacoes().find(
          (c) => c.data === data && c.periodo === periodo && c.mundoId === m.id && c.itemId === itemId
        );
        const vendaAnterior = Calculos.ultimoValor(m.id, itemId, "venda", data, periodo);
        const compraAnterior = Calculos.ultimoValor(m.id, itemId, "compra", data, periodo);
        const dicaVenda = vendaAnterior !== null ? `${Formato.numero(vendaAnterior)} (última)` : "";
        const dicaCompra = compraAnterior !== null ? `${Formato.numero(compraAnterior)} (última)` : "";

        return `
          <tr data-mundo="${m.id}">
            <td><b>${m.nome}</b>${m.posicao ? '<span class="etiqueta">posição</span>' : ""}</td>
            <td><input class="campo" data-campo="venda" placeholder="${dicaVenda}"
                 value="${desta && desta.venda !== null ? Formato.numero(desta.venda) : ""}"></td>
            <td><input class="campo" data-campo="compra" placeholder="${dicaCompra}"
                 value="${desta && desta.compra !== null ? Formato.numero(desta.compra) : ""}"></td>
            <td class="num" data-col="vs-ultima">—</td>
            <td class="num" data-col="vs-media">—</td>
            <td class="num" data-col="spread">—</td>
            <td class="num" data-col="idade">—</td>
          </tr>`;
      })
      .join("");

    const campos = [...tbody.querySelectorAll("input.campo")];
    campos.forEach((input, i) => {
      input.addEventListener("input", () => PaginaCotacoes.atualizarLinha(input.closest("tr")));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (campos[i + 1]) campos[i + 1].focus();
          else document.getElementById("ronda-salvar").focus();
        }
      });
    });

    tbody.querySelectorAll("tr").forEach(PaginaCotacoes.atualizarLinha);
    if (campos[0]) campos[0].focus();
  },

  // Recalcula as colunas de comparação de uma linha enquanto a pessoa digita
  atualizarLinha(tr) {
    const { data, periodo, itemId } = PaginaCotacoes;
    const mundoId = tr.dataset.mundo;
    const inVenda = tr.querySelector('[data-campo="venda"]');
    const inCompra = tr.querySelector('[data-campo="compra"]');
    const venda = Formato.lerGold(inVenda.value);
    const compra = Formato.lerGold(inCompra.value);

    inVenda.classList.toggle("invalido", Number.isNaN(venda));
    inCompra.classList.toggle("invalido", Number.isNaN(compra));

    const vendaAnterior = Calculos.ultimoValor(mundoId, itemId, "venda", data, periodo);
    const media = Calculos.media7Dias(mundoId, itemId, data);
    const vendaOk = Number.isNaN(venda) ? null : venda;
    const compraOk = Number.isNaN(compra) ? null : compra;

    const pinta = (td, valor, texto) => {
      td.textContent = texto;
      td.className = "num " + (valor > 0 ? "sobe" : valor < 0 ? "desce" : "fraco");
    };

    const vsUltima = Calculos.variacao(vendaOk, vendaAnterior);
    pinta(tr.querySelector('[data-col="vs-ultima"]'), vsUltima, Formato.percentual(vsUltima));

    const vsMedia = Calculos.variacao(vendaOk, media);
    pinta(tr.querySelector('[data-col="vs-media"]'), vsMedia, Formato.percentual(vsMedia));

    const tdSpread = tr.querySelector('[data-col="spread"]');
    const sp = Calculos.spread(vendaOk, compraOk);
    tdSpread.textContent = sp === null ? "—" : Formato.percentual(sp).replace("+", "");
    tdSpread.className = "num fraco";

    // Idade = há quanto tempo foi a última cotação salva deste mundo
    const tdIdade = tr.querySelector('[data-col="idade"]');
    const ultima = Calculos.ultima(mundoId, itemId);
    tdIdade.textContent = Formato.idade(ultima ? ultima.criadoEm : null);
    const horas = ultima ? (Date.now() - ultima.criadoEm) / 3600000 : 0;
    tdIdade.className = "num " + (horas >= 24 ? "muito-velho" : horas >= 8 ? "velho" : "fraco");

    PaginaCotacoes.contar();
  },

  contar() {
    const linhas = [...document.querySelectorAll("#ronda-linhas tr")];
    const preenchidas = linhas.filter((tr) =>
      [...tr.querySelectorAll("input.campo")].some((i) => i.value.trim() !== "")
    ).length;
    const el = document.getElementById("ronda-contagem");
    if (el) el.textContent = `${preenchidas} de ${linhas.length} preenchidos`;
  },

  salvar() {
    const { data, periodo, itemId } = PaginaCotacoes;
    const linhas = [];
    let erro = false;

    document.querySelectorAll("#ronda-linhas tr").forEach((tr) => {
      const venda = Formato.lerGold(tr.querySelector('[data-campo="venda"]').value);
      const compra = Formato.lerGold(tr.querySelector('[data-campo="compra"]').value);
      if (Number.isNaN(venda) || Number.isNaN(compra)) erro = true;
      linhas.push({ mundoId: tr.dataset.mundo, venda, compra });
    });

    if (erro) {
      App.avisar("Tem campo que não entendi (em vermelho). Use 74k, 57,5k ou 1,5kk.", true);
      return;
    }

    const quantas = Dados.salvarRonda(data, periodo, itemId, linhas);
    if (quantas === 0) {
      App.avisar("Nada para salvar: preencha pelo menos um mundo.", true);
      return;
    }
    App.avisar(`Ronda salva: ${quantas} mundo(s) · ${Formato.data(data)} · ${Formato.nomePeriodo[periodo]}`);
    PaginaCotacoes.desenharLinhas();
  },
};
