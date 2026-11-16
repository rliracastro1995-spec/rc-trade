// carteira.test.js — prova que o motor da carteira conta certo.
// Rodar com:  npm test
//
// Cada teste monta uma pequena linha do tempo de eventos, igual a um
// trade real, e confere como a carteira termina.

import test from "node:test";
import assert from "node:assert/strict";

import { calcularCarteira, avaliarCarteira } from "../site/js/motor/carteira.js";

const perto = (recebido, esperado, folga = 1e-6) =>
  assert.ok(
    Math.abs(recebido - esperado) < folga,
    `esperava ${esperado}, recebi ${recebido}`,
  );

// ---------- Eventos prontos, para os testes ficarem curtos ----------
const entradaRc = (data, qtd) => ({ tipo: "rc-entrada", data, qtd });

const criarVenda = (data, ofertaId, mundoId, qtd, preco, teveTaxa = true) => ({
  tipo: "oferta-criada", data, ofertaId, mundoId, lado: "venda", qtd, preco, teveTaxa,
});

const criarCompra = (data, ofertaId, mundoId, qtd, preco, teveTaxa = true) => ({
  tipo: "oferta-criada", data, ofertaId, mundoId, lado: "compra", qtd, preco, teveTaxa,
});

const executar = (data, ofertaId, qtd) => ({ tipo: "oferta-executada", data, ofertaId, qtd });
const cancelar = (data, ofertaId) => ({ tipo: "oferta-cancelada", data, ofertaId });

// História base: entrou 1.000 RC e vendeu tudo em Auroria a 74k (criando oferta).
const VENDEU_1000_A_74K = [
  entradaRc("2026-11-01", 1000),
  criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
  executar("2026-11-03", "v1", 1000),
];

// ---------------------------------------------------------------
test("entrada de RC vira RC livre e capital", () => {
  const c = calcularCarteira([entradaRc("2026-11-01", 1000)]);
  assert.equal(c.rcLivre, 1000);
  assert.equal(c.capitalRc, 1000);
});

test("criar venda bloqueia o RC e cobra a taxa em gold no mundo", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K.slice(0, 2));
  assert.equal(c.rcLivre, 0);
  assert.equal(c.rcBloqueado, 1000);
  assert.equal(c.mundos.auroria.taxasGold, 3_700_000);
  assert.equal(c.mundos.auroria.rcBloqueado, 1000);
  assert.equal(c.ofertas.v1.status, "aberta");
});

test("venda executada: 1.000 RC a 74k deixam 70,3kk que custaram 1.000 RC", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K);
  assert.equal(c.rcLivre, 0);
  assert.equal(c.rcBloqueado, 0);
  assert.equal(c.mundos.auroria.gold, 70_300_000);
  assert.equal(c.mundos.auroria.custoRc, 1000);
  assert.equal(c.ofertas.v1.status, "concluida");
  assert.equal(c.realizadoRc, 0); // vender RC não realiza lucro; recomprar sim
});

test("execução parcial: a oferta continua aberta com o restante", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 1000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 400),
  ]);
  assert.equal(c.ofertas.v1.executado, 400);
  assert.equal(c.ofertas.v1.restante, 600);
  assert.equal(c.ofertas.v1.status, "aberta");
  assert.equal(c.rcBloqueado, 600);
  assert.equal(c.mundos.auroria.custoRc, 400);
});

test("cancelar venda devolve o RC que sobrou, mas a taxa não volta", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 1000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 400),
    cancelar("2026-11-04", "v1"),
  ]);
  assert.equal(c.rcLivre, 600);
  assert.equal(c.rcBloqueado, 0);
  assert.equal(c.ofertas.v1.status, "cancelada");
  assert.equal(c.mundos.auroria.taxasGold, 3_700_000); // taxa cheia, não devolve
  assert.equal(c.mundos.auroria.gold, 400 * 74000 - 3_700_000);
});

test("oferta expirada funciona como cancelada", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 1000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    { tipo: "oferta-expirada", data: "2026-12-02", ofertaId: "v1" },
  ]);
  assert.equal(c.rcLivre, 1000);
  assert.equal(c.ofertas.v1.status, "expirada");
});

// ---------------------------------------------------------------
test("recompra ACEITANDO a 70k (abaixo do preço base) realiza lucro", () => {
  const c = calcularCarteira([
    ...VENDEU_1000_A_74K,
    criarCompra("2026-11-05", "c1", "auroria", 1000, 70000, false), // aceitou: sem taxa
    executar("2026-11-05", "c1", 1000),
  ]);
  // usou 70kk dos 70,3kk; esse gold custou 1000 × 70 ÷ 70,3 = 995,7326 RC
  perto(c.realizadoRc, 1000 - (1000 * 70) / 70.3);
  assert.equal(c.rcLivre, 1000);
  assert.equal(c.mundos.auroria.gold, 300_000); // o troco fica no mundo
  perto(c.mundos.auroria.custoRc, 1000 - (1000 * 70) / 70.3);
  assert.equal(c.mundos.auroria.taxasGold, 3_700_000); // só a taxa da venda
});

