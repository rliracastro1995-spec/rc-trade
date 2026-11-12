// paginas/fechamento.js — fechar o caixa do dia, comparar dias, semanas e meses, conferir com o jogo

const PaginaFechamento = {
  visao: "dia", // dia | semana | mes

  render(main) {
    const hoje = Formato.hoje();
    const eventos = Motor.eventos();
    const cache = {};
    const fotoEm = (d) => (cache[d] ||= Motor.avaliar(Motor.calcular(d, eventos), d));
    const E = Motor.calcular(null, eventos);

    // monta os períodos da visão escolhida
    let periodos = [];
    if (PaginaFechamento.visao === "dia") {
      for (let i = 13; i >= 0; i--) {
        const d = Datas.somar(hoje, -i);
        periodos.push({ ini: d, fim: d, rotulo: Formato.data(d).slice(0, 5) });
      }
    } else if (PaginaFechamento.visao === "semana") {
      const seg = Datas.inicioSemana(hoje);
      for (let i = 7; i >= 0; i--) {
        const ini = Datas.somar(seg, -7 * i);
        const fim = Datas.somar(ini, 6);
        periodos.push({ ini, fim: fim > hoje ? hoje : fim, rotulo: Formato.data(ini).slice(0, 5) });
      }
    } else {
      const [a, m] = hoje.split("-").map(Number);
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(a, m - 1 - i, 1);
        const chave = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
        const fim = Datas.ultimoDiaMes(chave);
        periodos.push({ ini: chave + "-01", fim: fim > hoje ? hoje : fim, rotulo: Datas.nomeMes(chave) });
      }
    }

    // não mostra períodos antes do primeiro lançamento
    const inicio = Motor.primeiraData(eventos);
    if (inicio) {
      const depois = periodos.filter((p) => p.fim >= inicio);
      periodos = depois.length ? depois : periodos.slice(-1);
    }

    const dentro = (lista, p) => lista.filter((x) => x.data >= p.ini && x.data <= p.fim);
    const soma = (lista, campo) => lista.reduce((s, x) => s + (x[campo] || 0), 0);
    periodos = periodos.map((p) => {
      const antes = fotoEm(Datas.somar(p.ini, -1));
      const depois = fotoEm(p.fim);
      return {
        ...p,
        patrimonioIni: antes.patrimonioRc,
        patrimonioFim: depois.patrimonioRc,
        variacao: depois.resultadoRc - antes.resultadoRc, // desempenho (sem contar dinheiro colocado/tirado)
        capital: soma(dentro(E.aportes, p), "rc"),
        realizado: soma(dentro(E.realizados, p), "rc"),
        taxasGold: soma(dentro(E.taxas, p), "gold"),
        taxasRc: soma(dentro(E.taxas, p), "rc"),
        operacoes: dentro(E.operacoes, p).filter((o) => o.tipo !== "oferta").length,
        fechado: PaginaFechamento.visao === "dia" && Dados.fechamento(p.ini),
      };
    });
    const atual = periodos[periodos.length - 1];
    const nomeVisao = { dia: "do dia", semana: "da semana", mes: "do mês" }[PaginaFechamento.visao];
    const melhor = periodos.reduce((a, b) => (b.variacao > a.variacao ? b : a), periodos[0]);
    const pior = periodos.reduce((a, b) => (b.variacao < a.variacao ? b : a), periodos[0]);
    const positivos = periodos.filter((p) => p.variacao > 0.5).length;
    const comMovimento = periodos.filter((p) => Math.abs(p.variacao) > 0.5).length;

    main.innerHTML = `
      <div class="cabecalho">
        <h1>Fechamento ${nomeVisao}</h1>
        <div class="grupo" id="fc-visao">
          ${[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([v, t]) =>
            `<button data-v="${v}" class="${v === PaginaFechamento.visao ? "ativo" : ""}">${t}</button>`).join("")}
        </div>
      </div>

      <div class="cartoes">
        ${UI.cartao("Patrimônio inicial", UI.rc(atual.patrimonioIni, 0, false))}
        ${UI.cartao("Patrimônio final", UI.rc(atual.patrimonioFim, 0, false), UI.reais(atual.patrimonioFim))}
        ${UI.cartao("Resultado " + nomeVisao, UI.rc(atual.variacao, 1), atual.capital ? `capital colocado no período: ${UI.rc(atual.capital, 0)}` : "sem contar dinheiro colocado ou tirado", UI.cor(atual.variacao))}
        ${UI.cartao("Lucro realizado", UI.rc(atual.realizado, 1), `${atual.operacoes} execução(ões)`, UI.cor(atual.realizado))}
        ${UI.cartao("Taxas pagas", UI.kk(atual.taxasGold), "≈ " + UI.rc(atual.taxasRc, 0, false), atual.taxasGold ? "sobe" : "")}
      </div>

      <div class="caixa">
        <h2>Resultado por ${PaginaFechamento.visao === "mes" ? "mês" : PaginaFechamento.visao} (RC)</h2>
        ${UI.barras(periodos.map((p) => ({ rotulo: p.rotulo, valor: Math.round(p.variacao) })), { formato: (v) => (v > 0 ? "+" : "") + Formato.numero(v) })}
        <p class="fraco">Positivos: ${positivos} de ${comMovimento} com movimento · melhor: ${melhor.rotulo} (${UI.rc(melhor.variacao)}) · pior: ${pior.rotulo} (${UI.rc(pior.variacao)})</p>
      </div>

      <div class="caixa">
        <h2>Comparativo</h2>
        <table><thead><tr>
          <th>Período</th><th class="num">Patrimônio final</th><th class="num">Resultado</th><th class="num">%</th>
          <th class="num">Realizado</th><th class="num">Taxas</th><th class="num">Execuções</th><th class="num">Capital colocado</th>
          ${PaginaFechamento.visao === "dia" ? "<th>Status</th>" : ""}
        </tr></thead><tbody>${[...periodos].reverse().map((p) => `<tr>
          <td>${PaginaFechamento.visao === "semana" ? `${Formato.data(p.ini).slice(0, 5)} a ${Formato.data(p.fim).slice(0, 5)}` : p.rotulo}</td>
          <td class="num">${Formato.numero(p.patrimonioFim)}</td>
          <td class="num ${UI.cor(p.variacao)}">${UI.rc(p.variacao, 1)}</td>
          <td class="num ${UI.cor(p.variacao)}">${p.patrimonioIni > 0 ? Formato.percentual(p.variacao / p.patrimonioIni) : "—"}</td>
          <td class="num ${UI.cor(p.realizado)}">${UI.rc(p.realizado, 1)}</td>
          <td class="num">${p.taxasGold ? UI.kk(p.taxasGold) : "—"}</td>
          <td class="num">${p.operacoes || "—"}</td>
          <td class="num">${p.capital ? UI.rc(p.capital) : "—"}</td>
          ${PaginaFechamento.visao === "dia" ? `<td>${p.fechado ? '<span class="etiqueta st-concluida">Fechado</span>' : '<span class="fraco">aberto</span>'}</td>` : ""}
        </tr>`).join("")}</tbody></table>
      </div>

      ${PaginaFechamento.visao === "dia" ? `<div class="caixa" id="fc-conferir"></div>` : ""}
    `;

    main.querySelectorAll("#fc-visao button").forEach((b) =>
      b.addEventListener("click", () => { PaginaFechamento.visao = b.dataset.v; PaginaFechamento.render(main); })
    );
    if (PaginaFechamento.visao === "dia") PaginaFechamento.conferir(main.querySelector("#fc-conferir"), main, atual, fotoEm(hoje));
  },

  // Confere o que o app espera com o que você vê no jogo e fecha o dia
  conferir(caixa, main, dia, A) {
    const hoje = Formato.hoje();
    const fechado = Dados.fechamento(hoje);
    const contas = [
      { chave: "rc", nome: "RC livre", app: A.rcLivre, tipo: "ajuste-rc", fmt: (v) => Formato.numero(v) },
      ...A.mundos
        .filter((w) => Math.abs(w.gold) > 0 || (Dados.mundo(w.id) || {}).posicao)
        .map((w) => ({ chave: w.id, nome: "Gold · " + w.nome, app: w.gold, tipo: "ajuste-gold", mundoId: w.id, fmt: UI.kk })),
    ];

    caixa.innerHTML = `
      <h2>Conferir com o jogo · ${Formato.data(hoje)}</h2>
      <p class="fraco">Digite o que aparece no jogo. Se não bater, lance um ajuste com o motivo: nada do passado é editado.</p>
      <table><thead><tr><th>Conta</th><th class="num">O app espera</th><th>No jogo</th><th class="num">Diferença</th><th></th></tr></thead>
      <tbody>${contas.map((c) => `<tr data-conta="${c.chave}">
        <td>${c.nome}</td><td class="num">${c.fmt(c.app)}</td>
        <td><input class="cf-jogo" placeholder="${c.tipo === "ajuste-rc" ? "Ex.: 299" : "Ex.: 56,25kk"}" style="max-width:180px" inputmode="decimal"></td>
        <td class="num cf-dif fraco">—</td>
        <td class="num"><button class="pequeno cf-ajustar" hidden>Lançar ajuste</button></td></tr>`).join("")}</tbody></table>
      <div class="acoes">
        ${fechado ? `<span class="fraco">Dia fechado com patrimônio de ${UI.rc(fechado.patrimonioRc, 0, false)}.</span><button id="fc-reabrir">Reabrir o dia</button>` : ""}
        <button class="principal" id="fc-fechar">${fechado ? "Fechar de novo" : "Fechar o dia"}</button>
      </div>`;

    caixa.querySelectorAll("tr[data-conta]").forEach((tr) => {
      const c = contas.find((x) => x.chave === tr.dataset.conta);
      const input = tr.querySelector(".cf-jogo");
      const tdDif = tr.querySelector(".cf-dif");
      const botao = tr.querySelector(".cf-ajustar");
      let diferenca = 0;
      input.addEventListener("input", () => {
        const v = Formato.lerGold(input.value);
        if (v === null || Number.isNaN(v)) { tdDif.textContent = "—"; tdDif.className = "num cf-dif fraco"; botao.hidden = true; return; }
        diferenca = v - c.app;
        const bate = Math.abs(diferenca) < (c.tipo === "ajuste-rc" ? 0.5 : 1);
        tdDif.innerHTML = bate ? '<span class="etiqueta st-concluida">Bate</span>' : (diferenca > 0 ? "+" : "−") + c.fmt(Math.abs(diferenca));
        tdDif.className = "num cf-dif " + (bate ? "" : "prejuizo");
        botao.hidden = bate;
      });
      botao.addEventListener("click", () => {
        Dados.criarMovimento({
          tipo: c.tipo, mundoId: c.mundoId, qtd: Math.round(diferenca), data: hoje, periodo: "noite",
          nota: "Conferência com o jogo",
        });
        App.avisar("Ajuste lançado.");
        PaginaFechamento.render(main);
      });
    });

    caixa.querySelector("#fc-fechar").addEventListener("click", () => {
      Dados.fecharDia({
        data: hoje, patrimonioRc: A.patrimonioRc, rcLivre: A.rcLivre, rcOfertas: A.rcOfertas,
        resultadoDiaRc: dia.variacao, realizadoDiaRc: dia.realizado, taxasDiaGold: dia.taxasGold,
      });
      App.avisar("Dia fechado.");
      PaginaFechamento.render(main);
    });
    const reabrir = caixa.querySelector("#fc-reabrir");
    if (reabrir) reabrir.addEventListener("click", () => { Dados.reabrirDia(hoje); PaginaFechamento.render(main); });
  },
};
