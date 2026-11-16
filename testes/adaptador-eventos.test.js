// adaptador-eventos.test.js — prova que a ponte entrega ao motor a linha
// do tempo certa: unidades convertidas e eventos em ordem.
// Rodar com:  npm test

import test from "node:test";
import assert from "node:assert/strict";

import { gerarLinhaDoTempo } from "../site/js/dados/adaptador-eventos.js";
import { converterLegado } from "../site/js/dados/importar-legado.js";
import { calcularCarteira } from "../site/js/motor/carteira.js";

const tipos = (eventos) => eventos.map((e) => e.tipo);

// Estado guardado: entrou 1.500 RC, criou venda, 2 execuções parciais, cancelou.
// As listas estão FORA de ordem de propósito.
const CICLO_COMPLETO = {
  execucoes: [
    { id: "x2", ofertaId: "o1", data: "2026-11-04", turno: "tarde", qtd: 3000, criadoEm: 400 },
    { id: "x1", ofertaId: "o1", data: "2026-11-03", turno: "noite", qtd: 2000, criadoEm: 300 },
  ],
  ofertas: [
    {
      id: "o1", data: "2026-11-02", turno: "manha", mundoId: "auroria", tipo: "venda",
      qtd: 15000, preco: 75000, teveTaxa: true, taxa: 5_625_000,
      status: "cancelada", canceladaData: "2026-11-05", canceladaTurno: "manha", canceladaEm: 500,
      criadoEm: 200,
    },
  ],
  movimentos: [
    { id: "m2", data: "2026-11-01", turno: "manha", tipo: "gold-entrada", mundoId: "auroria", qtd: 6_000_000, valorRc: 800, criadoEm: 110 },
    { id: "m1", data: "2026-11-01", turno: "manha", tipo: "rc-entrada", mundoId: null, qtd: 15000, criadoEm: 100 },
  ],
};

// ---------------------------------------------------------------
test("15000 décimos guardados viram um evento de 1.500 RC", () => {
  const eventos = gerarLinhaDoTempo(CICLO_COMPLETO);
  const entrada = eventos.find((e) => e.tipo === "rc-entrada");
  const criada = eventos.find((e) => e.tipo === "oferta-criada");
  assert.equal(entrada.qtd, 1500);
  assert.equal(criada.qtd, 1500);
});

test("execuções também saem em RC natural", () => {
  const execs = gerarLinhaDoTempo(CICLO_COMPLETO).filter((e) => e.tipo === "oferta-executada");
  assert.deepEqual(execs.map((e) => e.qtd), [200, 300]);
});

test("gold passa direto; o custo do gold (em décimos) vira RC natural", () => {
  const entrada = gerarLinhaDoTempo(CICLO_COMPLETO).find((e) => e.tipo === "gold-entrada");
  assert.equal(entrada.gold, 6_000_000);
  assert.equal(entrada.custoRc, 80);
  assert.equal(entrada.mundoId, "auroria");
});

test("preço e taxa da oferta não são convertidos (já são gold)", () => {
  const criada = gerarLinhaDoTempo(CICLO_COMPLETO).find((e) => e.tipo === "oferta-criada");
  assert.equal(criada.preco, 75000);
  assert.equal(criada.taxa, 5_625_000);
  assert.equal(criada.lado, "venda");
});

// ---------------------------------------------------------------
test("oferta com 2 execuções e cancelada gera 4 eventos, em ordem", () => {
  const daOferta = gerarLinhaDoTempo(CICLO_COMPLETO).filter((e) => e.ofertaId === "o1");
  assert.deepEqual(tipos(daOferta), [
    "oferta-criada",
    "oferta-executada",
    "oferta-executada",
    "oferta-cancelada",
  ]);
});

test("dados fora de ordem saem em ordem no tempo", () => {
  const eventos = gerarLinhaDoTempo(CICLO_COMPLETO);
  assert.deepEqual(tipos(eventos), [
    "rc-entrada",
    "gold-entrada",
    "oferta-criada",
    "oferta-executada",
    "oferta-executada",
    "oferta-cancelada",
  ]);
  assert.deepEqual(eventos.map((e) => e.data), [
    "2026-11-01", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
  ]);
});

