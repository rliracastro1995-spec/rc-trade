// calculos.test.js — prova que as contas do motor estão certas.
// Rodar com:  npm test     (ou: node --test testes/)
//
// Cada teste descreve uma situação real de trade. Se alguém mudar uma
// conta sem querer, o teste falha e avisa na hora.

import test from "node:test";
import assert from "node:assert/strict";

import {
  TAXA_MARKET,
  taxaCriacao,
  equilibrioAceitando,
  equilibrioCriando,
  precoMedio,
  liquidarRc,
  liquidarGold,
  precoBase,
  emaPasso,
  emaSerie,
  diasEntre,
  desvioPadrao,
  zScore,
  temHistoricoParaZScore,
  rcDisponivelParaOperar,
  kellyMeio,
  temHistoricoParaKelly,
  arredondarGold,
  arredondarRc,
} from "../site/js/motor/calculos.js";

// Compara números quebrados com uma folga mínima.
const perto = (recebido, esperado, folga = 1e-6) =>
  assert.ok(
    Math.abs(recebido - esperado) < folga,
    `esperava ${esperado}, recebi ${recebido}`,
  );

// ---------------------------------------------------------------
test("taxa: 1.500 RC a 75.000 custa 5,625kk", () => {
  assert.equal(taxaCriacao(1500, 75000), 5_625_000);
});

test("taxa: arredonda, igual ao jogo (conferido no RubinOT)", () => {
  // 25 RC a 70.002 dá 87.502,5 na conta e o jogo cobra 87.503
  assert.equal(taxaCriacao(25, 70002), 87_503);
});

test("taxa: o motor recebe RC natural, não décimos", () => {
  // 1.500 RC guardados são 15000. Se o décimo vazar para cá, a taxa dá 10x.
  assert.equal(taxaCriacao(1500, 75000), 5_625_000);
  assert.equal(taxaCriacao(15000, 75000), 56_250_000); // o erro que não pode acontecer
});

test("taxa: a de 5% é a configurada", () => {
  assert.equal(TAXA_MARKET, 0.05);
});

// ---------------------------------------------------------------
test("equilíbrio: vendi a 75.000 e recompro ACEITANDO — volto com o mesmo RC", () => {
  const qtd = 1500;
  const preco = 75000;
  const goldLiquido = qtd * preco - taxaCriacao(qtd, preco);

  const limite = equilibrioAceitando(preco);
  perto(limite, 71_250);
  perto(goldLiquido / limite, qtd, 1e-6); // empatou exatamente
});

test("equilíbrio: recomprando CRIANDO oferta, paga 5% de novo", () => {
  const qtd = 1500;
  const preco = 75000;
  const goldLiquido = qtd * preco - taxaCriacao(qtd, preco);

  const limite = equilibrioCriando(preco);
  perto(limite, 67_857.142857, 1e-5);

  // gold gasto = RC x preço + taxa de 5%
  const rcDeVolta = goldLiquido / (limite * (1 + TAXA_MARKET));
  perto(rcDeVolta, qtd, 1e-6);
});

test("equilíbrio: criando é sempre mais apertado que aceitando", () => {
  assert.ok(equilibrioCriando(74000) < equilibrioAceitando(74000));
});

// ---------------------------------------------------------------
test("preço médio fica no meio do spread", () => {
  assert.equal(precoMedio(71000, 74000), 72500);
});

test("preço médio devolve null sem cotação", () => {
  assert.equal(precoMedio(null, 74000), null);
});

test("liquidar RC usa a melhor COMPRA (quem te compra)", () => {
  assert.equal(liquidarRc(1000, 71000), 71_000_000);
});

test("liquidar gold usa a melhor VENDA (o preço que você paga)", () => {
  perto(liquidarGold(70_300_000, 70000), 1004.285714, 1e-5);
});

test("preço base: vendi 1.000 RC a 74k, sobrou 70,3kk após a taxa", () => {
  const qtd = 1000;
  const preco = 74000;
  const gold = qtd * preco - taxaCriacao(qtd, preco);
  assert.equal(gold, 70_300_000);
  perto(precoBase(gold, qtd), 70_300); // recompra empata em 70.300
});

