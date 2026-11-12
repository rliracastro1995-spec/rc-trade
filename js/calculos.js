// calculos.js — contas sobre as cotações (não mexe em tela)

const ORDEM_PERIODO = { manha: 0, tarde: 1, noite: 2 };

// Número que ordena data + período: "2026-11-11" noite → 20261111.2
function momento(data, periodo) {
  return Number(data.replace(/-/g, "")) + ORDEM_PERIODO[periodo] / 10;
}

function diasEntre(dataA, dataB) {
  return Math.round((new Date(dataB + "T12:00") - new Date(dataA + "T12:00")) / 86400000);
}

const Calculos = {
  // Cotações de um mundo/item, da mais antiga para a mais nova
  serie(mundoId, itemId) {
    return Dados.cotacoes()
      .filter((c) => c.mundoId === mundoId && c.itemId === itemId)
      .sort((a, b) => momento(a.data, a.periodo) - momento(b.data, b.periodo));
  },

  // Última cotação que existe (qualquer data)
  ultima(mundoId, itemId) {
    const s = Calculos.serie(mundoId, itemId);
    return s.length ? s[s.length - 1] : null;
  },

  // Último valor preenchido de um campo ("venda" ou "compra"), pulando cotações em que ficou em branco.
  // Se data/periodo forem informados, só olha o que veio antes desse momento.
  ultimoValor(mundoId, itemId, campo, data, periodo) {
    const limite = data ? momento(data, periodo) : Infinity;
    const s = Calculos.serie(mundoId, itemId).filter((c) => c[campo] !== null && momento(c.data, c.periodo) < limite);
    return s.length ? s[s.length - 1][campo] : null;
  },

  // Média do preço de venda nos 7 dias antes da data (sem contar a própria data)
  media7Dias(mundoId, itemId, data) {
    const valores = Calculos.serie(mundoId, itemId)
      .filter((c) => {
        const d = diasEntre(c.data, data);
        return d >= 1 && d <= 7 && c.venda !== null;
      })
      .map((c) => c.venda);
    if (!valores.length) return null;
    return valores.reduce((s, v) => s + v, 0) / valores.length;
  },

  // Última cotação de venda (melhor oferta de venda = preço para comprar RC) até o fim de uma data.
  // Sem data = a mais recente que existe. Devolve null se nunca foi cotado.
  cotacaoAte(mundoId, itemId, data, campo = "venda") {
    const s = Calculos.serie(mundoId, itemId).filter((c) => c[campo] !== null && (!data || c.data <= data));
    return s.length ? s[s.length - 1][campo] : null;
  },

  // Variação: 74000 contra 77000 → -0,039
  variacao(atual, anterior) {
    if (atual === null || anterior === null || anterior === undefined || !anterior) return null;
    return atual / anterior - 1;
  },

  // Diferença entre venda e compra, em % da venda (o "spread")
  spread(venda, compra) {
    if (venda === null || compra === null || !venda) return null;
    return (venda - compra) / venda;
  },
};

// ----- Datas -----
const Datas = {
  // "2026-11-11" + 3 → "2026-11-14"
  somar(iso, dias) {
    const d = new Date(iso + "T12:00");
    d.setDate(d.getDate() + dias);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  // Segunda-feira da semana da data
  inicioSemana(iso) {
    const d = new Date(iso + "T12:00");
    const diaSemana = (d.getDay() + 6) % 7; // segunda = 0
    return Datas.somar(iso, -diaSemana);
  },
  mes(iso) {
    return iso.slice(0, 7);
  },
  nomeMes(chave) {
    const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const [a, m] = chave.split("-");
    return nomes[Number(m) - 1] + "/" + a.slice(2);
  },
  ultimoDiaMes(chave) {
    const [a, m] = chave.split("-").map(Number);
    const d = new Date(a, m, 0);
    return chave + "-" + String(d.getDate()).padStart(2, "0");
  },
};
