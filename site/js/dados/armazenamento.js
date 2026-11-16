// armazenamento.js — o ÚNICO arquivo que sabe onde os dados ficam guardados.
// Hoje: localStorage do navegador. No futuro: API + banco (só este arquivo muda).
// As telas nunca usam localStorage direto; sempre chamam carregar() e salvar().

import { VERSAO, criarEstadoInicial } from "./estado-inicial.js";

const CHAVE = "rctrade:v3";
const CHAVE_LEGADO = "rctrade:v1"; // dados do app antigo: só lidos, nunca alterados

let estado = null;

// Se os dados estiverem estragados, guarda uma cópia antes de começar do zero,
// para nada se perder sem querer.
function guardarCopiaCorrompida() {
  try {
    const texto = localStorage.getItem(CHAVE);
    if (texto) localStorage.setItem(`${CHAVE}:corrompido`, texto);
  } catch {
    // sem acesso ao localStorage: não há o que guardar
  }
}

// Lê os dados salvos. Na primeira vez (ou se estiverem corrompidos), começa do zero.
export function carregar() {
  try {
    const texto = localStorage.getItem(CHAVE);
    estado = texto ? JSON.parse(texto) : criarEstadoInicial();
  } catch (erro) {
    console.error("Não consegui ler os dados salvos:", erro);
    guardarCopiaCorrompida();
    estado = criarEstadoInicial();
  }
  return estado;
}

// Grava o estado atual. Devolve true/false para a tela poder avisar o usuário.
export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch (erro) {
    console.error("Não consegui salvar os dados:", erro);
    return false;
  }
}

// Dá acesso ao estado já carregado (carrega se ainda não carregou).
export function obterEstado() {
  return estado ?? carregar();
}

// Texto JSON para o backup (Configurações e backup).
export function exportar() {
  return JSON.stringify(obterEstado(), null, 2);
}

// Restaura um backup. Recusa arquivos que não são do RC Trade novo.
export function importar(texto) {
  const dados = JSON.parse(texto);
  if (dados?.versao !== VERSAO || !Array.isArray(dados.mundos)) {
    throw new Error("Este arquivo não é um backup válido do RC Trade.");
  }
  estado = dados;
  return salvar();
}

// Lê os dados do app antigo, sem alterar nada. Devolve null se não houver.
export function lerDadosLegado() {
  try {
    const texto = localStorage.getItem(CHAVE_LEGADO);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}
