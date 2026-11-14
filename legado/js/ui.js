// ui.js — pedaços de tela reaproveitados em várias páginas

const UI = {
  opcoesMundos(selecionado, todos = false) {
    const lista = todos ? Dados.mundos() : Dados.mundosParaRonda();
    return lista
      .map((m) => `<option value="${m.id}" ${m.id === selecionado ? "selected" : ""}>${m.nome}${m.posicao ? " ●" : ""}</option>`)
      .join("");
  },

  opcoesItens(selecionado, semRc = false) {
    return Dados.itens()
      .filter((i) => !semRc || i.id !== "rc")
      .map((i) => `<option value="${i.id}" ${i.id === selecionado ? "selected" : ""}>${Formato.esc(i.nome)}</option>`)
      .join("");
  },

  // Campo de data + período (manhã/tarde/noite), já preenchidos com agora
  dataPeriodo(prefixo, data, periodo) {
    data = data || Formato.hoje();
    periodo = periodo || Formato.periodoAgora();
    const ops = ["manha", "tarde", "noite"]
      .map((p) => `<option value="${p}" ${p === periodo ? "selected" : ""}>${Formato.nomePeriodo[p]}</option>`)
      .join("");
    return `<input type="date" id="${prefixo}-data" value="${data}">
            <select id="${prefixo}-periodo">${ops}</select>`;
  },
  lerDataPeriodo(raiz, prefixo) {
    return {
      data: raiz.querySelector(`#${prefixo}-data`).value || Formato.hoje(),
      periodo: raiz.querySelector(`#${prefixo}-periodo`).value,
    };
  },

  // +12 RC  /  −3,5 RC
  rc(v, casas = 0, comSinal = true) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    const sinal = comSinal ? (v > 0.0001 ? "+" : v < -0.0001 ? "−" : "") : v < 0 ? "−" : "";
    return sinal + Formato.numero(Math.abs(v), casas) + " RC";
  },
  reais(rc) {
    if (rc === null || rc === undefined || isNaN(rc)) return "—";
    return "R$ " + Formato.numero(rc * Dados.config().rcEmReais, 2);
  },
  kk(gold) {
    if (gold === null || gold === undefined || isNaN(gold)) return "—";
    return (gold < 0 ? "−" : "") + Formato.curto(Math.abs(gold));
  },
  // classe de cor para lucro/prejuízo
  cor(v) {
    if (v === null || v === undefined || isNaN(v)) return "fraco";
    return v > 0.0001 ? "lucro" : v < -0.0001 ? "prejuizo" : "fraco";
  },

  cartao(rotulo, valor, sub = "", classe = "") {
    return `<div class="cartao"><div class="rotulo">${rotulo}</div>
            <div class="valor ${classe}">${valor}</div>
            ${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
  },

  barraProgresso(parte, total) {
    const p = total > 0 ? Math.max(0, Math.min(100, (parte / total) * 100)) : 0;
    return `<div class="barra"><div style="width:${p}%"></div></div>`;
  },

  // Botão que pede um segundo clique para confirmar (sem janelas de confirmação)
  confirmar(botao, acao, texto = "Confirmar?") {
    const original = botao.textContent;
    botao.addEventListener("click", () => {
      if (botao.dataset.confirmar) {
        acao();
      } else {
        botao.dataset.confirmar = "1";
        botao.textContent = texto;
        setTimeout(() => {
          delete botao.dataset.confirmar;
          botao.textContent = original;
        }, 3000);
      }
    });
  },

  // Gráfico de linha simples em SVG. pontos = [{ rotulo, valor }]
  linha(pontos, { altura = 180, formato = (v) => Formato.numero(v) } = {}) {
    const vals = pontos.map((p) => p.valor).filter((v) => v !== null && !isNaN(v));
    if (vals.length < 2) return `<div class="vazio">Ainda não há dias suficientes para o gráfico.</div>`;
    const W = 1000, H = altura, m = { e: 64, d: 12, t: 12, b: 26 };
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 1) { max += 1; min -= 1; }
    const pad = (max - min) * 0.1; min -= pad; max += pad;
    const x = (i) => m.e + (i / (pontos.length - 1)) * (W - m.e - m.d);
    const y = (v) => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
    const caminho = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
    const area = `${caminho} L${x(pontos.length - 1)},${H - m.b} L${x(0)},${H - m.b} Z`;
    const marcas = [min + pad, (min + max) / 2, max - pad];
    const passo = Math.max(1, Math.ceil(pontos.length / 8));
    return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img">
      ${marcas.map((v) => `<line x1="${m.e}" x2="${W - m.d}" y1="${y(v)}" y2="${y(v)}" class="grade"/>
        <text x="${m.e - 8}" y="${y(v) + 4}" text-anchor="end">${formato(v)}</text>`).join("")}
      <path d="${area}" class="area"/>
      <path d="${caminho}" class="traco"/>
      ${pontos.map((p, i) => ((i % passo === 0 && pontos.length - 1 - i >= passo / 2) || i === pontos.length - 1)
        ? `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}">${p.rotulo}</text>` : "").join("")}
      <circle cx="${x(pontos.length - 1)}" cy="${y(pontos[pontos.length - 1].valor)}" r="5" class="ponto"/>
    </svg>`;
  },

  // Barras positivas/negativas. itens = [{ rotulo, valor }]
  barras(itens, { altura = 170, formato = (v) => Formato.numero(v) } = {}) {
    if (!itens.length) return `<div class="vazio">Sem dados no período.</div>`;
    const W = 1000, H = altura + 14, m = { e: 10, d: 10, t: 22, b: 40 };
    const maxAbs = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
    const zero = m.t + (H - m.t - m.b) / 2;
    const meia = (H - m.t - m.b) / 2;
    const larg = (W - m.e - m.d) / itens.length;
    return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img">
      <line x1="${m.e}" x2="${W - m.d}" y1="${zero}" y2="${zero}" class="grade"/>
      ${itens.map((it, i) => {
        const h = (Math.abs(it.valor) / maxAbs) * meia;
        const lb = Math.min(larg * 0.6, 90);
        const xb = m.e + i * larg + (larg - lb) / 2;
        const yb = it.valor >= 0 ? zero - h : zero;
        const ty = it.valor >= 0 ? yb - 6 : yb + h + 14;
        return `<rect x="${xb}" y="${yb}" width="${lb}" height="${Math.max(1, h)}" rx="3" class="${it.valor >= 0 ? "pos" : "neg"}"/>
          ${it.valor ? `<text x="${xb + lb / 2}" y="${ty}" text-anchor="middle">${formato(it.valor)}</text>` : ""}
          <text x="${xb + lb / 2}" y="${H - 6}" text-anchor="middle">${it.rotulo}</text>`;
      }).join("")}
    </svg>`;
  },
};
