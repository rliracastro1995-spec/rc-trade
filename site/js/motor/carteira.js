// carteira.js — o motor da carteira.
//
// IDEIA: o saldo nunca é guardado. Ele é CALCULADO somando a linha do
// tempo de eventos (entradas, ofertas, execuções, cancelamentos, ajustes).
// Se um lançamento for corrigido, basta recalcular: nada fica desatualizado.
//
// REGRAS DESTE ARQUIVO:
//   • Não lê nem grava dados: recebe a lista de eventos e devolve a carteira.
//   • Os eventos chegam em ordem cronológica e em unidades naturais
//     (RC inteiro, gold inteiro). Quem monta e ordena é a camada de dados.
//   • RC é um saldo só, da conta inteira. Gold e itens são separados
//     POR MUNDO e nunca são somados entre mundos.
//   • Tudo é medido em RC. Cada mundo guarda o gold e quanto RC esse gold
//     custou (custoRc). Recomprar RC com esse gold é o que gera lucro realizado.
//
// TIPOS DE EVENTO (campo "tipo"):
//   rc-entrada        { qtd }                      RC que entrou na conta
//   rc-saida          { qtd }                      RC que saiu da conta
//   gold-entrada      { mundoId, gold, custoRc }   gold que você já tinha no mundo
//   gold-saida        { mundoId, gold }            gold que saiu do mundo
//   ajuste-rc         { qtd }                      diferença com o jogo (+ ou -)
//   ajuste-gold       { mundoId, gold }            diferença com o jogo (+ ou -)
//   oferta-criada     { ofertaId, mundoId, lado, qtd, preco, teveTaxa, taxa? }
//   oferta-executada  { ofertaId, qtd }
//   oferta-cancelada  { ofertaId }
//   oferta-expirada   { ofertaId }
//   item-comprado     { mundoId, itemId, qtd, preco, teveTaxa, taxa? }
//   item-vendido      { mundoId, itemId, qtd, preco, teveTaxa, taxa? }
//   item-consumido    { mundoId, itemId, qtd }      usou o item em vez de vender
// Todo evento tem "data" ("2026-11-15"). "lado" é "venda" ou "compra" de RC.
//
// ITENS: comprar e vender item mexe só com GOLD do mundo. O lucro da venda
// é registrado em gold (é o que aconteceu de fato). Ele só vira "realizado
// em RC" quando esse gold for usado para recomprar RC; até lá aparece no
// "em aberto", porque o gold do mundo cresceu sem o custo crescer.

import { taxaCriacao, liquidarGold, precoBase } from "./calculos.js";

// Folga para comparar números quebrados (ex.: 0,1 + 0,2).
const FOLGA = 1e-9;

// ---------------------------------------------------------------
// Peças pequenas
// ---------------------------------------------------------------

function criarCarteiraVazia() {
  return {
    rcLivre: 0,
    rcBloqueado: 0, // RC preso em ofertas de venda abertas
    capitalRc: 0,   // tudo o que você colocou menos o que tirou
    realizadoRc: 0, // lucro que já aconteceu (recompras)
    ajustesRc: 0,   // diferenças de RC lançadas na conferência com o jogo
    mundos: {},     // id → { gold, custoRc, taxasGold, itens }
    ofertas: {},    // id → situação de cada oferta
    realizados: [], // { data, mundoId, ofertaId, rc, recebidoRc, custoRc }
    realizadosItens: [], // { data, mundoId, itemId, qtd, gold, recebidoGold, custoGold }
    consumos: [],   // { data, mundoId, itemId, qtd, custoGold, custoRc }
    taxas: [],      // { data, mundoId, ofertaId, gold }
    alertas: [],    // avisos de lançamento que parece estar faltando
  };
}

// Devolve o mundo, criando na primeira vez que ele aparece.
function mundoDe(carteira, mundoId) {
  carteira.mundos[mundoId] ??= { gold: 0, custoRc: 0, taxasGold: 0, itens: {} };
  return carteira.mundos[mundoId];
}

