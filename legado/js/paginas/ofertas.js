// paginas/ofertas.js — ofertas de Rubini Coin (venda e compra), execuções parciais, cancelamento e cenários

const PaginaOfertas = {
  filtro: "aberta",
  formAberto: false,
  abertos: {}, // ofertas com "Detalhes" aberto

  render(main) {
    const { E, A } = Motor.agora();
    PaginaOfertas.E = E;
    PaginaOfertas.A = A;

    const contagem = (st) => Dados.ofertas().filter((o) => st === "todas" || o.status === st).length;
    const abas = [["aberta", "Abertas"], ["concluida", "Concluídas"], ["cancelada", "Canceladas"], ["todas", "Todas"]]
      .map(([v, t]) => `<button data-filtro="${v}" class="${v === PaginaOfertas.filtro ? "ativo" : ""}">${t} (${contagem(v)})</button>`)
      .join("");

    main.innerHTML = `
      <div class="cabecalho">
        <h1>Ofertas</h1>
        <div class="grupo" id="of-filtro">${abas}</div>
        <button class="principal" id="of-nova">${PaginaOfertas.formAberto ? "Fechar formulário" : "+ Nova oferta"}</button>
      </div>
      <div id="of-form"></div>
      <div id="of-lista"></div>
    `;

    main.querySelectorAll("#of-filtro button").forEach((b) =>
      b.addEventListener("click", () => { PaginaOfertas.filtro = b.dataset.filtro; PaginaOfertas.render(main); })
    );
    main.querySelector("#of-nova").addEventListener("click", () => {
      PaginaOfertas.formAberto = !PaginaOfertas.formAberto;
      PaginaOfertas.render(main);
    });

    if (PaginaOfertas.formAberto) PaginaOfertas.desenharFormulario(main.querySelector("#of-form"), main);
    PaginaOfertas.desenharLista(main.querySelector("#of-lista"), main);
  },

  // ---------- Formulário de nova oferta ----------
  desenharFormulario(caixa, main) {
    const primeiroComPosicao = Dados.mundosParaRonda()[0];
    caixa.innerHTML = `
      <div class="duas-colunas">
        <div class="caixa">
          <h2>Nova oferta de Rubini Coin</h2>
          <div class="form">
            <label>Mundo<select id="nf-mundo">${UI.opcoesMundos(primeiroComPosicao && primeiroComPosicao.id)}</select></label>
            <label>Quando<div class="lado">${UI.dataPeriodo("nf")}</div></label>
            <label class="inteiro">Tipo
              <div class="grupo largo" id="nf-tipo">
                <button data-v="venda" class="ativo">Venda de RC</button><button data-v="compra">Compra de RC</button>
              </div>
            </label>
            <label class="inteiro">Teve taxa?
              <div class="grupo largo" id="nf-taxa">
                <button data-v="sim" class="ativo">Sim · eu criei a oferta</button><button data-v="nao">Não · aceitei uma oferta</button>
              </div>
            </label>
            <label>Quantidade de RC<input id="nf-qtd" placeholder="Ex.: 1.500" inputmode="decimal"></label>
            <label>Preço por RC (gold)<input id="nf-preco" placeholder="Ex.: 75k" inputmode="decimal"></label>
            <label class="inteiro">Nota (opcional)<input id="nf-nota" placeholder="Ex.: escada 68/65/62, stop 88k"></label>
          </div>
          <div class="acoes"><button class="principal" id="nf-salvar">Registrar oferta</button></div>
        </div>
        <div class="caixa" id="nf-previa"></div>
      </div>`;

    const estado = { tipo: "venda", teveTaxa: true };
    const grupo = (id, chave, conv) =>
      caixa.querySelectorAll(`#${id} button`).forEach((b) =>
        b.addEventListener("click", () => {
          caixa.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("ativo", x === b));
          estado[chave] = conv(b.dataset.v);
          atualizar();
        })
      );
    grupo("nf-tipo", "tipo", (v) => v);
    grupo("nf-taxa", "teveTaxa", (v) => v === "sim");

    const ler = () => ({
      mundoId: caixa.querySelector("#nf-mundo").value,
      qtd: Formato.lerGold(caixa.querySelector("#nf-qtd").value),
      preco: Formato.lerGold(caixa.querySelector("#nf-preco").value),
      ...UI.lerDataPeriodo(caixa, "nf"),
      nota: caixa.querySelector("#nf-nota").value.trim(),
      ...estado,
    });

    const atualizar = () => {
      const f = ler();
      caixa.querySelector("#nf-qtd").classList.toggle("invalido", Number.isNaN(f.qtd));
      caixa.querySelector("#nf-preco").classList.toggle("invalido", Number.isNaN(f.preco));
      caixa.querySelector("#nf-previa").innerHTML = PaginaOfertas.previa(f);
    };
    ["#nf-mundo", "#nf-qtd", "#nf-preco"].forEach((s) => caixa.querySelector(s).addEventListener("input", atualizar));
    atualizar();

    caixa.querySelector("#nf-salvar").addEventListener("click", () => {
      const f = ler();
      if (!(f.qtd > 0) || !(f.preco > 0)) {
        App.avisar("Preencha quantidade e preço (ex.: 1.500 e 75k).", true);
        return;
      }
      Dados.criarOferta(f);
      App.avisar(f.teveTaxa ? "Oferta registrada. A taxa já foi descontada do gold do mundo." : "Operação registrada (sem taxa, executada na hora).");
      PaginaOfertas.formAberto = false;
      PaginaOfertas.filtro = f.teveTaxa ? "aberta" : "concluida";
      PaginaOfertas.render(main);
    });
  },

  // Painel "Antes de confirmar"
  previa(f) {
    const cfg = Dados.config();
    const A = PaginaOfertas.A;
    const w = A.mundos.find((m) => m.id === f.mundoId) || { gold: 0, precoBase: null };
    const nome = Dados.nomeMundo(f.mundoId);
    const cot = Calculos.cotacaoAte(f.mundoId, "rc");
    const cotCompra = Calculos.cotacaoAte(f.mundoId, "rc", null, "compra");
    const media = Calculos.media7Dias(f.mundoId, "rc", Formato.hoje());
    const linhas = [];
    const avisos = [];
    const kv = (r, v, cls = "") => linhas.push(`<div class="kv"><span class="fraco">${r}</span><b class="${cls}">${v}</b></div>`);

    const ok = f.qtd > 0 && f.preco > 0;
    const valor = ok ? f.qtd * f.preco : null;
    const taxa = ok && f.teveTaxa ? valor * cfg.taxa : 0;

    kv("Valor da oferta", ok ? UI.kk(valor) : "—");
    kv(`Taxa (${Formato.numero(cfg.taxa * 100)}%)`, ok ? (taxa ? UI.kk(taxa) + " · paga agora" : "zero") : "—", taxa ? "sobe" : "");
    kv(`Seu gold no ${nome}`, UI.kk(w.gold));
    kv("Seu RC livre", UI.rc(A.rcLivre, 0, false));

    if (f.tipo === "venda") {
      const liquidoPorRc = ok ? f.preco * (1 - (f.teveTaxa ? cfg.taxa : 0)) : null;
      kv("Gold líquido se vender tudo", ok ? UI.kk(f.qtd * liquidoPorRc) : "—");
      kv("Equilíbrio da recompra (aceitando)", ok ? Formato.numero(Math.round(liquidoPorRc)) : "—", "destaque");
      kv("Equilíbrio da recompra (criando)", ok ? Formato.numero(Math.round(liquidoPorRc / (1 + cfg.taxa))) : "—");
      if (ok && f.qtd > A.rcLivre) avisos.push(["erro", `Você tem ${Formato.numero(A.rcLivre)} RC livres e quer vender ${Formato.numero(f.qtd)}.`]);
      if (ok && taxa > w.gold) avisos.push(["erro", `Gold insuficiente no ${nome} para pagar a taxa de ${UI.kk(taxa)}.`]);
      else if (ok && f.teveTaxa) avisos.push(["ok", "Gold suficiente para pagar a taxa."]);
      if (ok && !f.teveTaxa && cotCompra && f.preco < cotCompra) avisos.push(["alerta", `A melhor oferta de compra cotada é ${Formato.numero(cotCompra)}: confira se não dá para vender mais caro.`]);
    } else {
      const custoPorRc = ok ? f.preco * (1 + (f.teveTaxa ? cfg.taxa : 0)) : null;
      kv("Gold necessário", ok ? UI.kk(valor + taxa) : "—");
      kv("Seu preço base no mundo", w.precoBase ? Formato.numero(Math.round(w.precoBase)) : "—");
      if (ok && w.precoBase) {
        const lucro = w.precoBase / custoPorRc - 1;
        const rcLucro = f.qtd - (f.qtd * custoPorRc) / w.precoBase;
        kv("Lucro estimado", `${UI.rc(rcLucro)} (${Formato.percentual(lucro)})`, UI.cor(lucro));
        if (lucro < 0) avisos.push(["erro", "Comprando a esse preço você recebe menos RC do que vendeu: prejuízo."]);
        else if (lucro < cfg.lucroMinimo) avisos.push(["alerta", "Lucro pequeno: abaixo do seu mínimo configurado."]);
      }
      if (ok && valor + taxa > w.gold) avisos.push(["erro", `Gold insuficiente no ${nome}: precisa de ${UI.kk(valor + taxa)}.`]);
    }

    kv(`Cotação atual (venda) no ${nome}`, cot ? Formato.numero(cot) : "sem cotação");
    kv("Média de 7 dias", media ? Formato.numero(Math.round(media)) : "—");
    if (ok && cot) {
      const d = f.preco / cot - 1;
      if (Math.abs(d) >= 0.03) avisos.push(["alerta", `Seu preço está ${Formato.percentual(d)} em relação à última cotação.`]);
    }
    if (f.teveTaxa) avisos.push(["alerta", `Mudar o preço depois = cancelar e criar outra oferta, pagando ${Formato.numero(cfg.taxa * 100)}% de novo.`]);

    return `<h2>Antes de confirmar</h2>${linhas.join("")}
      ${avisos.map(([t, txt]) => `<div class="nota-${t}">${txt}</div>`).join("")}`;
  },

  // ---------- Lista ----------
  desenharLista(caixa, main) {
    const lista = Dados.ofertas()
      .filter((o) => PaginaOfertas.filtro === "todas" || o.status === PaginaOfertas.filtro)
      .sort((a, b) => ordenarEventos(b, a));

    if (!lista.length) {
      caixa.innerHTML = `<div class="caixa vazio">Nenhuma oferta aqui. Clique em <b>+ Nova oferta</b> para registrar.</div>`;
      return;
    }
    caixa.innerHTML = lista.map((o) => PaginaOfertas.cartaoOferta(o)).join("");

    caixa.querySelectorAll("[data-oferta]").forEach((card) => {
      const id = card.dataset.oferta;
      const o = Dados.oferta(id);
      const q = (s) => card.querySelector(s);

      if (q(".ex-tudo")) q(".ex-tudo").addEventListener("click", () => { q(".ex-qtd").value = Formato.numero(Dados.restante(o)); });
      if (q(".ex-salvar")) q(".ex-salvar").addEventListener("click", () => {
        const qtd = Formato.lerGold(q(".ex-qtd").value);
        try {
          Dados.registrarExecucao(id, qtd, ...Object.values(UI.lerDataPeriodo(card, "ex-" + id)));
          App.avisar(`Execução registrada: ${Formato.numero(qtd)} RC.`);
          PaginaOfertas.render(main);
        } catch (e) {
          App.avisar(e.message, true);
        }
      });
      if (q(".ex-cancelar")) UI.confirmar(q(".ex-cancelar"), () => {
        Dados.cancelarOferta(id, Formato.hoje(), Formato.periodoAgora());
        App.avisar("Oferta cancelada. O que não executou voltou para você; a taxa não volta.");
        PaginaOfertas.render(main);
      }, "Confirmar cancelamento?");
      if (q(".ex-reabrir")) q(".ex-reabrir").addEventListener("click", () => {
        Dados.reabrirOferta(id);
        App.avisar("Cancelamento desfeito.");
        PaginaOfertas.render(main);
      });
      q(".ex-detalhes").addEventListener("click", () => {
        PaginaOfertas.abertos[id] = !PaginaOfertas.abertos[id];
        PaginaOfertas.render(main);
      });
      if (q(".ex-apagar")) UI.confirmar(q(".ex-apagar"), () => {
        Dados.apagarOferta(id);
        App.avisar("Oferta apagada.");
        PaginaOfertas.render(main);
      }, "Apagar de vez?");
      card.querySelectorAll("[data-apagar-exec]").forEach((b) =>
        UI.confirmar(b, () => {
          Dados.apagarExecucao(b.dataset.apagarExec);
          App.avisar("Execução apagada.");
          PaginaOfertas.render(main);
        })
      );
    });
  },

  cartaoOferta(o) {
    const cfg = Dados.config();
    const exec = Dados.executado(o.id);
    const resta = o.qtd - exec;
    const cot = Calculos.cotacaoAte(o.mundoId, "rc");
    const nome = Dados.nomeMundo(o.mundoId);
    const rotuloStatus = { aberta: exec > 0 ? "Parcial" : "Aberta", concluida: "Concluída", cancelada: "Cancelada" }[o.status];
    const realizado = PaginaOfertas.E.realizados.filter((r) => r.ofertaId === o.id).reduce((s, r) => s + r.rc, 0);

    let numeros;
    if (o.tipo === "venda") {
      const goldRecebido = exec * o.preco;
      const eqTudo = o.preco - o.taxa / o.qtd;
      const eqAgora = exec > 0 ? (goldRecebido - o.taxa) / exec : null;
      numeros = [
        ["Vendido", `${Formato.numero(exec)} RC`],
        ["Ainda na oferta", o.status === "aberta" ? `${Formato.numero(resta)} RC` : "—"],
        ["Gold recebido", UI.kk(goldRecebido)],
        ["Equilíbrio da recompra", `<span class="destaque">${Formato.numero(Math.round(eqTudo))}</span>
          ${eqAgora && o.status === "aberta" && resta > 0 ? `<div class="sub">${Formato.numero(Math.round(eqAgora))} se cancelar o resto</div>` : ""}`],
      ];
    } else {
      numeros = [
        ["Comprado", `${Formato.numero(exec)} RC`],
        ["Ainda na oferta", o.status === "aberta" ? `${Formato.numero(resta)} RC` : "—"],
        ["Gold gasto", UI.kk(exec * o.preco + o.taxa)],
        ["Lucro realizado", `<span class="${UI.cor(realizado)}">${UI.rc(realizado, 1)}</span>`],
      ];
    }

    const distancia = cot && o.status === "aberta" ? o.preco / cot - 1 : null;
    const avisoPreco = distancia !== null && Math.abs(distancia) >= 0.03
      ? `<div class="nota-alerta">Preço da oferta ${Formato.percentual(distancia)} em relação à cotação atual (${Formato.numero(cot)}). ${
        (o.tipo === "venda" && distancia > 0) || (o.tipo === "compra" && distancia < 0) ? "Pode demorar para executar." : ""}</div>` : "";

    const acoes = o.status === "aberta" ? `
      <div class="linha-acoes">
        <input class="ex-qtd" placeholder="Qtd executada (resta ${Formato.numero(resta)})" style="max-width:220px" inputmode="decimal">
        <button class="pequeno ex-tudo">Tudo</button>
        <span class="lado compacto">${UI.dataPeriodo("ex-" + o.id)}</span>
        <button class="principal ex-salvar">Registrar execução</button>
        <span class="espaco"></span>
        <button class="ex-cancelar perigo">Cancelar o resto</button>
        <button class="ex-detalhes">${PaginaOfertas.abertos[o.id] ? "Ocultar" : "Detalhes"}</button>
      </div>` : `
      <div class="linha-acoes">
        ${o.status === "cancelada" ? `<button class="ex-reabrir">Desfazer cancelamento</button>` : ""}
        <span class="espaco"></span>
        <button class="ex-detalhes">${PaginaOfertas.abertos[o.id] ? "Ocultar" : "Detalhes"}</button>
      </div>`;

    return `
      <div class="caixa oferta" data-oferta="${o.id}">
        <div class="oferta-topo">
          <h2>${nome} · ${o.tipo === "venda" ? "venda" : "compra"} de ${Formato.numero(o.qtd)} RC a ${Formato.numero(o.preco)}</h2>
          <span class="etiqueta st-${o.status}">${rotuloStatus}</span>
          <span class="fraco">${Formato.data(o.data)} · ${Formato.nomePeriodo[o.periodo]} · ${o.taxa ? "taxa " + UI.kk(o.taxa) : "sem taxa (aceitei)"}</span>
        </div>
        ${o.nota ? `<div class="fraco" style="margin-bottom:8px">${Formato.esc(o.nota)}</div>` : ""}
        ${UI.barraProgresso(exec, o.qtd)}
        <div class="numeros">${numeros.map(([r, v]) => `<div><div class="rotulo">${r}</div><div class="valor-m">${v}</div></div>`).join("")}</div>
        ${avisoPreco}
        ${acoes}
        ${PaginaOfertas.abertos[o.id] ? PaginaOfertas.detalhes(o, exec, cfg) : ""}
      </div>`;
  },

  detalhes(o, exec, cfg) {
    const execs = Dados.execucoes(o.id).sort(ordenarEventos);
    const tabelaExec = execs.length ? `
      <table><thead><tr><th>Data</th><th>Período</th><th class="num">Qtd</th><th class="num">Gold</th><th></th></tr></thead>
      <tbody>${execs.map((x) => `<tr><td>${Formato.data(x.data)}</td><td>${Formato.nomePeriodo[x.periodo]}</td>
        <td class="num">${Formato.numero(x.qtd)}</td><td class="num">${UI.kk(x.qtd * o.preco)}</td>
        <td class="num"><button class="pequeno perigo" data-apagar-exec="${x.id}">Apagar</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="vazio">Nenhuma execução ainda.</div>`;

    let cenarios = "";
    if (o.tipo === "venda") {
      const goldTudo = o.qtd * o.preco - o.taxa;
      const goldAgora = exec * o.preco - o.taxa;
      const cot = Calculos.cotacaoAte(o.mundoId, "rc");
      const precos = [...new Set([cot, o.preco * 0.97, o.preco * 0.94, o.preco * 0.91, o.preco * 0.88, o.preco * 1.04, o.preco * 1.1]
        .filter(Boolean).map((p) => Math.round(p / 100) * 100))].sort((a, b) => a - b);
      const linha = (p) => {
        const seVenderTudo = goldTudo / p - o.qtd;
        const seCancelar = exec > 0 ? goldAgora / p - exec : null;
        const criando = goldTudo / (p * (1 + cfg.taxa)) - o.qtd;
        return `<tr><td>${Formato.numero(p)}${p === cot ? ' <span class="fraco">(agora)</span>' : ""}</td>
          <td class="num">${Formato.percentual(p / o.preco - 1)}</td>
          <td class="num ${UI.cor(seVenderTudo)}">${UI.rc(seVenderTudo)}</td>
          <td class="num ${UI.cor(seCancelar)}">${o.status === "aberta" ? UI.rc(seCancelar) : "—"}</td>
          <td class="num ${UI.cor(criando)}">${UI.rc(criando)}</td></tr>`;
      };
      cenarios = `
        <h3>Cenários de recompra</h3>
        <table><thead><tr><th>Recomprar a</th><th class="num">vs. seu preço</th><th class="num">Vendendo tudo · aceitando</th>
          <th class="num">Cancelando agora · aceitando</th><th class="num">Vendendo tudo · criando oferta</th></tr></thead>
        <tbody>${precos.map(linha).join("")}</tbody></table>
        <p class="fraco">"Aceitando" = você aceita ofertas de venda que já estão no market (sem taxa). "Criando" = você cria uma oferta de compra e paga ${Formato.numero(cfg.taxa * 100)}%.</p>`;
    }

    return `<div class="detalhes">
      <h3>Execuções</h3>${tabelaExec}
      ${cenarios}
      <div class="acoes"><button class="pequeno perigo ex-apagar">Apagar oferta</button></div>
    </div>`;
  },
};
