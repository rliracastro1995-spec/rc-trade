// dados.js — onde tudo é guardado (localStorage do navegador)
// Regra: as telas nunca mexem no localStorage direto, só chamam funções daqui.
// Na Fase de nuvem (Supabase) só este arquivo muda.

const CHAVE = "rctrade:v1";
const VERSAO = 2;

const MUNDOS_INICIAIS = [
  "Auroria", "Belaria", "Bellum", "Drakaria", "Eldrian", "Elysian",
  "Infernum I", "Infernum II", "Infernum III", "Lunarian", "Malveria",
  "Mystian", "Obsidian", "Solarian", "Tenebrium", "Vesperia",
];

const CONFIG_PADRAO = {
  taxa: 0.05,          // taxa do market (5%) paga por quem CRIA a oferta
  rcEmReais: 0.10,     // 1 RC = R$ 0,10 (1.000 RC = R$ 100 no site)
  reservaMinima: 0.40, // manter pelo menos 40% do patrimônio em RC livre
  lucroMinimo: 0.03,   // abaixo de 3% de lucro a recompra é "lucro pequeno"
  horasCotacaoVelha: 8,
};

function criarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function slug(nome) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
}

function estadoInicial() {
  return {
    versao: VERSAO,
    config: { ...CONFIG_PADRAO },
    mundos: MUNDOS_INICIAIS.map((nome) => ({ id: slug(nome), nome, ativo: true, posicao: false })),
    itens: [{ id: "rc", nome: "Rubini Coin" }],
    // { id, data, periodo, mundoId, itemId, venda, compra, criadoEm }
    cotacoes: [],
    // { id, data, periodo, mundoId, tipo: "venda"|"compra", qtd, preco, teveTaxa, taxa,
    //   status: "aberta"|"concluida"|"cancelada", canceladaData, canceladaPeriodo, canceladaEm, nota, criadoEm }
    ofertas: [],
    // { id, ofertaId, data, periodo, qtd, criadoEm }
    execucoes: [],
    // { id, data, periodo, tipo, mundoId, qtd, valorRc, valorReais, nota, criadoEm }
    // tipos: rc-entrada, rc-saida, gold-entrada, gold-saida, ajuste-rc, ajuste-gold
    movimentos: [],
    // { id, data, periodo, mundoId, itemId, tipo: "compra"|"venda"|"consumo", qtd, preco, teveTaxa, taxa, nota, criadoEm }
    lancamentosItens: [],
    // { data, patrimonioRc, rcLivre, rcOfertas, realizadoDia, taxasDiaGold, fechadoEm }
    fechamentos: [],
  };
}

// Atualiza backups/dados antigos para a versão atual sem perder nada
function migrar(estado) {
  if (!estado.versao || estado.versao < 2) {
    estado.config = { ...CONFIG_PADRAO, ...(estado.config || {}) };
    estado.ofertas = estado.ofertas || [];
    estado.execucoes = estado.execucoes || [];
    estado.movimentos = estado.movimentos || [];
    estado.lancamentosItens = estado.lancamentosItens || [];
    estado.fechamentos = estado.fechamentos || [];
    estado.versao = 2;
  }
  estado.config = { ...CONFIG_PADRAO, ...estado.config };
  return estado;
}