// Devolve o item dentro do mundo, criando na primeira vez que ele aparece.
// custoGold = gold que você pagou pelo estoque atual (com taxa).
// custoRc   = quanto RC esse gold tinha custado.
// lucroGold = soma do lucro das vendas já feitas.
function itemDe(mundo, itemId) {
  mundo.itens[itemId] ??= { qtd: 0, custoGold: 0, custoRc: 0, lucroGold: 0 };
  return mundo.itens[itemId];
}

// Taxa de um lançamento: se ele já traz a taxa cobrada, vale ela (é o fato).
// Senão, calcula 5%. Aceitar oferta dos outros (teveTaxa = false) não paga.
function taxaDoEvento(evento) {
  if (!evento.teveTaxa) return 0;
  return evento.taxa ?? taxaCriacao(evento.qtd, evento.preco);
}

function registrarTaxa(carteira, mundo, evento, taxa) {
  if (taxa <= 0) return;
  mundo.taxasGold += taxa;
  carteira.taxas.push({
    data: evento.data,
    mundoId: evento.mundoId,
    ofertaId: evento.ofertaId ?? null,
    itemId: evento.itemId ?? null,
    gold: taxa,
  });
}

// Tira "qtd" do estoque do item e devolve o custo (gold e RC) dessa parte.
function baixarEstoque(item, qtd) {
  const fracao = item.qtd > 0 ? Math.min(1, qtd / item.qtd) : 0;
  const custoGold = item.custoGold * fracao;
  const custoRc = item.custoRc * fracao;

  item.qtd -= Math.min(qtd, item.qtd);
  item.custoGold -= custoGold;
  item.custoRc -= custoRc;

  if (item.qtd <= FOLGA) {
    // estoque zerado: limpa restos de arredondamento
    item.qtd = 0;
    item.custoGold = 0;
    item.custoRc = 0;
  }
  return { custoGold, custoRc };
}

// Quando parte do gold sai, leva junto a mesma proporção do custo.
function parteDoCusto(custoTotal, goldTotal, goldUsado) {
  if (goldTotal <= 0) return 0;
  return custoTotal * Math.min(1, goldUsado / goldTotal);
}

function avisarSeGoldNegativo(carteira, mundoId, data) {
  if (carteira.mundos[mundoId].gold < -FOLGA) {
    carteira.alertas.push(
      `Em ${data} o gold de ${mundoId} ficou negativo. Faltou lançar o gold que você tinha lá?`,
    );
  }
}

function avisarSeRcNegativo(carteira, data) {
  if (carteira.rcLivre < -FOLGA) {
    carteira.alertas.push(
      `Em ${data} o RC livre ficou negativo. Faltou lançar uma entrada de RC?`,
    );
  }
}

// ---------------------------------------------------------------
// O que cada tipo de evento faz com a carteira
// ---------------------------------------------------------------

function encerrarOferta(carteira, evento, statusFinal) {
  const oferta = carteira.ofertas[evento.ofertaId];
  if (!oferta || oferta.status !== "aberta") {
    carteira.alertas.push(`Em ${evento.data} tentou encerrar uma oferta que não está aberta.`);
    return;
  }

  if (oferta.lado === "venda") {
    // o RC que não vendeu volta a ficar livre
    carteira.rcBloqueado -= oferta.restante;
    carteira.rcLivre += oferta.restante;
  } else {
    // o gold que não foi usado volta para o mundo, com o custo dele
    const mundo = mundoDe(carteira, oferta.mundoId);
    mundo.gold += oferta.goldReservado;
    mundo.custoRc += oferta.custoReservado;
    oferta.goldReservado = 0;
    oferta.custoReservado = 0;
  }
  // A taxa já paga NÃO volta.
  oferta.status = statusFinal;
}

