// motor.js — calcula a carteira inteira a partir de tudo o que foi lançado
//
// Ideia central: tudo é medido em RC.
// - Cada mundo tem um "monte" de gold e quanto RC esse gold custou (custoRc).
//   Ex.: vendeu 825 RC por 61,875kk → o monte ganha 61,875kk de gold que custou 825 RC.
// - Taxa paga tira gold do monte mas não mexe no custo → o gold que sobra fica mais caro.
// - Quando você recompra RC com esse gold, o lucro realizado é: RC recebido − custo em RC do gold usado.
// - Preço base do mundo = gold ÷ custoRc = a cotação em que a recompra empata (sem lucro nem prejuízo).
//
// Patrimônio = RC livre + RC em ofertas + (gold + itens de cada mundo) ÷ cotação do mundo
// Capital    = tudo o que você colocou (saldo inicial, RC comprado no site) − o que tirou
// Resultado  = Patrimônio − Capital = Realizado + Não realizado

function ordenarEventos(a, b) {
  return momento(a.data, a.periodo) - momento(b.data, b.periodo) || a.criadoEm - b.criadoEm;
}

const Motor = {
  // Junta tudo numa linha do tempo
  eventos() {
    const ev = [];
    const ofertasPorId = {};
    for (const o of Dados.ofertas()) {
      ofertasPorId[o.id] = o;
      ev.push({ k: "oferta", data: o.data, periodo: o.periodo, criadoEm: o.criadoEm, o });
      if (o.status === "cancelada") {
        ev.push({ k: "cancelar", data: o.canceladaData, periodo: o.canceladaPeriodo, criadoEm: o.canceladaEm, o });
      }
    }
    for (const x of Dados.execucoes()) {
      const o = ofertasPorId[x.ofertaId];
      if (o) ev.push({ k: "execucao", data: x.data, periodo: x.periodo, criadoEm: x.criadoEm, o, x });
    }
    for (const m of Dados.movimentos()) ev.push({ k: "movimento", data: m.data, periodo: m.periodo, criadoEm: m.criadoEm, m });
    for (const l of Dados.lancamentosItens()) ev.push({ k: "item", data: l.data, periodo: l.periodo, criadoEm: l.criadoEm, l });
    return ev.sort(ordenarEventos);
  },

  // Roda a linha do tempo até o fim de "ateData" (ou até hoje, se não informado)
  calcular(ateData, eventosProntos) {
    const eventos = eventosProntos || Motor.eventos();
    const E = {
      rcLivre: 0,
      rcOfertas: 0,
      mundos: {},      // id → { gold, custoRc, goldOfertas, custoRcOfertas }
      itens: {},       // "mundo|item" → estoque e resultados
      ofertas: {},     // id → { executado, restante }
      realizados: [],  // { data, mundoId, rc, origem, ofertaId }
      taxas: [],       // { data, mundoId, gold, rc }
      aportes: [],     // { data, rc, reais, tipo }
      ajustes: [],     // { data, mundoId, rc, gold }
      operacoes: [],   // { data, mundoId, tipo, rc, gold }
      alertas: [],
    };

    const mundo = (id) => (E.mundos[id] ||= { gold: 0, custoRc: 0, goldOfertas: 0, custoRcOfertas: 0 });
    const parteDoCusto = (custo, total, parte) => (total > 0 ? custo * Math.min(1, parte / total) : 0);
    const rcDaTaxa = (mundoId, gold, data) => {
      const cot = Calculos.cotacaoAte(mundoId, "rc", data);
      return cot ? gold / cot : 0;
    };

    for (const ev of eventos) {
      if (ateData && ev.data > ateData) break;

      if (ev.k === "movimento") {
        const m = ev.m;
        if (m.tipo === "rc-entrada") {
          E.rcLivre += m.qtd;
          E.aportes.push({ data: m.data, rc: m.qtd, reais: m.valorReais || null, tipo: m.tipo });
        } else if (m.tipo === "rc-saida") {
          E.rcLivre -= m.qtd;
          E.aportes.push({ data: m.data, rc: -m.qtd, reais: null, tipo: m.tipo });
        } else if (m.tipo === "gold-entrada") {
          const w = mundo(m.mundoId);
          w.gold += m.qtd;
          w.custoRc += m.valorRc || 0;
          E.aportes.push({ data: m.data, rc: m.valorRc || 0, reais: null, tipo: m.tipo });
        } else if (m.tipo === "gold-saida") {
          const w = mundo(m.mundoId);
          const custo = parteDoCusto(w.custoRc, w.gold, m.qtd);
          w.gold -= m.qtd;
          w.custoRc -= custo;
          E.aportes.push({ data: m.data, rc: -custo, reais: null, tipo: m.tipo });
        } else if (m.tipo === "ajuste-rc") {
          E.rcLivre += m.qtd;
          E.ajustes.push({ data: m.data, mundoId: null, rc: m.qtd, gold: 0 });
        } else if (m.tipo === "ajuste-gold") {
          mundo(m.mundoId).gold += m.qtd;
          E.ajustes.push({ data: m.data, mundoId: m.mundoId, rc: rcDaTaxa(m.mundoId, m.qtd, m.data), gold: m.qtd });
        }
      }

      if (ev.k === "oferta") {
        const o = ev.o;
        const w = mundo(o.mundoId);
        E.ofertas[o.id] = { executado: 0, restante: o.qtd };
        if (o.taxa) {
          w.gold -= o.taxa; // custo não muda: o gold restante fica mais caro
          E.taxas.push({ data: o.data, mundoId: o.mundoId, gold: o.taxa, rc: rcDaTaxa(o.mundoId, o.taxa, o.data), ofertaId: o.id });
        }
        if (o.tipo === "venda") {
          E.rcLivre -= o.qtd;
          E.rcOfertas += o.qtd;
          if (E.rcLivre < -0.5) E.alertas.push(`Em ${Formato.data(o.data)} a venda no ${Dados.nomeMundo(o.mundoId)} ficou maior que o RC livre. Faltou lançar o saldo de RC?`);
        } else {
          const valor = o.qtd * o.preco;
          const custo = parteDoCusto(w.custoRc, w.gold, valor);
          w.gold -= valor;
          w.custoRc -= custo;
          w.goldOfertas += valor;
          w.custoRcOfertas += custo;
        }
        if (w.gold < -1) E.alertas.push(`Em ${Formato.data(o.data)} o gold do ${Dados.nomeMundo(o.mundoId)} ficou negativo. Faltou lançar o gold que você tinha lá?`);
        E.operacoes.push({ data: o.data, mundoId: o.mundoId, tipo: "oferta", rc: 0, gold: 0 });
      }

      if (ev.k === "execucao") {
        const o = ev.o, q = ev.x.qtd;
        const w = mundo(o.mundoId);
        const st = E.ofertas[o.id];
        if (!st) continue;
        st.executado += q;
        st.restante -= q;
        const valor = q * o.preco;
        if (o.tipo === "venda") {
          E.rcOfertas -= q;
          w.gold += valor;
          w.custoRc += q; // esse gold custou q RC
        } else {
          const custo = parteDoCusto(w.custoRcOfertas, w.goldOfertas, valor);
          w.goldOfertas -= valor;
          w.custoRcOfertas -= custo;
          E.rcLivre += q;
          E.realizados.push({ data: ev.x.data, mundoId: o.mundoId, rc: q - custo, recebido: q, custo, origem: "recompra", ofertaId: o.id });
        }
        E.operacoes.push({ data: ev.x.data, mundoId: o.mundoId, tipo: o.tipo, rc: q, gold: valor });
      }

      if (ev.k === "cancelar") {
        const o = ev.o;
        const w = mundo(o.mundoId);
        const st = E.ofertas[o.id];
        if (!st) continue;
        const r = st.restante;
        st.restante = 0;
        if (o.tipo === "venda") {
          E.rcLivre += r;
          E.rcOfertas -= r;
        } else {
          const valor = r * o.preco;
          const custo = parteDoCusto(w.custoRcOfertas, w.goldOfertas, valor);
          w.goldOfertas -= valor;
          w.custoRcOfertas -= custo;
          w.gold += valor;
          w.custoRc += custo;
        }
      }

      if (ev.k === "item") {
        const l = ev.l;
        const w = mundo(l.mundoId);
        const chave = l.mundoId + "|" + l.itemId;
        const it = (E.itens[chave] ||= {
          mundoId: l.mundoId, itemId: l.itemId, qtd: 0, custoGold: 0, custoRc: 0,
          comprados: 0, vendidos: 0, consumidos: 0, pagoGold: 0, recebidoGold: 0,
          lucroGold: 0, lucroRc: 0, consumoGold: 0, custoVendidoGold: 0,
        });
        if (l.tipo === "compra") {
          const gasto = l.qtd * l.preco + l.taxa;
          const custo = parteDoCusto(w.custoRc, w.gold, gasto);
          w.gold -= gasto;
          w.custoRc -= custo;
          it.qtd += l.qtd;
          it.custoGold += gasto;
          it.custoRc += custo;
          it.comprados += l.qtd;
          it.pagoGold += gasto;
        } else {
          const fracao = it.qtd > 0 ? Math.min(1, l.qtd / it.qtd) : 0;
          const custoGold = it.custoGold * fracao;
          const custoRc = it.custoRc * fracao;
          it.qtd -= l.qtd;
          it.custoGold -= custoGold;
          it.custoRc -= custoRc;
          if (l.tipo === "venda") {
            const liquido = l.qtd * l.preco - l.taxa;
            const cot = Calculos.cotacaoAte(l.mundoId, "rc", l.data);
            const valorRc = cot ? liquido / cot : custoRc;
            w.gold += liquido;
            w.custoRc += valorRc;
            it.vendidos += l.qtd;
            it.recebidoGold += liquido;
            it.custoVendidoGold += custoGold;
            it.lucroGold += liquido - custoGold;
            it.lucroRc += valorRc - custoRc;
            E.realizados.push({ data: l.data, mundoId: l.mundoId, rc: valorRc - custoRc, origem: "item", itemId: l.itemId });
          } else {
            // consumo: usou o item no jogo → é uma saída de capital, não prejuízo de trade
            it.consumidos += l.qtd;
            it.consumoGold += custoGold;
            E.aportes.push({ data: l.data, rc: -custoRc, reais: null, tipo: "consumo" });
          }
          if (it.qtd < 0) E.alertas.push(`${Dados.nomeItem(l.itemId)} no ${Dados.nomeMundo(l.mundoId)} ficou com estoque negativo.`);
        }
        if (l.taxa) E.taxas.push({ data: l.data, mundoId: l.mundoId, gold: l.taxa, rc: rcDaTaxa(l.mundoId, l.taxa, l.data) });
        E.operacoes.push({ data: l.data, mundoId: l.mundoId, tipo: "item-" + l.tipo, rc: 0, gold: l.qtd * l.preco });
      }
    }
    return E;
  },

  // Põe preço em tudo: converte gold e itens em RC pela cotação de cada mundo
  avaliar(E, ateData) {
    const cfg = Dados.config();
    const mundos = [];
    let valorMundosRc = 0, valorItensRc = 0, semCotacao = [];

    for (const [id, w] of Object.entries(E.mundos)) {
      const cot = Calculos.cotacaoAte(id, "rc", ateData);
      const goldTotal = w.gold + w.goldOfertas;
      const custoTotal = w.custoRc + w.custoRcOfertas;
      let valorRc;
      if (cot) valorRc = goldTotal / cot;
      else {
        valorRc = custoTotal;
        if (Math.abs(goldTotal) > 0) semCotacao.push(id);
      }
      const precoBase = w.custoRc > 0.01 && w.gold > 0 ? w.gold / w.custoRc : null;
      mundos.push({
        id, nome: Dados.nomeMundo(id), cotacao: cot,
        gold: w.gold, goldOfertas: w.goldOfertas, custoRc: custoTotal,
        valorRc, abertoRc: valorRc - custoTotal,
        precoBase, // recomprar abaixo disso dá lucro
        lucroRecompraAgora: precoBase && cot ? precoBase / cot - 1 : null,
      });
      valorMundosRc += valorRc;
    }

    const itens = [];
    for (const it of Object.values(E.itens)) {
      const cot = Calculos.cotacaoAte(it.mundoId, "rc", ateData);
      const precoItem = Calculos.cotacaoAte(it.mundoId, it.itemId, ateData);
      const valorGold = it.qtd > 0 ? (precoItem ? it.qtd * precoItem : it.custoGold) : 0;
      const valorRc = cot ? valorGold / cot : it.custoRc;
      itens.push({
        ...it, nome: Dados.nomeItem(it.itemId), mundo: Dados.nomeMundo(it.mundoId),
        custoMedio: it.qtd > 0 ? it.custoGold / it.qtd : null,
        precoItem, valorGold, valorRc,
        abertoGold: it.qtd > 0 ? valorGold - it.custoGold : 0,
        roi: it.custoVendidoGold > 0 ? it.lucroGold / it.custoVendidoGold : null,
      });
      valorItensRc += valorRc;
    }

    const patrimonioRc = E.rcLivre + E.rcOfertas + valorMundosRc + valorItensRc;
    const capitalRc = E.aportes.reduce((s, a) => s + a.rc, 0);
    const realizadoRc = E.realizados.reduce((s, r) => s + r.rc, 0);
    const taxasGold = E.taxas.reduce((s, t) => s + t.gold, 0);
    const taxasRc = E.taxas.reduce((s, t) => s + t.rc, 0);

    return {
      rcLivre: E.rcLivre,
      rcOfertas: E.rcOfertas,
      valorMundosRc, valorItensRc,
      patrimonioRc,
      patrimonioReais: patrimonioRc * cfg.rcEmReais,
      capitalRc,
      resultadoRc: patrimonioRc - capitalRc,
      realizadoRc,
      abertoRc: patrimonioRc - capitalRc - realizadoRc,
      taxasGold, taxasRc,
      reserva: patrimonioRc > 0 ? E.rcLivre / patrimonioRc : null,
      mundos: mundos.sort((a, b) => b.valorRc - a.valorRc),
      itens: itens.sort((a, b) => b.valorRc - a.valorRc),
      semCotacao,
    };
  },

  // Atalho: calcula e avalia hoje
  agora() {
    const E = Motor.calcular();
    return { E, A: Motor.avaliar(E) };
  },

  // Data do primeiro lançamento (ou null se não há nada)
  primeiraData(eventos) {
    eventos = eventos || Motor.eventos();
    return eventos.length ? eventos[0].data : null;
  },

  // Patrimônio no fim de cada dia (para gráficos e fechamentos), a partir do primeiro lançamento
  serieDiaria(dias, ateData) {
    const eventos = Motor.eventos();
    const fim = ateData || Formato.hoje();
    const inicio = Motor.primeiraData(eventos);
    const serie = [];
    if (!inicio) return serie;
    for (let i = dias - 1; i >= 0; i--) {
      const d = Datas.somar(fim, -i);
      if (d < inicio) continue;
      const A = Motor.avaliar(Motor.calcular(d, eventos), d);
      serie.push({ data: d, patrimonioRc: A.patrimonioRc, capitalRc: A.capitalRc, resultadoRc: A.resultadoRc });
    }
    return serie;
  },

  // Estatísticas das recompras (cada recompra fechada é um "trade")
  metricas(E, deData) {
    const trades = E.realizados.filter((r) => !deData || r.data >= deData);
    const ganhos = trades.filter((t) => t.rc > 0.0001);
    const perdas = trades.filter((t) => t.rc < -0.0001);
    const soma = (l) => l.reduce((s, t) => s + t.rc, 0);
    const mediaGanho = ganhos.length ? soma(ganhos) / ganhos.length : null;
    const mediaPerda = perdas.length ? soma(perdas) / perdas.length : null;
    const taxasRc = E.taxas.filter((t) => !deData || t.data >= deData).reduce((s, t) => s + t.rc, 0);
    return {
      total: trades.length,
      acerto: trades.length ? ganhos.length / trades.length : null,
      mediaGanho, mediaPerda,
      payoff: mediaGanho && mediaPerda ? mediaGanho / Math.abs(mediaPerda) : null,
      expectativa: trades.length ? soma(trades) / trades.length : null,
      fatorLucro: perdas.length ? soma(ganhos) / Math.abs(soma(perdas)) : null,
      maiorGanho: ganhos.length ? Math.max(...ganhos.map((t) => t.rc)) : null,
      maiorPerda: perdas.length ? Math.min(...perdas.map((t) => t.rc)) : null,
      pesoTaxas: soma(ganhos) > 0 ? taxasRc / soma(ganhos) : null,
    };
  },

  // Maior queda do patrimônio (do pico até o fundo) numa série
  quedaMaxima(serie) {
    let pico = -Infinity, queda = 0;
    for (const p of serie) {
      pico = Math.max(pico, p.resultadoRc);
      queda = Math.min(queda, p.resultadoRc - pico);
    }
    return queda;
  },
};
