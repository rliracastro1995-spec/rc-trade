// estado-inicial.js — como os dados começam na primeira vez que o app abre.
// Regras de unidade (valem para o app inteiro):
//   • gold (kk) é guardado em número inteiro de gold: 1kk = 1.000.000
//   • RC é guardado em DÉCIMOS, também inteiro: 25 RC = 250
//   • datas no formato ISO: "2026-11-15"
// Números inteiros evitam erros de arredondamento (0,1 + 0,2 ≠ 0,3 no JS).

export const VERSAO = 3;

export const MUNDOS = [
  "Auroria", "Belaria", "Bellum", "Drakaria", "Eldrian", "Elysian",
  "Infernum I", "Infernum II", "Infernum III", "Lunarian", "Malveria",
  "Mystian", "Obsidian", "Solarian", "Tenebrium", "Vesperia",
];

export const CONFIG_PADRAO = {
  taxaOferta: 0.05,      // 5% pago só por quem CRIA a oferta
  reaisPorRc: 0.1,       // 1 RC = R$ 0,10
  blocoRc: 25,           // RC é negociado em blocos de 25
  diasValidadeOferta: 30,
  turnos: ["manha", "tarde", "noite"],
};

// Transforma "Infernum II" em "infernum-ii" (usado como id)
export function criarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

export function criarEstadoInicial() {
  return {
    versao: VERSAO,
    config: { ...CONFIG_PADRAO },
    mundos: MUNDOS.map((nome) => ({ id: criarSlug(nome), nome, ativo: true })),
    cotacoes: [],
    ofertas: [],
    execucoes: [],
    movimentos: [],
    itens: [],
    lancamentosItens: [],
    precosItens: [],
    fechamentos: [],
  };
}
