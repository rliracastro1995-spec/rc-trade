// importar-legado.js — "tradutor" dos dados do app antigo para o formato novo.
// Não lê nem grava nada: recebe o objeto antigo e devolve o novo.
// Assim dá para testar a conversão sem mexer nos dados de verdade.

import { CONFIG_PADRAO, criarEstadoInicial } from "./estado-inicial.js";

// ---------- Conversões de unidade ----------
// No app antigo RC era guardado "inteiro" (25 RC = 25).
// No novo é guardado em décimos (25 RC = 250). Gold não muda.
const rcParaDecimos = (rc) => Math.round((rc ?? 0) * 10);
const reaisParaCentavos = (reais) => (reais == null ? null : Math.round(reais * 100));

// Tipos de movimento cujo "qtd" é RC (os outros são gold)
const MOVIMENTOS_EM_RC = ["rc-entrada", "rc-saida", "ajuste-rc"];

// ---------- Conversão de cada lista ----------
function converterCotacoes(cotacoes) {
  const rc = [];
  const itens = [];

  for (const c of cotacoes) {
    const base = {
      id: c.id,
      data: c.data,
      turno: c.periodo,
      mundoId: c.mundoId,
      compra: c.compra ?? null,
      venda: c.venda ?? null,
      criadoEm: c.criadoEm,
    };
    // No app antigo, cotação de item e de RC ficavam juntas
    if (c.itemId === "rc") rc.push(base);
    else itens.push({ ...base, itemId: c.itemId });
  }

  return { cotacoes: rc, precosItens: itens };
}

function converterOferta(o) {
  return {
    id: o.id,
    data: o.data,
    turno: o.periodo,
    mundoId: o.mundoId,
    tipo: o.tipo,              // "compra" | "venda"
    qtd: rcParaDecimos(o.qtd), // RC em décimos
    preco: o.preco,            // gold por 1 RC
    teveTaxa: Boolean(o.teveTaxa),
    taxa: o.taxa ?? 0,         // gold
    status: o.status,
    canceladaData: o.canceladaData ?? null,
    canceladaTurno: o.canceladaPeriodo ?? null,
    canceladaEm: o.canceladaEm ?? null,
    nota: o.nota ?? "",
    criadoEm: o.criadoEm,
  };
}

function converterExecucao(x) {
  return {
    id: x.id,
    ofertaId: x.ofertaId,
    data: x.data,
    turno: x.periodo,
    qtd: rcParaDecimos(x.qtd),
    criadoEm: x.criadoEm,
  };
}

function converterMovimento(m) {
  const emRc = MOVIMENTOS_EM_RC.includes(m.tipo);
  return {
    id: m.id,
    data: m.data,
    turno: m.periodo,
    tipo: m.tipo,
    mundoId: m.mundoId ?? null,
    qtd: emRc ? rcParaDecimos(m.qtd) : m.qtd, // RC em décimos ou gold
    valorRc: m.valorRc == null ? null : rcParaDecimos(m.valorRc),
    valorCentavos: reaisParaCentavos(m.valorReais),
    nota: m.nota ?? "",
    criadoEm: m.criadoEm,
  };
}

function converterLancamentoItem(l) {
  return {
    id: l.id,
    data: l.data,
    turno: l.periodo,
    mundoId: l.mundoId,
    itemId: l.itemId,
    tipo: l.tipo,   // "compra" | "venda" | "consumo"
    qtd: l.qtd,     // unidades do item
    preco: l.preco, // gold por unidade
    teveTaxa: Boolean(l.teveTaxa),
    taxa: l.taxa ?? 0,
    nota: l.nota ?? "",
    criadoEm: l.criadoEm,
  };
}

// ---------- Função principal ----------
// Devolve { estado, resumo }. O resumo diz quanto de cada coisa foi importado.
export function converterLegado(antigo) {
  if (!antigo || !Array.isArray(antigo.mundos) || !Array.isArray(antigo.cotacoes)) {
    throw new Error("Não encontrei dados válidos do app antigo.");
  }

  const novo = criarEstadoInicial();
  const cfg = antigo.config ?? {};

  novo.config = {
    ...CONFIG_PADRAO,
    taxaOferta: cfg.taxa ?? CONFIG_PADRAO.taxaOferta,
    reaisPorRc: cfg.rcEmReais ?? CONFIG_PADRAO.reaisPorRc,
  };

  novo.mundos = antigo.mundos.map((m) => ({ id: m.id, nome: m.nome, ativo: m.ativo !== false }));
  novo.itens = (antigo.itens ?? []).filter((i) => i.id !== "rc").map((i) => ({ id: i.id, nome: i.nome }));

  const { cotacoes, precosItens } = converterCotacoes(antigo.cotacoes);
  novo.cotacoes = cotacoes;
  novo.precosItens = precosItens;
  novo.ofertas = (antigo.ofertas ?? []).map(converterOferta);
  novo.execucoes = (antigo.execucoes ?? []).map(converterExecucao);
  novo.movimentos = (antigo.movimentos ?? []).map(converterMovimento);
  novo.lancamentosItens = (antigo.lancamentosItens ?? []).map(converterLancamentoItem);

  // Os fechamentos antigos eram diários e com outro formato:
  // ficam guardados como estavam, só para consulta.
  novo.fechamentosLegado = antigo.fechamentos ?? [];

  const resumo = {
    cotacoes: novo.cotacoes.length,
    precosItens: novo.precosItens.length,
    ofertas: novo.ofertas.length,
    execucoes: novo.execucoes.length,
    movimentos: novo.movimentos.length,
    itens: novo.itens.length,
    lancamentosItens: novo.lancamentosItens.length,
    fechamentosLegado: novo.fechamentosLegado.length,
  };

  return { estado: novo, resumo };
}