test("no mesmo dia: manhã antes de tarde, tarde antes de noite", () => {
  const eventos = gerarLinhaDoTempo({
    movimentos: [
      { id: "n", data: "2026-11-01", turno: "noite", tipo: "rc-entrada", qtd: 10, criadoEm: 1 },
      { id: "m", data: "2026-11-01", turno: "manha", tipo: "rc-entrada", qtd: 10, criadoEm: 3 },
      { id: "t", data: "2026-11-01", turno: "tarde", tipo: "rc-entrada", qtd: 10, criadoEm: 2 },
    ],
  });
  assert.deepEqual(eventos.map((e) => e.turno), ["manha", "tarde", "noite"]);
});

test("lançamento atrasado: vale o dia do trade, não o dia em que foi digitado", () => {
  const eventos = gerarLinhaDoTempo({
    movimentos: [
      { id: "hoje", data: "2026-11-10", turno: "manha", tipo: "rc-entrada", qtd: 10, criadoEm: 100 },
      // digitado depois (criadoEm maior), mas aconteceu no dia 05
      { id: "atrasado", data: "2026-11-05", turno: "manha", tipo: "rc-entrada", qtd: 10, criadoEm: 999 },
    ],
  });
  assert.deepEqual(eventos.map((e) => e.origemId), ["atrasado", "hoje"]);
});

test("empate total: a entrada de saldo vem antes da oferta que gasta", () => {
  const eventos = gerarLinhaDoTempo({
    ofertas: [
      { id: "o1", data: "2026-11-01", turno: "manha", mundoId: "auroria", tipo: "venda", qtd: 1000, preco: 74000, teveTaxa: false, status: "aberta", criadoEm: 100 },
    ],
    movimentos: [
      { id: "m1", data: "2026-11-01", turno: "manha", tipo: "rc-entrada", qtd: 1000, criadoEm: 100 },
    ],
  });
  assert.deepEqual(tipos(eventos), ["rc-entrada", "oferta-criada"]);
});

test("cancelamento sem horário registrado vai para o fim do turno dele", () => {
  const eventos = gerarLinhaDoTempo({
    ofertas: [
      { id: "o1", data: "2026-11-01", turno: "manha", mundoId: "auroria", tipo: "venda", qtd: 1000, preco: 74000, teveTaxa: true, status: "cancelada", canceladaData: "2026-11-02", canceladaTurno: "tarde", criadoEm: 100 },
    ],
    execucoes: [
      { id: "x1", ofertaId: "o1", data: "2026-11-02", turno: "tarde", qtd: 400, criadoEm: 900 },
    ],
  });
  assert.deepEqual(tipos(eventos), ["oferta-criada", "oferta-executada", "oferta-cancelada"]);
});

test("oferta expirada gera o evento de expiração", () => {
  const eventos = gerarLinhaDoTempo({
    ofertas: [
      { id: "o1", data: "2026-11-01", turno: "manha", mundoId: "auroria", tipo: "venda", qtd: 250, preco: 74000, teveTaxa: true, status: "expirada", canceladaData: "2026-12-01", canceladaTurno: "manha", criadoEm: 1 },
    ],
  });
  assert.deepEqual(tipos(eventos), ["oferta-criada", "oferta-expirada"]);
});

test("oferta aberta ou concluída não gera evento de encerramento", () => {
  const eventos = gerarLinhaDoTempo({
    ofertas: [
      { id: "a", data: "2026-11-01", turno: "manha", mundoId: "auroria", tipo: "venda", qtd: 250, preco: 74000, teveTaxa: true, status: "aberta", criadoEm: 1 },
      { id: "b", data: "2026-11-01", turno: "manha", mundoId: "auroria", tipo: "venda", qtd: 250, preco: 74000, teveTaxa: true, status: "concluida", criadoEm: 2 },
    ],
  });
  assert.deepEqual(tipos(eventos), ["oferta-criada", "oferta-criada"]);
});

