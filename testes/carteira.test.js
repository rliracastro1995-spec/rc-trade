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

// ===============================================================
// ITENS — comprar e vender item com o gold do mundo
// ===============================================================

const comprarItem = (data, mundoId, itemId, qtd, preco, teveTaxa = false) => ({
  tipo: "item-comprado", data, mundoId, itemId, qtd, preco, teveTaxa,
});

const venderItem = (data, mundoId, itemId, qtd, preco, teveTaxa = false) => ({
  tipo: "item-vendido", data, mundoId, itemId, qtd, preco, teveTaxa,
});

// Auroria começa com 10kk que custaram 100 RC.
const GOLD_EM_AURORIA = [
  { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 10_000_000, custoRc: 100 },
];

// Comprou 100 Tibia Coins a 35k cada, aceitando uma oferta (sem taxa).
const COMPROU_100_TC = [
  ...GOLD_EM_AURORIA,
  comprarItem("2026-11-02", "auroria", "tibia-coin", 100, 35000),
];

test("item: comprar 100 a 35k tira 3,5kk do mundo e põe 100 no estoque", () => {
  const c = calcularCarteira(COMPROU_100_TC);
  const item = c.mundos.auroria.itens["tibia-coin"];

  assert.equal(c.mundos.auroria.gold, 6_500_000);
  assert.equal(item.qtd, 100);
  assert.equal(item.custoGold, 3_500_000);
  // o custo em RC acompanha o gold: 35% do gold saiu, 35% do custo foi junto
  perto(item.custoRc, 35);
  perto(c.mundos.auroria.custoRc, 65);
  assert.deepEqual(c.alertas, []);
});

test("item: vender 50 a 37k dá lucro de 100k gold e atualiza gold e estoque", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 50, 37000),
  ]);
  const item = c.mundos.auroria.itens["tibia-coin"];

  assert.equal(c.mundos.auroria.gold, 6_500_000 + 1_850_000);
  assert.equal(item.qtd, 50);
  assert.equal(item.custoGold, 1_750_000);
  assert.equal(item.lucroGold, 100_000); // 50 × (37k − 35k)

  assert.equal(c.realizadosItens.length, 1);
  assert.equal(c.realizadosItens[0].gold, 100_000);
  assert.equal(c.realizadosItens[0].recebidoGold, 1_850_000);
  assert.equal(c.realizadosItens[0].custoGold, 1_750_000);

  // metade do custo em RC do item voltou para o gold do mundo
  perto(item.custoRc, 17.5);
  perto(c.mundos.auroria.custoRc, 82.5);
});

test("item: lucro de item fica em gold; NÃO entra no realizado em RC", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 50, 37000),
  ]);
  assert.equal(c.realizadoRc, 0);
});

test("item: comprar CRIANDO oferta paga 5%, e a taxa entra no custo do item", () => {
  const c = calcularCarteira([
    ...GOLD_EM_AURORIA,
    comprarItem("2026-11-02", "auroria", "tibia-coin", 100, 35000, true),
  ]);
  const item = c.mundos.auroria.itens["tibia-coin"];

  assert.equal(c.mundos.auroria.taxasGold, 175_000);
  assert.equal(item.custoGold, 3_675_000);
  assert.equal(c.mundos.auroria.gold, 10_000_000 - 3_675_000);
});

test("item: vender CRIANDO oferta desconta a taxa do lucro", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 50, 37000, true),
  ]);
  // recebe 1,85kk − 92,5k de taxa; o custo das 50 era 1,75kk
  assert.equal(c.realizadosItens[0].gold, 7_500);
  assert.equal(c.mundos.auroria.taxasGold, 92_500);
});

test("item: usa a taxa do lançamento quando ela vem informada", () => {
  const c = calcularCarteira([
    ...GOLD_EM_AURORIA,
    { ...comprarItem("2026-11-02", "auroria", "tibia-coin", 100, 35000, true), taxa: 175_001 },
  ]);
  assert.equal(c.mundos.auroria.taxasGold, 175_001);
});

test("item: vender abaixo do custo registra prejuízo", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 100, 33000),
  ]);
  assert.equal(c.realizadosItens[0].gold, -200_000);
});