const PROCESSADORES = {
  "rc-entrada"(carteira, evento) {
    carteira.rcLivre += evento.qtd;
    carteira.capitalRc += evento.qtd;
  },

  "rc-saida"(carteira, evento) {
    carteira.rcLivre -= evento.qtd;
    carteira.capitalRc -= evento.qtd;
    avisarSeRcNegativo(carteira, evento.data);
  },

  "gold-entrada"(carteira, evento) {
    const mundo = mundoDe(carteira, evento.mundoId);
    const custo = evento.custoRc ?? 0;
    mundo.gold += evento.gold;
    mundo.custoRc += custo;
    carteira.capitalRc += custo;
  },

  "gold-saida"(carteira, evento) {
    const mundo = mundoDe(carteira, evento.mundoId);
    const custo = parteDoCusto(mundo.custoRc, mundo.gold, evento.gold);
    mundo.gold -= evento.gold;
    mundo.custoRc -= custo;
    carteira.capitalRc -= custo;
    avisarSeGoldNegativo(carteira, evento.mundoId, evento.data);
  },

  "ajuste-rc"(carteira, evento) {
    carteira.rcLivre += evento.qtd;
    carteira.ajustesRc += evento.qtd;
  },

  "ajuste-gold"(carteira, evento) {
    // muda o gold sem mexer no custo: a diferença aparece no "em aberto"
    mundoDe(carteira, evento.mundoId).gold += evento.gold;
  },

  "oferta-criada"(carteira, evento) {
    if (carteira.ofertas[evento.ofertaId]) {
      carteira.alertas.push(`A oferta ${evento.ofertaId} foi criada duas vezes.`);
      return;
    }

    const mundo = mundoDe(carteira, evento.mundoId);

    // A taxa tira gold do mundo mas não mexe no custo:
    // o gold que sobra fica mais caro.
    const taxa = taxaDoEvento(evento);
    mundo.gold -= taxa;
    registrarTaxa(carteira, mundo, evento, taxa);

    const oferta = {
      id: evento.ofertaId,
      mundoId: evento.mundoId,
      lado: evento.lado,
      preco: evento.preco,
      qtd: evento.qtd,
      executado: 0,
      restante: evento.qtd,
      taxa,
      status: "aberta",
      criadaEm: evento.data,
      goldReservado: 0,   // só para compra: gold separado para pagar
      custoReservado: 0,  // e quanto RC esse gold custou
    };

    if (evento.lado === "venda") {
      carteira.rcLivre -= evento.qtd;
      carteira.rcBloqueado += evento.qtd;
      avisarSeRcNegativo(carteira, evento.data);
    } else {
      const valor = evento.qtd * evento.preco;
      const custo = parteDoCusto(mundo.custoRc, mundo.gold, valor);
      mundo.gold -= valor;
      mundo.custoRc -= custo;
      oferta.goldReservado = valor;
      oferta.custoReservado = custo;
    }

    carteira.ofertas[evento.ofertaId] = oferta;
    avisarSeGoldNegativo(carteira, evento.mundoId, evento.data);
  },

  "oferta-executada"(carteira, evento) {
    const oferta = carteira.ofertas[evento.ofertaId];
    if (!oferta || oferta.status !== "aberta") {
      carteira.alertas.push(`Em ${evento.data} houve execução de uma oferta que não está aberta.`);
      return;
    }

    let qtd = evento.qtd;
    if (qtd > oferta.restante + FOLGA) {
      carteira.alertas.push(
        `Em ${evento.data} a execução (${qtd} RC) era maior que o restante da oferta (${oferta.restante} RC).`,
      );
      qtd = oferta.restante;
    }

    const mundo = mundoDe(carteira, oferta.mundoId);
    const valor = qtd * oferta.preco;

    if (oferta.lado === "venda") {
      // RC virou gold: esse gold custou "qtd" RC
      carteira.rcBloqueado -= qtd;
      mundo.gold += valor;
      mundo.custoRc += qtd;
    } else {
      // gold virou RC: lucro = RC recebido − custo em RC do gold usado
      const custo = parteDoCusto(oferta.custoReservado, oferta.goldReservado, valor);
      oferta.goldReservado -= valor;
      oferta.custoReservado -= custo;
      carteira.rcLivre += qtd;
      carteira.realizadoRc += qtd - custo;
      carteira.realizados.push({
        data: evento.data,
        mundoId: oferta.mundoId,
        ofertaId: oferta.id,
        rc: qtd - custo,
        recebidoRc: qtd,
        custoRc: custo,
      });
    }

    oferta.executado += qtd;
    oferta.restante -= qtd;
    if (oferta.restante <= FOLGA) {
      oferta.restante = 0;
      oferta.goldReservado = 0;
      oferta.custoReservado = 0;
      oferta.status = "concluida";
    }
  },

  "oferta-cancelada"(carteira, evento) {
    encerrarOferta(carteira, evento, "cancelada");
  },

  "oferta-expirada"(carteira, evento) {
    encerrarOferta(carteira, evento, "expirada");
  },

  "item-comprado"(carteira, evento) {
    const mundo = mundoDe(carteira, evento.mundoId);
    const item = itemDe(mundo, evento.itemId);

    // O que saiu de gold: o preço dos itens + a taxa (se criou a oferta).
    // A taxa entra no custo do item, para o lucro da venda ser o lucro real.
    const taxa = taxaDoEvento(evento);
    const goldGasto = evento.qtd * evento.preco + taxa;
    const custoRc = parteDoCusto(mundo.custoRc, mundo.gold, goldGasto);

    mundo.gold -= goldGasto;
    mundo.custoRc -= custoRc;
    registrarTaxa(carteira, mundo, evento, taxa);

    item.qtd += evento.qtd;
    item.custoGold += goldGasto;
    item.custoRc += custoRc;

    avisarSeGoldNegativo(carteira, evento.mundoId, evento.data);
  },

  "item-vendido"(carteira, evento) {
    const mundo = mundoDe(carteira, evento.mundoId);
    const item = itemDe(mundo, evento.itemId);

    if (evento.qtd > item.qtd + FOLGA) {
      carteira.alertas.push(
        `Em ${evento.data} vendeu ${evento.qtd} de ${evento.itemId} em ${evento.mundoId}, mas o estoque era ${item.qtd}. Faltou lançar uma compra?`,
      );
    }

    const taxa = taxaDoEvento(evento);
    const goldRecebido = evento.qtd * evento.preco - taxa;
    const { custoGold, custoRc } = baixarEstoque(item, evento.qtd);

    // O gold volta para o mundo levando o custo em RC que o item carregava.
    mundo.gold += goldRecebido;
    mundo.custoRc += custoRc;
    registrarTaxa(carteira, mundo, evento, taxa);

    const lucroGold = goldRecebido - custoGold;
    item.lucroGold += lucroGold;
    carteira.realizadosItens.push({
      data: evento.data,
      mundoId: evento.mundoId,
      itemId: evento.itemId,
      qtd: evento.qtd,
      gold: lucroGold,
      recebidoGold: goldRecebido,
      custoGold,
    });

    avisarSeGoldNegativo(carteira, evento.mundoId, evento.data);
  },

  "item-consumido"(carteira, evento) {
    const mundo = mundoDe(carteira, evento.mundoId);
    const item = itemDe(mundo, evento.itemId);

    if (evento.qtd > item.qtd + FOLGA) {
      carteira.alertas.push(
        `Em ${evento.data} consumiu ${evento.qtd} de ${evento.itemId} em ${evento.mundoId}, mas o estoque era ${item.qtd}.`,
      );
    }

    // Usar o item é uma RETIRADA (como tirar gold), não prejuízo de trade:
    // sai do patrimônio e do capital pelo mesmo valor.
    const { custoGold, custoRc } = baixarEstoque(item, evento.qtd);
    carteira.capitalRc -= custoRc;
    carteira.consumos.push({
      data: evento.data,
      mundoId: evento.mundoId,
      itemId: evento.itemId,
      qtd: evento.qtd,
      custoGold,
      custoRc,
    });
  },
};

