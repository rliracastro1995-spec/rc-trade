// cotacoes.test.js — pegar a cotação mais recente de cada mundo e item.
import test from "node:test";
import assert from "node:assert/strict";

import { ultimaCotacaoPorMundo, ultimoPrecoPorItem } from "../site/js/motor/cotacoes.js";

const COTACOES = [
  { data: "2026-11-15", turno: "noite", mundoId: "auroria", compra: 71000, venda: 74000 },
  { data: "2026-11-16", turno: "manha", mundoId: "auroria", compra: 71500, venda: 74500 },
  { data: "2026-11-16", turno: "tarde", mundoId: "auroria", compra: 72000, venda: 75000 },
  { data: "2026-11-10", turno: "manha", mundoId: "bellum", compra: 79000, venda: 81000 },
];

test("fica com a cotação mais recente de cada mundo", () => {
  const u = ultimaCotacaoPorMundo(COTACOES);
  assert.equal(u.auroria.venda, 75000);
  assert.equal(u.auroria.turno, "tarde");
  assert.equal(u.bellum.venda, 81000);
});

test("no mesmo dia, noite vence tarde, que vence manhã", () => {
  const u = ultimaCotacaoPorMundo([
    { data: "2026-11-16", turno: "noite", mundoId: "x", venda: 3 },
    { data: "2026-11-16", turno: "manha", mundoId: "x", venda: 1 },
    { data: "2026-11-16", turno: "tarde", mundoId: "x", venda: 2 },
  ]);
  assert.equal(u.x.venda, 3);
});

test("lista vazia ou ausente devolve objeto vazio", () => {
  assert.deepEqual(ultimaCotacaoPorMundo([]), {});
  assert.deepEqual(ultimaCotacaoPorMundo(undefined), {});
});

test("preço de item é separado por mundo e por item", () => {
  const u = ultimoPrecoPorItem([
    { data: "2026-11-10", turno: "manha", mundoId: "auroria", itemId: "tc", compra: 34000 },
    { data: "2026-11-16", turno: "manha", mundoId: "auroria", itemId: "tc", compra: 36000 },
    { data: "2026-11-16", turno: "manha", mundoId: "bellum", itemId: "tc", compra: 39000 },
    { data: "2026-11-16", turno: "manha", mundoId: "auroria", itemId: "sanguine", compra: 2_400_000 },
  ]);
  assert.equal(u.auroria.tc.compra, 36000);
  assert.equal(u.bellum.tc.compra, 39000);
  assert.equal(u.auroria.sanguine.compra, 2_400_000);
});