test("item: duas compras a preços diferentes formam custo médio", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,                                              // 100 a 35k
    comprarItem("2026-11-03", "auroria", "tibia-coin", 100, 37000), // 100 a 37k
    venderItem("2026-11-06", "auroria", "tibia-coin", 100, 38000),  // custo médio 36k
  ]);
  const item = c.mundos.auroria.itens["tibia-coin"];
  assert.equal(c.realizadosItens[0].gold, 200_000); // 100 × (38k − 36k)
  assert.equal(item.qtd, 100);
  assert.equal(item.custoGold, 3_600_000);
});

test("item: vender tudo zera estoque e custo, sem sobra de arredondamento", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 30, 37000),
    venderItem("2026-11-06", "auroria", "tibia-coin", 70, 37000),
  ]);
  const item = c.mundos.auroria.itens["tibia-coin"];
  assert.equal(item.qtd, 0);
  assert.equal(item.custoGold, 0);
  assert.equal(item.custoRc, 0);
  perto(c.mundos.auroria.custoRc, 100); // todo o custo em RC voltou para o gold
});

test("item: estoque é por mundo, nunca se mistura", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "bellum", gold: 5_000_000, custoRc: 60 },
    comprarItem("2026-11-02", "bellum", "tibia-coin", 20, 40000),
  ]);
  assert.equal(c.mundos.auroria.itens["tibia-coin"].qtd, 100);
  assert.equal(c.mundos.bellum.itens["tibia-coin"].qtd, 20);
  assert.equal(c.mundos.bellum.gold, 4_200_000);
});

test("item: alerta ao vender mais do que tem (o gold entra mesmo assim)", () => {
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    venderItem("2026-11-05", "auroria", "tibia-coin", 120, 37000),
  ]);
  assert.ok(c.alertas.some((a) => a.includes("estoque era 100")));
  assert.equal(c.mundos.auroria.itens["tibia-coin"].qtd, 0);
  assert.equal(c.mundos.auroria.gold, 6_500_000 + 120 * 37000);
});

test("item: alerta ao comprar sem ter gold no mundo", () => {
  const c = calcularCarteira([comprarItem("2026-11-02", "auroria", "tibia-coin", 100, 35000)]);
  assert.ok(c.alertas.some((a) => a.includes("gold de auroria ficou negativo")));
});

test("item: consumir é retirada — sai do estoque e do capital, sem virar prejuízo", () => {
  const antes = avaliarCarteira(calcularCarteira(COMPROU_100_TC));
  const c = calcularCarteira([
    ...COMPROU_100_TC,
    { tipo: "item-consumido", data: "2026-11-04", mundoId: "auroria", itemId: "tibia-coin", qtd: 40 },
  ]);
  const depois = avaliarCarteira(c);

  assert.equal(c.mundos.auroria.itens["tibia-coin"].qtd, 60);
  perto(c.capitalRc, 100 - 14); // 40% do custo do item (35 RC) saiu do capital
  perto(depois.resultadoRc, antes.resultadoRc);
  assert.equal(c.consumos.length, 1);
});

// ---------------------------------------------------------------
test("avaliar item: vale a melhor COMPRA do item, convertida pela VENDA de RC", () => {
  const c = calcularCarteira(COMPROU_100_TC);
  const a = avaliarCarteira(
    c,
    { auroria: { compra: 68000, venda: 70000 } },
    { auroria: { "tibia-coin": { compra: 36000, venda: 38000 } } },
  );
  const item = a.mundos.auroria.itens["tibia-coin"];

  assert.equal(item.custoMedioGold, 35000);
  assert.equal(item.valorGold, 3_600_000);
  assert.equal(item.emAbertoGold, 100_000);
  perto(item.valorRc, 3_600_000 / 70000);
  perto(item.emAbertoRc, 3_600_000 / 70000 - 35);
  // patrimônio = gold do mundo + itens, tudo pela cotação de Auroria
  perto(a.patrimonioRc, (6_500_000 + 3_600_000) / 70000);
});

test("avaliar item: sem preço do item, ele vale o que custou (e fica marcado)", () => {
  const a = avaliarCarteira(
    calcularCarteira(COMPROU_100_TC),
    { auroria: { compra: 68000, venda: 70000 } },
  );
  const item = a.mundos.auroria.itens["tibia-coin"];
  assert.equal(item.semPreco, true);
  assert.equal(item.valorGold, 3_500_000);
  assert.equal(item.emAbertoGold, 0);
});