const Dados = {
  estado: null,

  carregar() {
    try {
      const texto = localStorage.getItem(CHAVE);
      Dados.estado = texto ? migrar(JSON.parse(texto)) : estadoInicial();
    } catch (e) {
      console.error("Não consegui ler os dados salvos", e);
      Dados.estado = estadoInicial();
    }
    Dados.salvar();
  },

  salvar() {
    localStorage.setItem(CHAVE, JSON.stringify(Dados.estado));
  },

  // ----- Configurações -----
  config() {
    return Dados.estado.config;
  },
  salvarConfig(campos) {
    Object.assign(Dados.estado.config, campos);
    Dados.salvar();
  },

  // ----- Mundos -----
  mundos() {
    return Dados.estado.mundos;
  },
  mundo(id) {
    return Dados.estado.mundos.find((m) => m.id === id);
  },
  nomeMundo(id) {
    const m = Dados.mundo(id);
    return m ? m.nome : id;
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
  nomeItem(id) {
    const i = Dados.item(id);
    return i ? i.nome : id;
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

  // ----- Ofertas de Rubini Coin -----
  ofertas() {
    return Dados.estado.ofertas;
  },
  oferta(id) {
    return Dados.estado.ofertas.find((o) => o.id === id);
  },
  execucoes(ofertaId) {
    const todas = Dados.estado.execucoes;
    return ofertaId ? todas.filter((x) => x.ofertaId === ofertaId) : todas;
  },
  executado(ofertaId) {
    return Dados.execucoes(ofertaId).reduce((s, x) => s + x.qtd, 0);
  },
  restante(oferta) {
    return oferta.qtd - Dados.executado(oferta.id);
  },
  // Cria a oferta. "Teve taxa? Não" = você aceitou uma oferta que já estava no market:
  // não paga taxa e a operação acontece inteira na hora.
  criarOferta(o) {
    const cfg = Dados.config();
    const oferta = {
      id: criarId(),
      data: o.data, periodo: o.periodo, mundoId: o.mundoId,
      tipo: o.tipo, qtd: o.qtd, preco: o.preco,
      teveTaxa: o.teveTaxa,
      taxa: o.teveTaxa ? Math.round(o.qtd * o.preco * cfg.taxa) : 0,
      status: o.teveTaxa ? "aberta" : "concluida",
      nota: o.nota || "",
      criadoEm: Date.now(),
    };
    Dados.estado.ofertas.push(oferta);
    if (!o.teveTaxa) {
      Dados.estado.execucoes.push({
        id: criarId(), ofertaId: oferta.id, data: o.data, periodo: o.periodo, qtd: o.qtd, criadoEm: Date.now() + 1,
      });
    }
    Dados.salvar();
    return oferta;
  },
  registrarExecucao(ofertaId, qtd, data, periodo) {
    const oferta = Dados.oferta(ofertaId);
    const resta = Dados.restante(oferta);
    if (oferta.status !== "aberta") throw new Error("Essa oferta não está aberta.");
    if (!(qtd > 0)) throw new Error("Quantidade inválida.");
    if (qtd > resta) throw new Error(`Só restam ${resta} RC nessa oferta.`);
    Dados.estado.execucoes.push({ id: criarId(), ofertaId, data, periodo, qtd, criadoEm: Date.now() });
    if (qtd === resta) oferta.status = "concluida";
    Dados.salvar();
  },
  apagarExecucao(id) {
    const x = Dados.estado.execucoes.find((e) => e.id === id);
    if (!x) return;
    Dados.estado.execucoes = Dados.estado.execucoes.filter((e) => e.id !== id);
    const oferta = Dados.oferta(x.ofertaId);
    if (oferta && oferta.teveTaxa && oferta.status === "concluida") oferta.status = "aberta";
    Dados.salvar();
  },
  // Cancelar devolve o que não foi executado. A taxa já paga NÃO volta.
  cancelarOferta(id, data, periodo) {
    const oferta = Dados.oferta(id);
    oferta.status = "cancelada";
    oferta.canceladaData = data;
    oferta.canceladaPeriodo = periodo;
    oferta.canceladaEm = Date.now();
    Dados.salvar();
  },
  reabrirOferta(id) {
    const oferta = Dados.oferta(id);
    oferta.status = Dados.restante(oferta) > 0 ? "aberta" : "concluida";
    delete oferta.canceladaData;
    delete oferta.canceladaPeriodo;
    delete oferta.canceladaEm;
    Dados.salvar();
  },
  apagarOferta(id) {
    Dados.estado.ofertas = Dados.estado.ofertas.filter((o) => o.id !== id);
    Dados.estado.execucoes = Dados.estado.execucoes.filter((x) => x.ofertaId !== id);
    Dados.salvar();
  },

  // ----- Movimentos (saldo inicial, entradas, saídas, ajustes) -----
  movimentos() {
    return Dados.estado.movimentos;
  },
  criarMovimento(m) {
    const mov = { id: criarId(), criadoEm: Date.now(), nota: "", ...m };
    Dados.estado.movimentos.push(mov);
    Dados.salvar();
    return mov;
  },
  apagarMovimento(id) {
    Dados.estado.movimentos = Dados.estado.movimentos.filter((m) => m.id !== id);
    Dados.salvar();
  },

  // ----- Itens comprados/vendidos em kk -----
  lancamentosItens() {
    return Dados.estado.lancamentosItens;
  },
  criarLancamentoItem(l) {
    const cfg = Dados.config();
    const lanc = {
      id: criarId(), criadoEm: Date.now(), nota: "", ...l,
      taxa: l.teveTaxa && l.tipo !== "consumo" ? Math.round(l.qtd * l.preco * cfg.taxa) : 0,
    };
    Dados.estado.lancamentosItens.push(lanc);
    Dados.salvar();
    return lanc;
  },
  apagarLancamentoItem(id) {
    Dados.estado.lancamentosItens = Dados.estado.lancamentosItens.filter((l) => l.id !== id);
    Dados.salvar();
  },

  // ----- Fechamentos de caixa -----
  fechamentos() {
    return Dados.estado.fechamentos;
  },
  fechamento(data) {
    return Dados.estado.fechamentos.find((f) => f.data === data);
  },
  fecharDia(foto) {
    Dados.estado.fechamentos = Dados.estado.fechamentos.filter((f) => f.data !== foto.data);
    Dados.estado.fechamentos.push({ ...foto, fechadoEm: Date.now() });
    Dados.salvar();
  },
  reabrirDia(data) {
    Dados.estado.fechamentos = Dados.estado.fechamentos.filter((f) => f.data !== data);
    Dados.salvar();
  },

  // ----- Backup -----
  exportar() {
    return JSON.stringify(Dados.estado, null, 2);
  },
  importar(texto) {
    const obj = JSON.parse(texto);
    if (!obj || !obj.versao || !Array.isArray(obj.mundos) || !Array.isArray(obj.cotacoes)) {
      throw new Error("Esse arquivo não é um backup do RC Trade.");
    }
    Dados.estado = migrar(obj);
    Dados.salvar();
  },
  apagarTudo() {
    Dados.estado = estadoInicial();
    Dados.salvar();
  },
};
