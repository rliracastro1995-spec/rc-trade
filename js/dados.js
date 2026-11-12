// dados.js — onde tudo é guardado (localStorage do navegador)
// Fase 7 troca isto por Supabase; o resto do app continua chamando as mesmas funções.

const CHAVE = "rctrade:v1";

const MUNDOS_INICIAIS = [
  "Auroria", "Belaria", "Bellum", "Drakaria", "Eldrian", "Elysian",
  "Infernum I", "Infernum II", "Infernum III", "Lunarian", "Malveria",
  "Mystian", "Obsidian", "Solarian", "Tenebrium", "Vesperia",
];

function criarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function slug(nome) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
}

function estadoInicial() {
  return {
    versao: 1,
    mundos: MUNDOS_INICIAIS.map((nome) => ({ id: slug(nome), nome, ativo: true, posicao: false })),
    itens: [{ id: "rc", nome: "Rubini Coin" }],
    // cada cotação: { id, data: "2026-11-11", periodo: "manha"|"tarde"|"noite",
    //                 mundoId, itemId, venda, compra, criadoEm }
    cotacoes: [],
  };
}

const Dados = {
  estado: null,

  carregar() {
    try {
      const texto = localStorage.getItem(CHAVE);
      Dados.estado = texto ? JSON.parse(texto) : estadoInicial();
    } catch (e) {
      console.error("Não consegui ler os dados salvos", e);
      Dados.estado = estadoInicial();
    }
  },

  salvar() {
    localStorage.setItem(CHAVE, JSON.stringify(Dados.estado));
  },

  // ----- Mundos -----
  mundos() {
    return Dados.estado.mundos;
  },
  mundo(id) {
    return Dados.estado.mundos.find((m) => m.id === id);
  },
  // Ativos, com posição aberta primeiro e depois em ordem alfabética
  mundosParaRonda() {
    return Dados.estado.mundos
      .filter((m) => m.ativo)
      .sort((a, b) => (b.posicao - a.posicao) || a.nome.localeCompare(b.nome));
  },
  alterarMundo(id, campos) {
    Object.assign(Dados.mundo(id), campos);
    Dados.salvar();
  },

  // ----- Itens -----
  itens() {
    return Dados.estado.itens;
  },
  item(id) {
    return Dados.estado.itens.find((i) => i.id === id);
  },
  adicionarItem(nome) {
    const item = { id: criarId(), nome: nome.trim() };
    Dados.estado.itens.push(item);
    Dados.salvar();
    return item;
  },

  // ----- Cotações -----
  cotacoes() {
    return Dados.estado.cotacoes;
  },
  // Salva uma ronda inteira. Se já existe cotação do mesmo dia/período/mundo/item, substitui.
  salvarRonda(data, periodo, itemId, linhas) {
    let quantas = 0;
    for (const l of linhas) {
      if (l.venda === null && l.compra === null) continue;
      const existente = Dados.estado.cotacoes.find(
        (c) => c.data === data && c.periodo === periodo && c.mundoId === l.mundoId && c.itemId === itemId
      );
      if (existente) {
        existente.venda = l.venda;
        existente.compra = l.compra;
        existente.criadoEm = Date.now();
      } else {
        Dados.estado.cotacoes.push({
          id: criarId(), data, periodo, mundoId: l.mundoId, itemId,
          venda: l.venda, compra: l.compra, criadoEm: Date.now(),
        });
      }
      quantas++;
    }
    Dados.salvar();
    return quantas;
  },
  apagarCotacao(id) {
    Dados.estado.cotacoes = Dados.estado.cotacoes.filter((c) => c.id !== id);
    Dados.salvar();
  },

  // ----- Backup -----
  exportar() {
    return JSON.stringify(Dados.estado, null, 2);
  },
  importar(texto) {
    const obj = JSON.parse(texto);
    if (!obj || obj.versao !== 1 || !Array.isArray(obj.mundos) || !Array.isArray(obj.cotacoes)) {
      throw new Error("Esse arquivo não é um backup do RC Trade.");
    }
    Dados.estado = obj;
    Dados.salvar();
  },
  apagarTudo() {
    Dados.estado = estadoInicial();
    Dados.salvar();
  },
};
