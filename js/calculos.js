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
