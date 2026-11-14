// paginas/historico.js — todas as cotações salvas, com filtro

const PaginaHistorico = {
  filtroMundo: "",
  filtroItem: "rc",
  filtroDias: "7",

  render(main) {
    const opcoesMundos = Dados.mundos()
      .map((m) => `<option value="${m.id}" ${m.id === PaginaHistorico.filtroMundo ? "selected" : ""}>${m.nome}</option>`)
      .join("");
    const opcoesItens = Dados.itens()
      .map((i) => `<option value="${i.id}" ${i.id === PaginaHistorico.filtroItem ? "selected" : ""}>${i.nome}</option>`)
      .join("");
    const opcoesDias = [["1", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["", "Tudo"]]
      .map(([v, t]) => `<option value="${v}" ${v === PaginaHistorico.filtroDias ? "selected" : ""}>${t}</option>`)
      .join("");

    main.innerHTML = `
      <div class="cabecalho">
        <h1>Histórico de cotações</h1>
        <select id="h-mundo" style="width:auto"><option value="">Todos os mundos</option>${opcoesMundos}</select>
        <select id="h-item" style="width:auto">${opcoesItens}</select>
        <select id="h-dias" style="width:auto">${opcoesDias}</select>
      </div>
      <div class="caixa">
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Período</th><th>Mundo</th>
              <th class="num">Venda</th><th class="num">Compra</th><th class="num">Spread</th><th></th>
            </tr>
          </thead>
          <tbody id="h-linhas"></tbody>
        </table>
      </div>
    `;

    main.querySelector("#h-mundo").addEventListener("change", (e) => { PaginaHistorico.filtroMundo = e.target.value; PaginaHistorico.render(main); });
    main.querySelector("#h-item").addEventListener("change", (e) => { PaginaHistorico.filtroItem = e.target.value; PaginaHistorico.render(main); });
    main.querySelector("#h-dias").addEventListener("change", (e) => { PaginaHistorico.filtroDias = e.target.value; PaginaHistorico.render(main); });

    PaginaHistorico.desenharLinhas(main);
  },

  desenharLinhas(main) {
    const { filtroMundo, filtroItem, filtroDias } = PaginaHistorico;
    const hoje = Formato.hoje();

    const lista = Dados.cotacoes()
      .filter((c) => c.itemId === filtroItem)
      .filter((c) => !filtroMundo || c.mundoId === filtroMundo)
      .filter((c) => !filtroDias || diasEntre(c.data, hoje) < Number(filtroDias))
      .sort((a, b) => momento(b.data, b.periodo) - momento(a.data, a.periodo) || a.mundoId.localeCompare(b.mundoId));

    const tbody = main.querySelector("#h-linhas");
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="vazio">Nenhuma cotação nesse filtro.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista
      .map((c) => {
        const m = Dados.mundo(c.mundoId);
        const sp = Calculos.spread(c.venda, c.compra);
        return `
          <tr>
            <td>${Formato.data(c.data)}</td>
            <td>${Formato.nomePeriodo[c.periodo]}</td>
            <td>${m ? m.nome : c.mundoId}</td>
            <td class="num">${Formato.numero(c.venda)}</td>
            <td class="num">${Formato.numero(c.compra)}</td>
            <td class="num fraco">${sp === null ? "—" : Formato.percentual(sp).replace("+", "")}</td>
            <td class="num"><button class="pequeno perigo" data-apagar="${c.id}">Apagar</button></td>
          </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-apagar]").forEach((b) =>
      b.addEventListener("click", () => {
        // dois cliques para apagar, sem janela de confirmação
        if (b.dataset.confirmar) {
          Dados.apagarCotacao(b.dataset.apagar);
          App.avisar("Cotação apagada.");
          PaginaHistorico.desenharLinhas(main);
        } else {
          b.dataset.confirmar = "1";
          b.textContent = "Confirmar?";
          setTimeout(() => { delete b.dataset.confirmar; b.textContent = "Apagar"; }, 3000);
        }
      })
    );
  },
};
