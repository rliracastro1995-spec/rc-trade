// paginas/carteira.js — tudo o que você tem, quanto custou e quanto vale; lançamentos de saldo, ajustes e itens

const TIPOS_MOVIMENTO = {
  "rc-entrada": { nome: "Entrada de RC (saldo inicial ou compra no site)", mundo: false, sinal: false },
  "rc-saida": { nome: "Saída de RC (usou ou tirou do trade)", mundo: false, sinal: false },
  "gold-entrada": { nome: "Entrada de gold (gold que você já tinha no mundo)", mundo: true, sinal: false },
  "gold-saida": { nome: "Saída de gold (gastou fora do trade)", mundo: true, sinal: false },
  "ajuste-rc": { nome: "Ajuste de RC (diferença com o jogo)", mundo: false, sinal: true },
  "ajuste-gold": { nome: "Ajuste de gold (diferença com o jogo)", mundo: true, sinal: true },
};

// "-250k" → -250000 · "1,5kk" → 1500000
function lerComSinal(texto) {
  const t = String(texto || "").trim();
  const negativo = /^[-−]/.test(t);
  const v = Formato.lerGold(t.replace(/^[-−+]/, ""));
  return v === null || Number.isNaN(v) ? v : negativo ? -v : v;
}

const PaginaCarteira = {
  render(main) {
    const { E, A } = Motor.agora();
    const cfg = Dados.config();
    const reservaCls = A.reserva === null ? "" : A.reserva < cfg.reservaMinima ? "prejuizo" : "lucro";

    main.innerHTML = `
      <div class="cabecalho"><h1>Carteira</h1><span class="fraco">valores em RC pela última cotação de cada mundo</span></div>
      ${E.alertas.length ? `<div class="nota-erro">${E.alertas.slice(-3).map(Formato.esc).join("<br>")}</div>` : ""}
      ${A.semCotacao.length ? `<div class="nota-alerta">Sem cotação de RC em: ${A.semCotacao.map(Dados.nomeMundo).join(", ")}. O gold desses mundos está valendo o custo até você cotar.</div>` : ""}

      <div class="cartoes">
        ${UI.cartao("Patrimônio", UI.rc(A.patrimonioRc, 0, false), UI.reais(A.patrimonioRc))}
        ${UI.cartao("RC livre", UI.rc(A.rcLivre, 0, false), `reserva ${Formato.percentual(A.reserva).replace("+", "")} · mínimo ${Formato.numero(cfg.reservaMinima * 100)}%`, reservaCls)}
        ${UI.cartao("RC em ofertas de venda", UI.rc(A.rcOfertas, 0, false))}
        ${UI.cartao("Gold de todos os mundos", UI.rc(A.valorMundosRc, 0, false), "convertido pela cotação")}
        ${UI.cartao("Itens em estoque", UI.rc(A.valorItensRc, 0, false))}
      </div>
      <div class="cartoes">
        ${UI.cartao("Capital colocado", UI.rc(A.capitalRc, 0, false), "saldo inicial + RC comprado − retiradas")}
        ${UI.cartao("Resultado total", UI.rc(A.resultadoRc), UI.reais(A.resultadoRc), UI.cor(A.resultadoRc))}
        ${UI.cartao("Lucro realizado", UI.rc(A.realizadoRc, 1), "ciclos fechados (recompras e itens vendidos)", UI.cor(A.realizadoRc))}
        ${UI.cartao("Não realizado", UI.rc(A.abertoRc, 1), "se fechasse tudo hoje (inclui taxas e ajustes)", UI.cor(A.abertoRc))}
        ${UI.cartao("Taxas pagas", UI.kk(A.taxasGold), "≈ " + UI.rc(A.taxasRc, 0, false), "sobe")}
      </div>

      <div class="caixa">
        <h2>Por mundo</h2>
        ${A.mundos.length ? `<table><thead><tr>
            <th>Mundo</th><th class="num">Gold livre</th><th class="num">Gold em ofertas</th><th class="num">Custo em RC</th>
            <th class="num">Preço base</th><th class="num">Cotação</th><th class="num">Vale hoje</th><th class="num">Em aberto</th><th class="num">Recomprar agora</th>
          </tr></thead><tbody>${A.mundos.map((w) => `<tr>
            <td><b>${w.nome}</b></td>
            <td class="num ${w.gold < 0 ? "prejuizo" : ""}">${UI.kk(w.gold)}</td>
            <td class="num">${w.goldOfertas ? UI.kk(w.goldOfertas) : "—"}</td>
            <td class="num">${Formato.numero(w.custoRc, 1)}</td>
            <td class="num">${w.precoBase ? Formato.numero(Math.round(w.precoBase)) : "—"}</td>
            <td class="num">${Formato.numero(w.cotacao)}</td>
            <td class="num">${UI.rc(w.valorRc, 1, false)}</td>
            <td class="num ${UI.cor(w.abertoRc)}">${UI.rc(w.abertoRc, 1)}</td>
            <td class="num ${UI.cor(w.lucroRecompraAgora)}">${Formato.percentual(w.lucroRecompraAgora)}</td>
          </tr>`).join("")}</tbody></table>
          <p class="fraco">Preço base = gold ÷ custo em RC. Se a cotação estiver abaixo dele, recomprar RC dá lucro.</p>`
        : `<div class="vazio">Nenhum gold lançado ainda. Use "Lançar movimento" abaixo para colocar seu saldo.</div>`}
      </div>

      <div class="caixa">
        <h2>Itens</h2>
        ${A.itens.length ? `<table><thead><tr>
            <th>Item</th><th>Mundo</th><th class="num">Estoque</th><th class="num">Custo médio</th><th class="num">Pago</th>
            <th class="num">Recebido</th><th class="num">Lucro realizado</th><th class="num">ROI</th><th class="num">Vale hoje</th>
          </tr></thead><tbody>${A.itens.map((it) => `<tr>
            <td><b>${Formato.esc(it.nome)}</b></td><td>${it.mundo}</td>
            <td class="num">${Formato.numero(it.qtd)}</td>
            <td class="num">${it.custoMedio ? UI.kk(it.custoMedio) : "—"}</td>
            <td class="num">${UI.kk(it.pagoGold)}</td>
            <td class="num">${UI.kk(it.recebidoGold)}</td>
            <td class="num ${UI.cor(it.lucroGold)}">${UI.kk(it.lucroGold)} <span class="fraco">(${UI.rc(it.lucroRc, 1)})</span></td>
            <td class="num ${UI.cor(it.roi)}">${Formato.percentual(it.roi)}</td>
            <td class="num">${it.qtd > 0 ? UI.kk(it.valorGold) + (it.precoItem ? "" : ' <span class="fraco">(custo)</span>') : "—"}</td>
          </tr>`).join("")}</tbody></table>
          <p class="fraco">"Vale hoje" usa a última cotação do item (cote o item em Cotações) ou, se não tiver, o que você pagou.</p>`
        : `<div class="vazio">Nenhum item lançado.</div>`}
      </div>

      <div class="duas-colunas">
        <div class="caixa" id="cx-mov"></div>
        <div class="caixa" id="cx-item"></div>
      </div>

      <div class="caixa">
        <h2>Lançamentos</h2>
        <div id="cx-historico"></div>
      </div>`;

    PaginaCarteira.formMovimento(main.querySelector("#cx-mov"), main);
    PaginaCarteira.formItem(main.querySelector("#cx-item"), main);
    PaginaCarteira.historico(main.querySelector("#cx-historico"), main);
  },

  formMovimento(caixa, main) {
    caixa.innerHTML = `
      <h2>Lançar movimento</h2>
      <div class="form">
        <label class="inteiro">Tipo<select id="mv-tipo">${Object.entries(TIPOS_MOVIMENTO)
          .map(([v, t]) => `<option value="${v}">${t.nome}</option>`).join("")}</select></label>
        <label id="mv-mundo-l">Mundo<select id="mv-mundo">${UI.opcoesMundos(null, true)}</select></label>
        <label>Quantidade<input id="mv-qtd" placeholder="Ex.: 3.299 ou 56,25kk" inputmode="decimal"></label>
        <label id="mv-rc-l">Vale quantos RC<input id="mv-rc" placeholder="calculado pela cotação"></label>
        <label id="mv-reais-l">Pagou em R$ (opcional)<input id="mv-reais" placeholder="Ex.: 100" inputmode="decimal"></label>
        <label>Quando<div class="lado">${UI.dataPeriodo("mv")}</div></label>
        <label class="inteiro">Nota<input id="mv-nota" placeholder="Ex.: saldo inicial / taxa esquecida"></label>
      </div>
      <p class="fraco" id="mv-ajuda"></p>
      <div class="acoes"><button class="principal" id="mv-salvar">Lançar</button></div>`;

    const $ = (s) => caixa.querySelector(s);
    const ajuda = {
      "rc-entrada": "Use para o RC que você já tem hoje e para cada compra de RC no site. Conta como capital colocado.",
      "rc-saida": "RC que saiu do trade (usou na loja, transferiu). Reduz o capital.",
      "gold-entrada": "Gold que você já tinha no mundo antes de usar o app. O valor em RC vira o custo desse gold.",
      "gold-saida": "Gold gasto fora do trade (comprou algo para usar). Reduz o capital.",
      "ajuste-rc": "Diferença entre o app e o jogo. Use número negativo para tirar (ex.: -5).",
      "ajuste-gold": "Diferença entre o app e o jogo no gold do mundo. Use negativo para tirar (ex.: -250k).",
    };
    const atualizar = () => {
      const tipo = $("#mv-tipo").value;
      $("#mv-mundo-l").hidden = !TIPOS_MOVIMENTO[tipo].mundo;
      $("#mv-rc-l").hidden = tipo !== "gold-entrada";
      $("#mv-reais-l").hidden = tipo !== "rc-entrada";
      $("#mv-ajuda").textContent = ajuda[tipo];
      if (tipo === "gold-entrada") {
        const q = Formato.lerGold($("#mv-qtd").value);
        const cot = Calculos.cotacaoAte($("#mv-mundo").value, "rc");
        $("#mv-rc").placeholder = cot ? (q > 0 ? Formato.numero(q / cot, 1) + " (cotação " + Formato.numero(cot) + ")" : "pela cotação " + Formato.numero(cot)) : "sem cotação: digite o valor";
      }
    };
    ["#mv-tipo", "#mv-mundo", "#mv-qtd"].forEach((s) => $(s).addEventListener("input", atualizar));
    atualizar();

    $("#mv-salvar").addEventListener("click", () => {
      const tipo = $("#mv-tipo").value;
      const qtd = TIPOS_MOVIMENTO[tipo].sinal ? lerComSinal($("#mv-qtd").value) : Formato.lerGold($("#mv-qtd").value);
      if (!qtd || Number.isNaN(qtd) || (!TIPOS_MOVIMENTO[tipo].sinal && qtd < 0)) {
        App.avisar("Quantidade inválida.", true);
        return;
      }
      const mov = { tipo, qtd, ...UI.lerDataPeriodo(caixa, "mv"), nota: $("#mv-nota").value.trim() };
      if (TIPOS_MOVIMENTO[tipo].mundo) mov.mundoId = $("#mv-mundo").value;
      if (tipo === "gold-entrada") {
        const digitado = Number(String($("#mv-rc").value).replace(/\./g, "").replace(",", "."));
        const cot = Calculos.cotacaoAte(mov.mundoId, "rc", mov.data);
        mov.valorRc = digitado > 0 ? digitado : cot ? qtd / cot : 0;
        if (!mov.valorRc) {
          App.avisar("Sem cotação nesse mundo: digite quantos RC esse gold vale.", true);
          return;
        }
      }
      if (tipo === "rc-entrada") {
        const r = Number(String($("#mv-reais").value).replace(/\./g, "").replace(",", "."));
        if (r > 0) mov.valorReais = r;
      }
      Dados.criarMovimento(mov);
      App.avisar("Movimento lançado.");
      PaginaCarteira.render(main);
    });
  },

  formItem(caixa, main) {
    caixa.innerHTML = `
      <h2>Lançar item (pago e retorno em kk)</h2>
      <div class="form">
        <label>Mundo<select id="it-mundo">${UI.opcoesMundos(null, true)}</select></label>
        <label>Item<select id="it-item"><option value="">Escolha…</option>${UI.opcoesItens(null, true)}<option value="+novo">+ Novo item…</option></select></label>
        <label class="inteiro" id="it-novo-l" hidden>Nome do novo item<input id="it-novo" placeholder="Ex.: Greater gem"></label>
        <label class="inteiro">Tipo
          <div class="grupo largo" id="it-tipo">
            <button data-v="compra" class="ativo">Comprei</button><button data-v="venda">Vendi</button><button data-v="consumo">Usei no jogo</button>
          </div>
        </label>
        <label>Quantidade<input id="it-qtd" placeholder="Ex.: 3" inputmode="decimal"></label>
        <label id="it-preco-l">Preço por unidade (gold)<input id="it-preco" placeholder="Ex.: 6kk" inputmode="decimal"></label>
        <label id="it-taxa-l">Teve taxa?
          <div class="grupo largo" id="it-taxa"><button data-v="nao" class="ativo">Não · aceitei</button><button data-v="sim">Sim · criei</button></div>
        </label>
        <label>Quando<div class="lado">${UI.dataPeriodo("it")}</div></label>
        <label class="inteiro">Nota<input id="it-nota" placeholder="Opcional"></label>
      </div>
      <p class="fraco" id="it-previa"></p>
      <div class="acoes"><button class="principal" id="it-salvar">Lançar item</button></div>`;

    const $ = (s) => caixa.querySelector(s);
    const st = { tipo: "compra", teveTaxa: false };
    const grupo = (id, chave, conv) => caixa.querySelectorAll(`#${id} button`).forEach((b) =>
      b.addEventListener("click", () => {
        caixa.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("ativo", x === b));
        st[chave] = conv(b.dataset.v);
        atualizar();
      }));
    grupo("it-tipo", "tipo", (v) => v);
    grupo("it-taxa", "teveTaxa", (v) => v === "sim");

    const atualizar = () => {
      $("#it-novo-l").hidden = $("#it-item").value !== "+novo";
      $("#it-preco-l").hidden = st.tipo === "consumo";
      $("#it-taxa-l").hidden = st.tipo === "consumo";
      const q = Formato.lerGold($("#it-qtd").value), p = Formato.lerGold($("#it-preco").value);
      if (st.tipo !== "consumo" && q > 0 && p > 0) {
        const taxa = st.teveTaxa ? q * p * Dados.config().taxa : 0;
        const total = st.tipo === "compra" ? q * p + taxa : q * p - taxa;
        $("#it-previa").textContent = `${st.tipo === "compra" ? "Total pago" : "Total recebido"}: ${UI.kk(total)}${taxa ? " (taxa " + UI.kk(taxa) + ")" : ""}`;
      } else $("#it-previa").textContent = st.tipo === "consumo" ? "Usar no jogo tira o item do estoque pelo custo médio e conta como saída de capital, não como prejuízo." : "";
    };
    ["#it-item", "#it-qtd", "#it-preco"].forEach((s) => $(s).addEventListener("input", atualizar));
    atualizar();

    $("#it-salvar").addEventListener("click", () => {
      let itemId = $("#it-item").value;
      if (itemId === "+novo") {
        const nome = $("#it-novo").value.trim();
        if (!nome) return App.avisar("Digite o nome do novo item.", true);
        const existente = Dados.itens().find((i) => i.nome.toLowerCase() === nome.toLowerCase());
        itemId = existente ? existente.id : Dados.adicionarItem(nome).id;
      }
      if (!itemId) return App.avisar("Escolha o item.", true);
      const qtd = Formato.lerGold($("#it-qtd").value);
      const preco = st.tipo === "consumo" ? 0 : Formato.lerGold($("#it-preco").value);
      if (!(qtd > 0) || (st.tipo !== "consumo" && !(preco > 0))) return App.avisar("Preencha quantidade e preço.", true);
      Dados.criarLancamentoItem({
        mundoId: $("#it-mundo").value, itemId, tipo: st.tipo, qtd, preco,
        teveTaxa: st.tipo !== "consumo" && st.teveTaxa, ...UI.lerDataPeriodo(caixa, "it"), nota: $("#it-nota").value.trim(),
      });
      App.avisar("Item lançado.");
      PaginaCarteira.render(main);
    });
  },

  historico(caixa, main) {
    const nomesTipo = {
      "rc-entrada": "Entrada de RC", "rc-saida": "Saída de RC", "gold-entrada": "Entrada de gold",
      "gold-saida": "Saída de gold", "ajuste-rc": "Ajuste de RC", "ajuste-gold": "Ajuste de gold",
    };
    const linhas = [
      ...Dados.movimentos().map((m) => ({
        ...m, tipoTxt: nomesTipo[m.tipo], onde: m.mundoId ? Dados.nomeMundo(m.mundoId) : "conta",
        valor: m.tipo.includes("gold") ? UI.kk(m.qtd) : UI.rc(m.qtd, 0, m.tipo.startsWith("ajuste")),
        extra: m.valorRc ? `≈ ${Formato.numero(m.valorRc, 1)} RC` : m.valorReais ? `R$ ${Formato.numero(m.valorReais, 2)}` : "",
        apagar: "mov",
      })),
      ...Dados.lancamentosItens().map((l) => ({
        ...l, tipoTxt: { compra: "Comprei", venda: "Vendi", consumo: "Usei" }[l.tipo] + " " + Formato.esc(Dados.nomeItem(l.itemId)),
        onde: Dados.nomeMundo(l.mundoId),
        valor: `${Formato.numero(l.qtd)} × ${l.preco ? UI.kk(l.preco) : "—"}`,
        extra: l.taxa ? "taxa " + UI.kk(l.taxa) : "",
        apagar: "item",
      })),
    ].sort((a, b) => ordenarEventos(b, a));

    if (!linhas.length) {
      caixa.innerHTML = `<div class="vazio">Nenhum lançamento ainda. Comece lançando seu RC atual e o gold de cada mundo.</div>`;
      return;
    }
    caixa.innerHTML = `<table><thead><tr><th>Data</th><th>Tipo</th><th>Onde</th><th class="num">Valor</th><th></th><th>Nota</th><th></th></tr></thead>
      <tbody>${linhas.map((l) => `<tr>
        <td>${Formato.data(l.data)} <span class="fraco">${Formato.nomePeriodo[l.periodo]}</span></td>
        <td>${l.tipoTxt}</td><td>${l.onde}</td><td class="num">${l.valor}</td><td class="fraco">${l.extra}</td>
        <td class="fraco">${Formato.esc(l.nota)}</td>
        <td class="num"><button class="pequeno perigo" data-apagar="${l.apagar}" data-id="${l.id}">Apagar</button></td></tr>`).join("")}</tbody></table>`;

    caixa.querySelectorAll("[data-apagar]").forEach((b) =>
      UI.confirmar(b, () => {
        if (b.dataset.apagar === "mov") Dados.apagarMovimento(b.dataset.id);
        else Dados.apagarLancamentoItem(b.dataset.id);
        App.avisar("Lançamento apagado.");
        PaginaCarteira.render(main);
      })
    );
  },
};
