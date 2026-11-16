// cotacoes.js — pega a cotação mais recente de cada mundo e de cada item.
// O motor da carteira precisa disso para avaliar o patrimônio.
// Só lê listas e devolve objetos: não calcula dinheiro.

import { compararMomento } from "../nucleo/tempo.js";

// Guarda sempre o lançamento mais recente de cada chave.
function maisRecentePorChave(lista, chaveDe) {
  const mapa = {};
  for (const linha of lista ?? []) {
    const chave = chaveDe(linha);
    const atual = mapa[chave];
    if (!atual || compararMomento(atual, linha) <= 0) mapa[chave] = linha;
  }
  return mapa;
}

// { mundoId: { compra, venda, data, turno } }
export function ultimaCotacaoPorMundo(cotacoes) {
  const mapa = maisRecentePorChave(cotacoes, (c) => c.mundoId);
  const saida = {};
  for (const [mundoId, c] of Object.entries(mapa)) {
    saida[mundoId] = { compra: c.compra, venda: c.venda, data: c.data, turno: c.turno };
  }
  return saida;
}

// { mundoId: { itemId: { compra, venda, data, turno } } }
export function ultimoPrecoPorItem(precosItens) {
  const mapa = maisRecentePorChave(precosItens, (p) => `${p.mundoId}|${p.itemId}`);
  const saida = {};
  for (const p of Object.values(mapa)) {
    saida[p.mundoId] ??= {};
    saida[p.mundoId][p.itemId] = { compra: p.compra, venda: p.venda, data: p.data, turno: p.turno };
  }
  return saida;
}