// Soma, em cada mundo, o que está preso nas ofertas abertas dele.
function somarBloqueadosPorMundo(carteira) {
  for (const mundo of Object.values(carteira.mundos)) {
    mundo.rcBloqueado = 0;
    mundo.goldBloqueado = 0;
    mundo.custoRcBloqueado = 0;
  }
  for (const oferta of Object.values(carteira.ofertas)) {
    if (oferta.status !== "aberta") continue;
    const mundo = carteira.mundos[oferta.mundoId];
    if (oferta.lado === "venda") mundo.rcBloqueado += oferta.restante;
    mundo.goldBloqueado += oferta.goldReservado;
    mundo.custoRcBloqueado += oferta.custoReservado;
  }
}

// ---------------------------------------------------------------
// Funções principais
// ---------------------------------------------------------------

// Percorre a linha do tempo e devolve a carteira.
// "ate" (opcional) calcula como estava no fim daquele dia: { ate: "2026-11-15" }.
export function calcularCarteira(eventos, { ate = null } = {}) {
  const carteira = criarCarteiraVazia();

  for (const evento of eventos) {
    if (ate && evento.data > ate) continue;

    const processar = PROCESSADORES[evento.tipo];
    if (!processar) {
      carteira.alertas.push(`Evento de tipo desconhecido: "${evento.tipo}".`);
      continue;
    }
    processar(carteira, evento);
  }

  somarBloqueadosPorMundo(carteira);
  return carteira;
}