test("recompra acima do preço base realiza prejuízo", () => {
  const c = calcularCarteira([
    ...VENDEU_1000_A_74K,
    criarCompra("2026-11-05", "c1", "auroria", 900, 72000, false),
    executar("2026-11-05", "c1", 900),
  ]);
  assert.ok(c.realizadoRc < 0);
});

test("compra CRIANDO oferta: separa o gold, cobra taxa e, cancelada, devolve o gold", () => {
  const antes = calcularCarteira(VENDEU_1000_A_74K);
  const c = calcularCarteira([
    ...VENDEU_1000_A_74K,
    criarCompra("2026-11-05", "c1", "auroria", 500, 66000), // taxa = 1,65kk
    executar("2026-11-06", "c1", 200),
    cancelar("2026-11-07", "c1"),
  ]);
  const taxaCompra = 500 * 66000 * 0.05;
  assert.equal(c.mundos.auroria.taxasGold, 3_700_000 + taxaCompra);
  assert.equal(c.rcLivre, 200);
  // gold final = o que tinha − taxa da compra − gold usado nas 200 RC
  assert.equal(c.mundos.auroria.gold, antes.mundos.auroria.gold - taxaCompra - 200 * 66000);
  assert.equal(c.mundos.auroria.goldBloqueado, 0);
  assert.equal(c.ofertas.c1.status, "cancelada");
});

test("gold preso em oferta de compra aberta aparece como bloqueado no mundo", () => {
  const c = calcularCarteira([
    ...VENDEU_1000_A_74K,
    criarCompra("2026-11-05", "c1", "auroria", 500, 66000),
  ]);
  assert.equal(c.mundos.auroria.goldBloqueado, 500 * 66000);
  assert.ok(c.mundos.auroria.custoRcBloqueado > 0);
});

test("usa a taxa do lançamento quando ela vem informada", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 25),
    { ...criarVenda("2026-11-02", "v1", "auroria", 25, 70002), taxa: 87_503 },
  ]);
  assert.equal(c.mundos.auroria.taxasGold, 87_503);
});

// ---------------------------------------------------------------
test("gold de mundos diferentes nunca se mistura", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 2000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-02", "v1", 1000),
    criarVenda("2026-11-02", "v2", "bellum", 1000, 80000),
    executar("2026-11-02", "v2", 1000),
  ]);
  assert.equal(c.mundos.auroria.gold, 70_300_000);
  assert.equal(c.mundos.bellum.gold, 76_000_000);
  assert.equal("gold" in c, false); // não existe "gold total" na carteira
});

test("gold que você já tinha entra com o custo informado", () => {
  const c = calcularCarteira([
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 5_000_000, custoRc: 67.5 },
  ]);
  assert.equal(c.mundos.auroria.gold, 5_000_000);
  assert.equal(c.mundos.auroria.custoRc, 67.5);
  assert.equal(c.capitalRc, 67.5);
});

test("saída de gold leva junto a mesma proporção do custo", () => {
  const c = calcularCarteira([
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 10_000_000, custoRc: 100 },
    { tipo: "gold-saida", data: "2026-11-02", mundoId: "auroria", gold: 2_500_000 },
  ]);
  assert.equal(c.mundos.auroria.gold, 7_500_000);
  perto(c.mundos.auroria.custoRc, 75);
  perto(c.capitalRc, 75);
});

test("ajuste de RC muda o saldo sem virar capital nem lucro", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 1000),
    { tipo: "ajuste-rc", data: "2026-11-08", qtd: -3 },
  ]);
  assert.equal(c.rcLivre, 997);
  assert.equal(c.capitalRc, 1000);
  assert.equal(c.ajustesRc, -3);
  assert.equal(c.realizadoRc, 0);
});

// ---------------------------------------------------------------
test("alerta: vender RC sem ter lançado a entrada", () => {
  const c = calcularCarteira([criarVenda("2026-11-02", "v1", "auroria", 1000, 74000)]);
  assert.ok(c.alertas.some((a) => a.includes("RC livre ficou negativo")));
});

test("alerta: taxa cobrada num mundo sem gold lançado", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K);
  assert.ok(c.alertas.some((a) => a.includes("gold de auroria ficou negativo")));
});