test("avaliar item: sem cotação de RC no mundo, vale o próprio custo em RC", () => {
  const a = avaliarCarteira(calcularCarteira(COMPROU_100_TC));
  perto(a.mundos.auroria.itens["tibia-coin"].valorRc, 35);
  perto(a.patrimonioRc, 100);
});

test("item: o lucro só vira realizado em RC na recompra, e não conta duas vezes", () => {
  const semItem = [
    entradaRc("2026-11-01", 1000),
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 4_000_000, custoRc: 55 },
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 1000),
  ];
  const recompra = [
    criarCompra("2026-11-08", "c1", "auroria", 1000, 70000, false),
    executar("2026-11-08", "c1", 1000),
  ];
  const tradeDeItem = [
    comprarItem("2026-11-04", "auroria", "tibia-coin", 100, 35000),
    venderItem("2026-11-06", "auroria", "tibia-coin", 100, 37000), // +200k gold
  ];

  const antesDaRecompra = calcularCarteira([...semItem, ...tradeDeItem]);
  assert.equal(antesDaRecompra.realizadoRc, 0);

  const comItem = calcularCarteira([...semItem, ...tradeDeItem, ...recompra]);
  const sem = calcularCarteira([...semItem, ...recompra]);
  // o mesmo gold comprou os mesmos 1.000 RC, mas saiu de um monte maior:
  // o custo usado foi menor, então o realizado em RC foi maior
  assert.ok(comItem.realizadoRc > sem.realizadoRc);

  const a = avaliarCarteira(comItem, { auroria: { compra: 69000, venda: 70500 } });
  perto(a.resultadoRc, a.realizadoRc + a.emAbertoRc + a.ajustesRc);
});

test("FECHAMENTO com itens: resultado = realizado + em aberto + ajustes", () => {
  const c = calcularCarteira([
    entradaRc("2026-11-01", 3000),
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "auroria", gold: 6_000_000, custoRc: 80 },
    { tipo: "gold-entrada", data: "2026-11-01", mundoId: "bellum", gold: 7_000_000, custoRc: 90 },
    criarVenda("2026-11-02", "v1", "auroria", 1000, 74000),
    executar("2026-11-03", "v1", 1000),
    comprarItem("2026-11-03", "auroria", "sanguine-blade", 3, 2_300_000, true),
    comprarItem("2026-11-03", "auroria", "tibia-coin", 200, 35000),
    criarVenda("2026-11-03", "v2", "bellum", 1500, 80000),
    executar("2026-11-04", "v2", 900),
    comprarItem("2026-11-04", "bellum", "tibia-coin", 50, 41000, true),
    venderItem("2026-11-05", "auroria", "sanguine-blade", 1, 2_600_000, true),
    venderItem("2026-11-05", "auroria", "tibia-coin", 120, 33500),
    { tipo: "item-consumido", data: "2026-11-05", mundoId: "auroria", itemId: "tibia-coin", qtd: 10 },
    cancelar("2026-11-05", "v2"),
    criarCompra("2026-11-06", "c1", "auroria", 500, 69000, false),
    executar("2026-11-06", "c1", 500),
    { tipo: "ajuste-rc", data: "2026-11-09", qtd: -2 },
    { tipo: "ajuste-gold", data: "2026-11-09", mundoId: "bellum", gold: 12_345 },
  ]);
  const a = avaliarCarteira(
    c,
    { auroria: { compra: 69500, venda: 71000 }, bellum: { compra: 76000, venda: 78500 } },
    {
      auroria: { "sanguine-blade": { compra: 2_450_000, venda: 2_700_000 } },
      bellum: { "tibia-coin": { compra: 39000, venda: 42000 } },
    },
  );

  assert.deepEqual(c.alertas, []);
  perto(a.resultadoRc, a.realizadoRc + a.emAbertoRc + a.ajustesRc);
});

test("carteira com itens também pode ser salva em JSON", () => {
  const c = calcularCarteira(COMPROU_100_TC);
  assert.doesNotThrow(() => JSON.stringify(avaliarCarteira(c)));
});
