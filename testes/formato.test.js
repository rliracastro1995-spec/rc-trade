// formato.test.js — como os números aparecem na tela.
import test from "node:test";
import assert from "node:assert/strict";

import {
  formatarGold, formatarGoldCurto, formatarRc, formatarRcComSinal,
  formatarReais, formatarPercentual, formatarData, lerGold,
} from "../site/js/nucleo/formato.js";

test("gold com separador de milhar", () => {
  assert.equal(formatarGold(3_500_000), "3.500.000");
  assert.equal(formatarGold(74_000), "74.000");
  assert.equal(formatarGold(87_502.5), "87.503");
});

test("gold curto, do jeito do jogo", () => {
  assert.equal(formatarGoldCurto(1_500_000), "1,5kk");
  assert.equal(formatarGoldCurto(70_300_000), "70,3kk");
  assert.equal(formatarGoldCurto(74_000), "74k");
  assert.equal(formatarGoldCurto(57_500), "57,5k");
  assert.equal(formatarGoldCurto(850), "850");
});

test("RC mostra no máximo 1 casa, e esconde o zero", () => {
  assert.equal(formatarRc(1250), "1.250");
  assert.equal(formatarRc(1004.2857), "1.004,3");
  assert.equal(formatarRc(0.1 + 0.2), "0,3");
});

test("resultado leva sinal na frente", () => {
  assert.equal(formatarRcComSinal(4.3), "+4,3");
  assert.equal(formatarRcComSinal(-23.61), "−23,6");
  assert.equal(formatarRcComSinal(0), "0");
});

test("RC vira reais pela configuração", () => {
  assert.equal(formatarReais(1250).replace(/ /g, " "), "R$ 125,00");
});

test("percentual e data", () => {
  assert.equal(formatarPercentual(0.039), "+3,9%");
  assert.equal(formatarPercentual(-0.02), "−2,0%");
  assert.equal(formatarData("2026-11-16"), "16/11/2026");
});

test("número que não existe vira travessão, nunca NaN na tela", () => {
  for (const f of [formatarGold, formatarGoldCurto, formatarRc, formatarRcComSinal, formatarPercentual]) {
    assert.equal(f(null), "—");
    assert.equal(f(undefined), "—");
    assert.equal(f(NaN), "—");
  }
  assert.equal(formatarData(null), "—");
});

test("lerGold entende o jeito que você digita", () => {
  assert.equal(lerGold("74k"), 74_000);
  assert.equal(lerGold("57,5k"), 57_500);
  assert.equal(lerGold("1,5kk"), 1_500_000);
  assert.equal(lerGold("74.000"), 74_000);
  assert.equal(lerGold("74000"), 74_000);
  assert.equal(lerGold(" 74K "), 74_000);
});

test("lerGold: vazio é null e texto errado é NaN", () => {
  assert.equal(lerGold(""), null);
  assert.equal(lerGold(null), null);
  assert.ok(Number.isNaN(lerGold("abc")));
  assert.ok(Number.isNaN(lerGold("7,4,4k")));
});
