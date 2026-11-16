// calculos.js — a matemática pura do RC Trade.
//
// REGRAS DESTE ARQUIVO:
//   • Nenhuma função aqui lê ou grava dados. Entra número, sai número.
//     É isso que permite testar tudo com "npm test".
//   • UNIDADES NATURAIS: RC inteiro (1500 = 1500 RC) e gold inteiro
//     (1 kk = 1000000). A conversão de/para décimos é feita só pelo
//     armazenamento.js, nunca aqui.
//   • Arredondar só no fim (ao salvar ou ao exibir), nunca no meio da conta.

// Taxa do market do RubinOT: 5% paga por quem CRIA a oferta.
export const TAXA_MARKET = 0.05;

// ---------------------------------------------------------------
// 1. Taxa e equilíbrio da recompra
// ---------------------------------------------------------------

// Taxa paga em gold ao criar uma oferta.
// Confirmado no jogo (nov/2026): 25 RC a 70.002 dá 87.502,5 na conta e o
// RubinOT cobra 87.503, ou seja, arredonda (não trunca).
// Falta separar round de ceil: 25 RC a 70.001 dá 87.501,25 na conta.
//   cobrou 87.501 = round (certo) | cobrou 87.502 = ceil (trocar aqui)
export function taxaCriacao(qtdRc, precoUnitario) {
  return Math.round(qtdRc * precoUnitario * TAXA_MARKET);
}

// Você vendeu RC a "precoVenda" criando oferta (pagou 5%).
// Até que preço dá para recomprar ACEITANDO uma oferta (sem taxa) e empatar.
export function equilibrioAceitando(precoVenda) {
  return precoVenda * (1 - TAXA_MARKET);
}

// O mesmo, mas recomprando CRIANDO oferta (paga 5% de novo).
export function equilibrioCriando(precoVenda) {
  return (precoVenda * (1 - TAXA_MARKET)) / (1 + TAXA_MARKET);
}

// ---------------------------------------------------------------
// 2. Quanto vale o que você tem (marcação a mercado)
// ---------------------------------------------------------------

// Preço justo: o meio entre a melhor compra e a melhor venda.
// Usado no GRÁFICO, porque não balança quando só o spread abre ou fecha.
export function precoMedio(melhorCompra, melhorVenda) {
  if (melhorCompra == null || melhorVenda == null) return null;
  return (melhorCompra + melhorVenda) / 2;
}

// Gold que você receberia vendendo RC AGORA (quem compra paga a "melhor compra").
export function liquidarRc(qtdRc, melhorCompra) {
  if (!melhorCompra) return null;
  return qtdRc * melhorCompra;
}

// RC que você receberia comprando AGORA com o seu gold
// (você paga a "melhor venda"). É assim que o gold de um mundo vira RC.
export function liquidarGold(gold, melhorVenda) {
  if (!melhorVenda) return null;
  return gold / melhorVenda;
}

// Preço base do mundo: a cotação em que a recompra empata.
// gold ÷ quanto RC esse gold custou. Acima disso você perde, abaixo você ganha.
export function precoBase(gold, custoRc) {
  if (!custoRc) return null;
  return gold / custoRc;
}

// ---------------------------------------------------------------
// 3. Média móvel exponencial (EMA)
// ---------------------------------------------------------------

// Um passo da EMA, ponderado pelo tempo.
// "dias" é a distância até a cotação anterior: com 1 dia o peso é o normal;
// com 5 dias de ausência o preço novo pesa mais, porque o antigo já envelheceu.
export function emaPasso(precoAtual, emaAnterior, dias = 1, periodos = 7) {
  const k = 2 / (periodos + 1);
  const kEfetivo = 1 - Math.pow(1 - k, dias);
  return precoAtual * kEfetivo + emaAnterior * (1 - kEfetivo);
}

// EMA de uma série de pontos [{ data: "2026-11-15", preco: 74000 }, ...].
// Esquenta com a média simples dos primeiros "periodos" pontos.
// Devolve null enquanto não houver pontos suficientes.
export function emaSerie(pontos, periodos = 7) {
  if (!Array.isArray(pontos) || pontos.length < periodos) return null;

  const ordenados = [...pontos].sort((a, b) => a.data.localeCompare(b.data));
  const inicio = ordenados.slice(0, periodos);
  let ema = inicio.reduce((soma, p) => soma + p.preco, 0) / periodos;

  for (let i = periodos; i < ordenados.length; i++) {
    const dias = diasEntre(ordenados[i - 1].data, ordenados[i].data);
    ema = emaPasso(ordenados[i].preco, ema, dias, periodos);
  }
  return ema;
}

// Quantos dias separam duas datas "2026-11-15". Mínimo 1.
export function diasEntre(dataA, dataB) {
  const ms = Date.parse(`${dataB}T00:00:00Z`) - Date.parse(`${dataA}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86400000));
}

// ---------------------------------------------------------------
// 4. Z-Score: a cotação de agora está fora do normal?
// ---------------------------------------------------------------

export function desvioPadrao(valores) {
  if (!valores || valores.length < 2) return 0;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const soma = valores.reduce((s, v) => s + (v - media) ** 2, 0);
  return Math.sqrt(soma / (valores.length - 1)); // amostral
}

// Quantos desvios o preço está longe da média.
// Z menor que -2: muito barato. Z maior que +2: muito caro.
export function zScore(precoAtual, media, desvio) {
  if (!desvio) return 0;
  return (precoAtual - media) / desvio;
}

// Só confiar no Z-Score com histórico suficiente daquele mundo/item.
export const MINIMO_COTACOES_ZSCORE = 20;

export function temHistoricoParaZScore(quantasCotacoes) {
  return quantasCotacoes >= MINIMO_COTACOES_ZSCORE;
}

// ---------------------------------------------------------------
// 5. Tamanho da operação
// ---------------------------------------------------------------

// Reserva mínima: manter 40% do patrimônio em RC livre.
// É o balizador principal, e não depende de estimativa nenhuma.
export const RESERVA_MINIMA = 0.4;

// Quanto RC dá para usar numa operação sem furar a reserva.
export function rcDisponivelParaOperar(patrimonioRc, rcLivre, reserva = RESERVA_MINIMA) {
  return Math.max(0, rcLivre - patrimonioRc * reserva);
}

// Half-Kelly: sugestão de % do caixa, baseada no seu próprio histórico.
// Só exibir depois de MINIMO_TRADES_KELLY operações fechadas: com poucos
// trades, um acerto a mais ou a menos muda muito a recomendação.
export const MINIMO_TRADES_KELLY = 30;

export function kellyMeio(probAcerto, mediaGanho, mediaPerda) {
  const perda = Math.abs(mediaPerda);
  if (!perda || !mediaGanho) return 0;
  const riscoRetorno = mediaGanho / perda;
  const kelly = probAcerto - (1 - probAcerto) / riscoRetorno;
  return Math.max(0, kelly) / 2;
}

export function temHistoricoParaKelly(quantosTrades) {
  return quantosTrades >= MINIMO_TRADES_KELLY;
}

// ---------------------------------------------------------------
// 6. Arredondamento (só na borda: ao salvar ou ao exibir)
// ---------------------------------------------------------------

export function arredondarGold(gold) {
  return Math.round(gold);
}

// RC é guardado em décimos, então o menor pedaço é 0,1 RC.
export function arredondarRc(rc) {
  return Math.round(rc * 10) / 10;
}