test("preço base: abaixo dele dá lucro, acima dá prejuízo", () => {
  const gold = 70_300_000;
  const custoRc = 1000;
  perto(liquidarGold(gold, 70_000) - custoRc, 4.285714, 1e-5); // lucro
  assert.ok(liquidarGold(gold, 72_000) - custoRc < 0); // prejuízo
});

// ---------------------------------------------------------------
test("EMA: um dia tem o peso normal (k = 25% com 7 períodos)", () => {
  perto(emaPasso(80000, 70000, 1, 7), 70000 + 10000 * 0.25);
});

test("EMA: depois de 5 dias sem cotação, o preço novo pesa mais", () => {
  const umDia = emaPasso(80000, 70000, 1, 7);
  const cincoDias = emaPasso(80000, 70000, 5, 7);
  assert.ok(cincoDias > umDia);
  perto(cincoDias, 77_626.95, 0.01);
});

test("EMA: série curta demais devolve null", () => {
  const pontos = [{ data: "2026-11-01", preco: 70000 }];
  assert.equal(emaSerie(pontos, 7), null);
});

test("EMA: com 7 dias iguais, a EMA é o próprio preço", () => {
  const pontos = Array.from({ length: 7 }, (_, i) => ({
    data: `2026-11-0${i + 1}`,
    preco: 70000,
  }));
  perto(emaSerie(pontos, 7), 70000);
});

test("EMA: reage à alta do 8º dia", () => {
  const pontos = Array.from({ length: 7 }, (_, i) => ({
    data: `2026-11-0${i + 1}`,
    preco: 70000,
  }));
  pontos.push({ data: "2026-11-08", preco: 80000 });
  perto(emaSerie(pontos, 7), 72500);
});

test("dias entre datas", () => {
  assert.equal(diasEntre("2026-11-10", "2026-11-15"), 5);
  assert.equal(diasEntre("2026-11-10", "2026-11-10"), 1); // mesmo dia conta como 1
});

// ---------------------------------------------------------------
test("desvio padrão de valores iguais é zero", () => {
  assert.equal(desvioPadrao([70000, 70000, 70000]), 0);
});

test("Z-Score: 2 desvios acima da média", () => {
  const valores = [68000, 69000, 70000, 71000, 72000];
  const media = 70000;
  const desvio = desvioPadrao(valores);
  perto(zScore(media + 2 * desvio, media, desvio), 2);
});

test("Z-Score: sem variação devolve 0 em vez de dividir por zero", () => {
  assert.equal(zScore(70000, 70000, 0), 0);
});

test("Z-Score: só vale com 20 cotações ou mais", () => {
  assert.equal(temHistoricoParaZScore(19), false);
  assert.equal(temHistoricoParaZScore(20), true);
});

// ---------------------------------------------------------------
test("reserva: com 40% travados, sobra pouco do RC livre", () => {
  // patrimônio 10.000 RC, 5.000 livres -> reserva exige 4.000
  assert.equal(rcDisponivelParaOperar(10000, 5000), 1000);
});

test("reserva: nunca devolve número negativo", () => {
  assert.equal(rcDisponivelParaOperar(10000, 3000), 0);
});

test("Kelly: devolve metade do Kelly cheio", () => {
  // p=0,7 ganho 5 perda 3 -> Kelly cheio 0,52 -> metade 0,26
  perto(kellyMeio(0.7, 5, 3), 0.26, 1e-9);
});

test("Kelly: sem vantagem, não sugere operar", () => {
  assert.equal(kellyMeio(0.3, 3, 5), 0);
});

test("Kelly: só aparece depois de 30 trades", () => {
  assert.equal(temHistoricoParaKelly(29), false);
  assert.equal(temHistoricoParaKelly(30), true);
});

// ---------------------------------------------------------------
test("arredondar gold para inteiro", () => {
  assert.equal(arredondarGold(87502.5), 87503);
});

test("arredondar RC para o décimo", () => {
  assert.equal(arredondarRc(1004.285714), 1004.3);
});

test("o clássico 0,1 + 0,2 não escapa pelo arredondamento", () => {
  assert.equal(arredondarRc(0.1 + 0.2), 0.3);
});