test("sem alerta quando o gold da taxa já estava no mundo", () => {
  const c = calcularCarteira([
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 4_000_000, custoRc: 55 },
    ...VENDEU_1000_A_74K,
  ]);
  assert.deepEqual(c.alertas, []);
});

test("alerta: execução maior que o restante é limitada ao restante", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 1000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 1500),
  ]);
  assert.equal(c.ofertas.v1.executado, 1000);
  assert.equal(c.rcBloqueado, 0);
  assert.ok(c.alertas.some((a) => a.includes("maior que o restante")));
});

test("evento desconhecido gera alerta em vez de quebrar", () => {
  const c = calcularCarteira([{ tipo: "inventado", data: "2026-11-01" }]);
  assert.ok(c.alertas.some((a) => a.includes("desconhecido")));
});

test("execução de oferta que não existe gera alerta em vez de quebrar", () => {
  const c = calcularCarteira([executar("2026-11-01", "nao-existe", 10)]);
  assert.equal(c.alertas.length, 1);
});

// ---------------------------------------------------------------
test("'ate' mostra a carteira como estava naquele dia", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K, { ate: "2026-11-02" });
  assert.equal(c.rcBloqueado, 1000); // no dia 02 a venda ainda não tinha executado
  assert.equal(c.ofertas.v1.status, "aberta");
});

test("o motor não altera a lista de eventos que recebe", () => {
  const copia = JSON.stringify(VENDEU_1000_A_74K);
  calcularCarteira(VENDEU_1000_A_74K);
  assert.equal(JSON.stringify(VENDEU_1000_A_74K), copia);
});

test("recalcular com os mesmos eventos dá sempre o mesmo resultado", () => {
  assert.deepEqual(calcularCarteira(VENDEU_1000_A_74K), calcularCarteira(VENDEU_1000_A_74K));
});

test("a carteira pode ser salva em JSON (sem BigInt nem nada especial)", () => {
  assert.doesNotThrow(() => JSON.stringify(calcularCarteira(VENDEU_1000_A_74K)));
});

// ---------------------------------------------------------------
test("avaliar: gold vale RC pela melhor VENDA do mundo; em aberto negativo", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K);
  const a = avaliarCarteira(c, { auroria: { compra: 70000, venda: 72000 } });
  perto(a.mundos.auroria.valorRc, 70_300_000 / 72000); // 976,39 RC
  perto(a.mundos.auroria.emAbertoRc, 70_300_000 / 72000 - 1000); // −23,61 RC
  perto(a.mundos.auroria.precoBase, 70_300);
  perto(a.patrimonioRc, 70_300_000 / 72000);
});

test("avaliar: sem cotação, o gold vale o próprio custo e fica marcado", () => {
  const c = calcularCarteira(VENDEU_1000_A_74K);
  const a = avaliarCarteira(c, {});
  assert.equal(a.mundos.auroria.semCotacao, true);
  assert.equal(a.mundos.auroria.emAbertoRc, 0);
  assert.equal(a.patrimonioRc, 1000);
});

test("avaliar: cada mundo usa a SUA cotação", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 2000),
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-02", "v1", 1000),
    criarVenda("2026-11-02", "v2", "bellum", 1000, 80000),
    executar("2026-11-02", "v2", 1000),
  ]);
  const a = avaliarCarteira(c, {
    auroria: { compra: 68000, venda: 70000 },
    bellum: { compra: 77000, venda: 79000 },
  });
  perto(a.mundos.auroria.valorRc, 70_300_000 / 70000);
  perto(a.mundos.bellum.valorRc, 76_000_000 / 79000);
});

test("FECHAMENTO: resultado = realizado + em aberto + ajustes, numa história completa", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 3000),
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 6_000_000, custoRc: 80 },
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "bellum", gold: 7_000_000, custoRc: 90 },
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 1000),
    criarVenda("2026-11-03", "v2", "bellum", 1500, 80000),
    executar("2026-11-04", "v2", 900),
    cancelar("2026-11-05", "v2"),
    criarCompra("2026-11-06", "c1", "auroria", 500, 69000, false),
    executar("2026-11-06", "c1", 500),
    criarCompra("2026-11-07", "c2", "bellum", 400, 75000),
    executar("2026-11-08", "c2", 150),
    { tipo: "ajuste-rc", data: "2026-11-09", qtd: -2 },
    { tipo: "ajuste-gold", data: "2026-11-09", mundoId: "bellum", gold: 12_345 },
  ]);
  const a = avaliarCarteira(c, {
    auroria: { compra: 69500, venda: 71000 },
    bellum: { compra: 76000, venda: 78500 },
  });

  assert.deepEqual(c.alertas, []);
  perto(a.resultadoRc, a.realizadoRc + a.emAbertoRc + a.ajustesRc);
});
