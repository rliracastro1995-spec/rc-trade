// paginas/mundos.js — ligar/desligar mundos, marcar posição aberta e cadastrar itens

const PaginaMundos = {
  render(main) {
    main.innerHTML = `
      <div class="cabecalho"><h1>Configurações</h1></div>

      <div class="caixa">
        <h2>Parâmetros</h2>
        <div class="form">
          <label>Taxa do market (%)<input id="cf-taxa" value="${Formato.numero(Dados.config().taxa * 100, 1)}" inputmode="decimal"></label>
          <label>Valor de 1 RC em reais (R$)<input id="cf-reais" value="${Formato.numero(Dados.config().rcEmReais, 2)}" inputmode="decimal"></label>
          <label>Reserva mínima em RC livre (%)<input id="cf-reserva" value="${Formato.numero(Dados.config().reservaMinima * 100)}" inputmode="decimal"></label>
          <label>Lucro mínimo para recomprar (%)<input id="cf-lucro" value="${Formato.numero(Dados.config().lucroMinimo * 100, 1)}" inputmode="decimal"></label>
          <label>Cotação velha depois de (horas)<input id="cf-horas" value="${Dados.config().horasCotacaoVelha}" inputmode="decimal"></label>
        </div>
        <div class="acoes"><button class="principal" id="cf-salvar">Salvar parâmetros</button></div>
      </div>

      <div class="caixa">
        <h2>Mundos</h2>
        <p class="fraco" style="margin-top:0">
          <b>Ativo</b> = aparece na ronda de cotação. <b>Posição aberta</b> = você tem oferta ou gold lá; esses mundos vêm primeiro.
        </p>
        <table>
          <thead><tr><th>Mundo</th><th>Ativo</th><th>Posição aberta</th></tr></thead>
          <tbody>
            ${Dados.mundos().map((m) => `
              <tr>
                <td><b>${m.nome}</b></td>
                <td><input type="checkbox" data-id="${m.id}" data-campo="ativo" ${m.ativo ? "checked" : ""} style="width:auto"></td>
                <td><input type="checkbox" data-id="${m.id}" data-campo="posicao" ${m.posicao ? "checked" : ""} style="width:auto"></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="caixa">
        <h2>Itens que você cota</h2>
        <table>
          <tbody>
            ${Dados.itens().map((i) => `<tr><td>${i.nome}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="acoes" style="justify-content:flex-start">
          <input id="novo-item" placeholder="Ex.: Greater gem" style="max-width:280px">
          <button id="adicionar-item">Adicionar item</button>
        </div>
      </div>
    `;

    main.querySelectorAll('input[type="checkbox"]').forEach((cb) =>
      cb.addEventListener("change", () => {
        Dados.alterarMundo(cb.dataset.id, { [cb.dataset.campo]: cb.checked });
        App.avisar("Salvo.");
      })
    );

    const num = (id) => Number(main.querySelector(id).value.replace(/\./g, "").replace(",", "."));
    main.querySelector("#cf-salvar").addEventListener("click", () => {
      const c = {
        taxa: num("#cf-taxa") / 100, rcEmReais: num("#cf-reais"), reservaMinima: num("#cf-reserva") / 100,
        lucroMinimo: num("#cf-lucro") / 100, horasCotacaoVelha: num("#cf-horas"),
      };
      if (Object.values(c).some((v) => Number.isNaN(v) || v < 0)) return App.avisar("Algum valor não é um número.", true);
      Dados.salvarConfig(c);
      App.avisar("Parâmetros salvos. A taxa nova vale para as próximas ofertas.");
    });

    const adicionar = () => {
      const campo = main.querySelector("#novo-item");
      const nome = campo.value.trim();
      if (!nome) return;
      if (Dados.itens().some((i) => i.nome.toLowerCase() === nome.toLowerCase())) {
        App.avisar("Esse item já existe.", true);
        return;
      }
      Dados.adicionarItem(nome);
      App.avisar(`Item "${nome}" adicionado.`);
      PaginaMundos.render(main);
    };
    main.querySelector("#adicionar-item").addEventListener("click", adicionar);
    main.querySelector("#novo-item").addEventListener("keydown", (e) => { if (e.key === "Enter") adicionar(); });
  },
};