// Coloca preço na carteira usando as cotações de agora.
//   cotacoes    = { mundoId: { compra, venda } }              (RC em gold)
//   precosItens = { mundoId: { itemId: { compra, venda } } }  (item em gold)
//
// Sempre pelo preço em que você SAIRIA agora:
//   • item vira gold pela melhor COMPRA do item (quanto pagam por ele);
//   • gold vira RC pela melhor VENDA de RC do mundo (quanto você paga).
// Sem preço, vale o próprio custo, e fica marcado para a tela avisar.
export function avaliarCarteira(carteira, cotacoes = {}, precosItens = {}) {
  const mundos = {};
  let valorMundosRc = 0;
  let emAbertoRc = 0;

  for (const [mundoId, mundo] of Object.entries(carteira.mundos)) {
    const vendaRc = cotacoes[mundoId]?.venda;

    // ----- gold do mundo -----
    const goldTotal = mundo.gold + mundo.goldBloqueado;
    const custoTotal = mundo.custoRc + mundo.custoRcBloqueado;
    const convertido = liquidarGold(goldTotal, vendaRc);
    const semCotacao = convertido === null;
    const valorRc = semCotacao ? custoTotal : convertido;

    // ----- itens do mundo -----
    const itens = {};
    let valorItensRc = 0;
    let custoItensRc = 0;

    for (const [itemId, item] of Object.entries(mundo.itens)) {
      const precoItem = precosItens[mundoId]?.[itemId]?.compra;
      const semPreco = !precoItem;
      const valorGold = semPreco ? item.custoGold : item.qtd * precoItem;
      const valorItemRc = semCotacao ? item.custoRc : liquidarGold(valorGold, vendaRc);

      itens[itemId] = {
        ...item,
        custoMedioGold: item.qtd > 0 ? item.custoGold / item.qtd : null,
        valorGold,
        emAbertoGold: valorGold - item.custoGold,
        valorRc: valorItemRc,
        emAbertoRc: valorItemRc - item.custoRc,
        semPreco,
      };
      valorItensRc += valorItemRc;
      custoItensRc += item.custoRc;
    }

    mundos[mundoId] = {
      ...mundo,
      itens,
      goldTotal,
      custoTotal,
      precoBase: precoBase(goldTotal, custoTotal),
      valorRc,
      emAbertoRc: valorRc - custoTotal,
      valorItensRc,
      emAbertoItensRc: valorItensRc - custoItensRc,
      semCotacao,
    };
    valorMundosRc += valorRc + valorItensRc;
    emAbertoRc += valorRc - custoTotal + (valorItensRc - custoItensRc);
  }

  const patrimonioRc = carteira.rcLivre + carteira.rcBloqueado + valorMundosRc;

  return {
    mundos,
    patrimonioRc,
    capitalRc: carteira.capitalRc,
    realizadoRc: carteira.realizadoRc,
    emAbertoRc,
    ajustesRc: carteira.ajustesRc,
    // Sempre fecha: resultado = realizado + em aberto + ajustes
    resultadoRc: patrimonioRc - carteira.capitalRc,
  };
}
