// paginas/painel.js — visão geral: patrimônio, lucro, avisos, ofertas abertas, oportunidades e métricas

const PaginaPainel = {
  render(main) {
    const cfg = Dados.config();
    const hoje = Formato.hoje();
    const inicioMes = hoje.slice(0, 8) + "01";
    const { E, A } = Motor.agora();
    const serie = Motor.serieDiaria(30);
    const m = Motor.metricas(E);
    const noMes = (l) => l.filter((x) => x.data >= inicioMes);
    const realizadoMes = noMes(E.realizados).reduce((s, r) => s + r.rc, 0);
    const taxasMesGold = noMes(E.taxas).reduce((s, t) => s + t.gold, 0);
    const taxasMesRc = noMes(E.taxas).reduce((s, t) => s + t.rc, 0);
    const reservaCls = A.reserva === null ? "" : A.reserva < cfg.reservaMinima ? "prejuizo" : "lucro";
    const vazio = !Dados.movimentos().length && !Dados.ofertas().length;

    main.innerHTML = `
      <div class="cabecalho"><h1>Painel</h1><span class="fraco">${Formato.data(hoje)}</span></div>

      ${vazio ? `<div class="dica"><b>Primeiro passo:</b> vá em <a href="#carteira">Carteira → Lançar movimento</a> e lance
        o RC que você tem hoje (Entrada de RC) e o gold de cada mundo (Entrada de gold). Depois registre suas ofertas em <a href="#ofertas">Ofertas</a>.</div>` : ""}

      <div class="cartoes">
        ${UI.cartao("Patrimônio", UI.rc(A.patrimonioRc, 0, false), UI.reais(A.patrimonioRc))}
        ${UI.cartao("Resultado total", UI.rc(A.resultadoRc), `${A.capitalRc > 0 ? Formato.percentual(A.resultadoRc / A.capitalRc) + " sobre o capital · " : ""}${UI.reais(A.resultadoRc)}`, UI.cor(A.resultadoRc))}
        ${UI.cartao("Realizado no mês", UI.rc(realizadoMes, 1), `total: ${UI.rc(A.realizadoRc, 1)}`, UI.cor(realizadoMes))}
        ${UI.cartao("Não realizado", UI.rc(A.abertoRc, 1), "se fechasse tudo hoje", UI.cor(A.abertoRc))}
      </div>
      <div class="cartoes">
        ${UI.cartao("Taxas no mês", UI.kk(taxasMesGold), `≈ ${UI.rc(taxasMesRc, 0, false)} · total ${UI.kk(A.taxasGold)}`, taxasMesGold ? "sobe" : "")}
        ${UI.cartao("Reserva em RC livre", Formato.percentual(A.reserva).replace("+", ""), `mínimo ${Formato.numero(cfg.reservaMinima * 100)}% · ${UI.rc(A.rcLivre, 0, false)} livres`, reservaCls)}
        ${UI.cartao("% de acerto", m.acerto === null ? "—" : Formato.percentual(m.acerto).replace("+", ""), `${m.total} recompra(s)/venda(s) de item`)}
        ${UI.cartao("Expectativa por operação", UI.rc(m.expectativa, 1), `queda máxima 30d: ${UI.rc(Motor.quedaMaxima(serie), 0)}`, UI.cor(m.expectativa))}
      </div>

      <div class="caixa">
        <h2>Avisos</h2>
        ${PaginaPainel.avisos(E, A, cfg)}
      </div>

      <div class="duas-colunas largura-grafico">
        <div class="caixa">
          <h2>Patrimônio nos últimos 30 dias (RC)</h2>
          ${UI.linha(serie.map((p) => ({ rotulo: Formato.data(p.data).slice(0, 5), valor: p.patrimonioRc })))}
        </div>
        <div class="caixa">
          <h2>Ofertas abertas</h2>
          ${PaginaPainel.ofertasAbertas()}
        </div>
      </div>

      <div class="caixa">
        <h2>Oportunidades agora</h2>
        ${(PaginaAvaliar.A = A, PaginaAvaliar.oportunidades())}
      </div>

      <div class="duas-colunas">
        <div class="caixa">
          <h2>Métricas das operações</h2>
          ${PaginaPainel.tabelaMetricas(m)}
        </div>
        <div class="caixa">
          <h2>Patrimônio por lugar</h2>
          ${PaginaPainel.composicao(A)}
        </div>
      </div>
    `;
  },

  avisos(E, A, cfg) {
    const lista = [];
    const add = (tipo, texto) => lista.push(`<li class="aviso-${tipo}">${texto}</li>`);

    E.alertas.slice(-3).forEach((t) => add("erro", Formato.esc(t)));
    if (A.semCotacao.length) add("alerta", `Sem cotação de RC em ${A.semCotacao.map(Dados.nomeMundo).join(", ")}: faça a ronda para o patrimônio ficar certo.`);

    for (const mundo of Dados.mundos().filter((x) => x.posicao)) {
      const ultima = Calculos.ultima(mundo.id, "rc");
      const horas = ultima ? (Date.now() - ultima.criadoEm) / 3600000 : Infinity;
      if (horas >= cfg.horasCotacaoVelha) {
        add("alerta", `Cotação do ${mundo.nome} ${ultima ? "tem " + Formato.idade(ultima.criadoEm) : "nunca foi feita"}. <a href="#cotacoes">Fazer ronda</a>`);
      }
    }
    if (A.reserva !== null && A.patrimonioRc > 0 && A.reserva < cfg.reservaMinima) {
      add("erro", `Reserva em RC livre está em ${Formato.percentual(A.reserva).replace("+", "")}, abaixo do mínimo de ${Formato.numero(cfg.reservaMinima * 100)}%. Evite vender mais RC agora.`);
    }
    for (const o of Dados.ofertas().filter((x) => x.status === "aberta")) {
      const cot = Calculos.cotacaoAte(o.mundoId, "rc");
      if (!cot) continue;
      const d = o.preco / cot - 1;
      if (o.tipo === "venda" && d > 0.03) add("alerta", `Venda no ${Dados.nomeMundo(o.mundoId)} a ${Formato.numero(o.preco)} está ${Formato.percentual(d)} acima da cotação (${Formato.numero(cot)}): pode ficar parada.`);
      if (o.tipo === "compra" && d < -0.03) add("alerta", `Compra no ${Dados.nomeMundo(o.mundoId)} a ${Formato.numero(o.preco)} está ${Formato.percentual(d)} abaixo da cotação: pode não executar.`);
    }
    for (const w of A.mundos) {
      if (w.gold > 0 && w.lucroRecompraAgora !== null && w.lucroRecompraAgora >= cfg.lucroMinimo) {
        add("ok", `Recompra no ${w.nome} dá ${Formato.percentual(w.lucroRecompraAgora)} agora (cotação ${Formato.numero(w.cotacao)}, seu preço base ${Formato.numero(Math.round(w.precoBase))}). <a href="#avaliar">Avaliar</a>`);
      }
    }
    const ontem = Datas.somar(Formato.hoje(), -1);
    if (E.operacoes.some((o) => o.data === ontem) && !Dados.fechamento(ontem)) {
      add("alerta", `Houve operações ontem e o dia não foi fechado. <a href="#fechamento">Fechar</a>`);
    }
    return lista.length ? `<ul class="avisos">${lista.join("")}</ul>` : `<div class="fraco">Tudo em ordem.</div>`;
  },

  ofertasAbertas() {
    const abertas = Dados.ofertas().filter((o) => o.status === "aberta");
    if (!abertas.length) return `<div class="vazio">Nenhuma oferta aberta. <a href="#ofertas">Registrar</a></div>`;
    return abertas.map((o) => {
      const exec = Dados.executado(o.id);
      return `<div class="mini-oferta">
        <div class="lado"><b>${Dados.nomeMundo(o.mundoId)}</b><span class="fraco">${o.tipo} a ${Formato.numero(o.preco)}</span>
          <span class="espaco"></span><span>${Formato.numero(exec)} / ${Formato.numero(o.qtd)}</span></div>
        ${UI.barraProgresso(exec, o.qtd)}</div>`;
    }).join("") + `<div class="acoes"><a class="botao" href="#ofertas">Ver ofertas</a></div>`;
  },

  tabelaMetricas(m) {
    const linhas = [
      ["Operações fechadas", Formato.numero(m.total)],
      ["% de acerto", m.acerto === null ? "—" : Formato.percentual(m.acerto).replace("+", "")],
      ["Ganho médio", UI.rc(m.mediaGanho, 1)],
      ["Perda média", UI.rc(m.mediaPerda, 1)],
      ["Payoff (ganho médio ÷ perda média)", m.payoff ? Formato.numero(m.payoff, 2) : "—"],
      ["Fator de lucro (ganhos ÷ perdas)", m.fatorLucro ? Formato.numero(m.fatorLucro, 2) : "—"],
      ["Expectativa por operação", UI.rc(m.expectativa, 1)],
      ["Maior ganho", UI.rc(m.maiorGanho, 1)],
      ["Maior perda", UI.rc(m.maiorPerda, 1)],
      ["Peso das taxas (taxas ÷ ganhos)", m.pesoTaxas === null ? "—" : Formato.percentual(m.pesoTaxas).replace("+", "")],
    ];
    return linhas.map(([r, v]) => `<div class="kv"><span class="fraco">${r}</span><b>${v}</b></div>`).join("");
  },

  composicao(A) {
    const partes = [
      ["RC livre", A.rcLivre],
      ["RC em ofertas", A.rcOfertas],
      ...A.mundos.map((w) => ["Gold · " + w.nome, w.valorRc]),
      ["Itens", A.valorItensRc],
    ].filter(([, v]) => Math.abs(v) > 0.5);
    if (!partes.length) return `<div class="vazio">Nada lançado ainda.</div>`;
    const total = partes.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
    return partes.map(([r, v]) => `<div class="composicao">
      <div class="lado"><span>${r}</span><span class="espaco"></span><b>${UI.rc(v, 0, false)}</b><span class="fraco" style="width:52px;text-align:right">${Formato.numero((Math.max(0, v) / total) * 100)}%</span></div>
      ${UI.barraProgresso(Math.max(0, v), total)}</div>`).join("");
  },
};