// ---------------------------------------------------------------
test("estado vazio ou sem listas devolve linha do tempo vazia", () => {
  assert.deepEqual(gerarLinhaDoTempo({}), []);
  assert.deepEqual(gerarLinhaDoTempo(null), []);
});

test("a ponte não altera o estado que recebe", () => {
  const copia = JSON.stringify(CICLO_COMPLETO);
  gerarLinhaDoTempo(CICLO_COMPLETO);
  assert.equal(JSON.stringify(CICLO_COMPLETO), copia);
});

// ---------------------------------------------------------------
test("PONTA A PONTA: estado guardado → ponte → motor dá a carteira certa", () => {
  const carteira = calcularCarteira(gerarLinhaDoTempo(CICLO_COMPLETO));

  assert.deepEqual(carteira.alertas, []);
  assert.equal(carteira.rcLivre, 1000);     // 1.500 − 500 vendidos
  assert.equal(carteira.rcBloqueado, 0);    // o restante voltou no cancelamento
  assert.equal(carteira.ofertas.o1.status, "cancelada");
  assert.equal(carteira.ofertas.o1.executado, 500);
  // gold: 6kk que já tinha − taxa de 5,625kk + 500 RC × 75k
  assert.equal(carteira.mundos.auroria.gold, 6_000_000 - 5_625_000 + 500 * 75000);
  assert.equal(carteira.mundos.auroria.custoRc, 80 + 500);
});

test("PONTA A PONTA: backup do app antigo → importador → ponte → motor", () => {
  // Formato do app antigo: RC "inteiro" e campo "periodo"
  const antigo = {
    versao: 2,
    config: { taxa: 0.05, rcEmReais: 0.1 },
    mundos: [{ id: "auroria", nome: "Auroria", ativo: true }],
    itens: [{ id: "rc", nome: "Rubini Coin" }],
    cotacoes: [],
    movimentos: [
      { id: "m1", data: "2026-11-01", periodo: "manha", tipo: "rc-entrada", mundoId: null, qtd: 1000, valorReais: 100, criadoEm: 10 },
      { id: "m2", data: "2026-11-01", periodo: "manha", tipo: "gold-entrada", mundoId: "auroria", qtd: 4_000_000, valorRc: 55, criadoEm: 20 },
    ],
    ofertas: [
      { id: "v1", data: "2026-11-02", periodo: "tarde", mundoId: "auroria", tipo: "venda", qtd: 1000, preco: 74000, teveTaxa: true, taxa: 3_700_000, status: "concluida", criadoEm: 30 },
      // aceitou uma oferta de venda do market: sem taxa, executa na hora
      { id: "c1", data: "2026-11-05", periodo: "noite", mundoId: "auroria", tipo: "compra", qtd: 1000, preco: 70000, teveTaxa: false, taxa: 0, status: "concluida", criadoEm: 50 },
    ],
    execucoes: [
      { id: "x1", ofertaId: "v1", data: "2026-11-03", periodo: "manha", qtd: 1000, criadoEm: 40 },
      { id: "x2", ofertaId: "c1", data: "2026-11-05", periodo: "noite", qtd: 1000, criadoEm: 51 },
    ],
    lancamentosItens: [],
    fechamentos: [],
  };

  const { estado } = converterLegado(antigo);
  const carteira = calcularCarteira(gerarLinhaDoTempo(estado));

  assert.deepEqual(carteira.alertas, []);
  assert.equal(carteira.rcLivre, 1000);
  assert.equal(carteira.mundos.auroria.gold, 4_300_000);
  // gold usado: 70kk dos 74,3kk que custaram 1.055 RC
  const custoUsado = (1055 * 70) / 74.3;
  assert.ok(Math.abs(carteira.realizadoRc - (1000 - custoUsado)) < 1e-6);
});
