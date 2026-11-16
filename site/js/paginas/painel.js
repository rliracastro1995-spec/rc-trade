// painel.js — a tela Painel: a visão geral da carteira.
//
// Esta tela não calcula nada. Ela lê o estado guardado, pede o número ao
// motor e mostra. O motor é a única fonte da verdade.

import { el, trocarFilhos } from "../nucleo/dom.js";
import {
  formatarGold,
  formatarRc,
  formatarRcComSinal,
  formatarReais,
  formatarData,
} from "../nucleo/formato.js";
import { obterEstado, importarDoLegado, lerDadosLegado } from "../dados/armazenamento.js";
import { gerarLinhaDoTempo } from "../dados/adaptador-eventos.js";
import { calcularCarteira, avaliarCarteira } from "../motor/carteira.js";
import { ultimaCotacaoPorMundo, ultimoPrecoPorItem } from "../motor/cotacoes.js";

// ---------------------------------------------------------------
// Pedaços da tela
// ---------------------------------------------------------------

// Um número grande com um rótulo em cima.
function indicador(rotulo, valor, { apoio = null, cor = null } = {}) {
  return el("div", { class: "indicador" }, [
    el("p", { class: "indicador-rotulo", texto: rotulo }),
    el("p", { class: `indicador-valor ${cor ?? ""}`.trim(), texto: valor }),
    apoio && el("p", { class: "indicador-apoio", texto: apoio }),
  ]);
}

// Verde para lucro, coral para prejuízo, nada para zero.
function corDoResultado(valor) {
  if (!Number.isFinite(valor) || Math.round(valor * 10) === 0) return null;
  return valor > 0 ? "lucro" : "prejuizo";
}

function linhaDoCartao(rotulo, valor, { cor = null, titulo = null } = {}) {
  return el("div", { class: "cartao-linha", title: titulo }, [
    el("span", { class: "cartao-rotulo", texto: rotulo }),
    el("span", { class: `cartao-valor ${cor ?? ""}`.trim(), texto: valor }),
  ]);
}

function cartaoDoMundo(mundoId, mundo, nomes, cotacao) {
  const itens = Object.entries(mundo.itens ?? {}).filter(([, i]) => i.qtd > 0);
  const goldEmItens = itens.reduce((soma, [, i]) => soma + i.valorGold, 0);

  return el("article", { class: "cartao-mundo" }, [
    el("header", { class: "cartao-topo" }, [
      el("h3", { texto: nomes.mundo(mundoId) }),
      mundo.semCotacao
        ? el("span", { class: "etiqueta-aviso", texto: "sem cotação" })
        : el("span", {
            class: "etiqueta",
            texto: `venda ${formatarGold(cotacao?.venda)}`,
            title: `Cotação de ${formatarData(cotacao?.data)}`,
          }),
    ]),

    el("div", { class: "cartao-corpo" }, [
      linhaDoCartao("Gold", formatarGold(mundo.goldTotal)),
      linhaDoCartao("Custo em RC", formatarRc(mundo.custoTotal)),
      linhaDoCartao("Preço base", formatarGold(mundo.precoBase), {
        titulo: "Cotação em que a recompra empata",
      }),
      linhaDoCartao("Vale em RC", formatarRc(mundo.valorRc)),
      linhaDoCartao("Em aberto", formatarRcComSinal(mundo.emAbertoRc), {
        cor: corDoResultado(mundo.emAbertoRc),
      }),
    ]),

    itens.length > 0 &&
      el("div", { class: "cartao-itens" }, [
        el("div", { class: "cartao-linha cartao-itens-titulo" }, [
          el("span", { texto: "Itens" }),
          el("span", { texto: formatarGold(goldEmItens) }),
        ]),
        ...itens.map(([itemId, item]) =>
          el("div", { class: "cartao-linha" }, [
            el("span", { class: "cartao-rotulo", texto: `${item.qtd}× ${nomes.item(itemId)}` }),
            el("span", {
              class: `cartao-valor ${corDoResultado(item.emAbertoGold) ?? ""}`.trim(),
              texto: formatarGold(item.valorGold),
              title: `Custo médio ${formatarGold(item.custoMedioGold)} por unidade`,
            }),
          ]),
        ),
      ]),
  ]);
}

function painelDeAlertas(alertas) {
  if (alertas.length === 0) return null;
  return el("section", { class: "alertas" }, [
    el("h2", { texto: `Conferir ${alertas.length === 1 ? "1 lançamento" : `${alertas.length} lançamentos`}` }),
    el("ul", {}, alertas.map((a) => el("li", { texto: a }))),
  ]);
}

function acoesRapidas() {
  const acoes = [
    ["Nova oferta", "#ofertas"],
    ["Registrar item", "#itens"],
    ["Lançar cotação", "#cotacoes"],
  ];
  return el("section", { class: "acoes-rapidas" }, [
    el("h2", { texto: "Ações rápidas" }),
    el(
      "div",
      { class: "acoes-botoes" },
      acoes.map(([texto, destino]) =>
        el("a", { class: "botao", href: destino, texto }),
      ),
    ),
  ]);
}

// ---------------------------------------------------------------
// Tela vazia: ainda não há nada lançado
// ---------------------------------------------------------------

function telaVazia(aoImportar) {
  const temLegado = Boolean(lerDadosLegado());

  return el("div", { class: "vazio" }, [
    el("h2", { texto: "Nenhum lançamento ainda" }),
    el("p", {
      texto: temLegado
        ? "Encontrei os dados do app antigo neste navegador. Posso trazer tudo para cá."
        : "Comece lançando a sua cotação do dia e o RC que você tem hoje.",
    }),
    temLegado
      ? el("button", { class: "botao botao-primario", type: "button", onclick: aoImportar },
          "Importar do app antigo")
      : el("a", { class: "botao botao-primario", href: "#cotacoes", texto: "Lançar cotação" }),
  ]);
}

// ---------------------------------------------------------------
// Montagem da tela
// ---------------------------------------------------------------

export function desenharPainel(conteudo) {
  const estado = obterEstado();

  // ids viram nomes na tela: "auroria" → "Auroria", "tibia-coin" → "Tibia Coin"
  const porId = (lista) => Object.fromEntries((lista ?? []).map((x) => [x.id, x.nome]));
  const nomesMundos = porId(estado.mundos);
  const nomesItens = porId(estado.itens);
  const nomes = {
    mundo: (id) => nomesMundos[id] ?? id,
    item: (id) => nomesItens[id] ?? id,
  };

  const carteira = calcularCarteira(gerarLinhaDoTempo(estado));
  const cotacoes = ultimaCotacaoPorMundo(estado.cotacoes);
  const avaliacao = avaliarCarteira(carteira, cotacoes, ultimoPrecoPorItem(estado.precosItens));

  const mundos = Object.entries(avaliacao.mundos).filter(
    ([, m]) => m.goldTotal !== 0 || Object.values(m.itens ?? {}).some((i) => i.qtd > 0),
  );

  const semNada =
    carteira.rcLivre === 0 && carteira.rcBloqueado === 0 && mundos.length === 0;

  if (semNada) {
    trocarFilhos(conteudo, [
      el("h1", { texto: "Painel" }),
      telaVazia(() => {
        const resumo = importarDoLegado();
        if (resumo) desenharPainel(conteudo); // redesenha já com os dados
      }),
    ]);
    return;
  }

  const reaisPorRc = estado.config?.reaisPorRc ?? 0.1;
  mundos.sort((a, b) => b[1].valorRc - a[1].valorRc);

  trocarFilhos(conteudo, [
    el("h1", { texto: "Painel" }),

    el("section", { class: "indicadores" }, [
      indicador("Patrimônio", formatarRc(avaliacao.patrimonioRc), {
        apoio: formatarReais(avaliacao.patrimonioRc, reaisPorRc),
      }),
      indicador("RC livre", formatarRc(carteira.rcLivre)),
      indicador("RC em ofertas", formatarRc(carteira.rcBloqueado)),
      indicador("Resultado", formatarRcComSinal(avaliacao.resultadoRc), {
        apoio: `realizado ${formatarRcComSinal(avaliacao.realizadoRc)} · em aberto ${formatarRcComSinal(avaliacao.emAbertoRc)}`,
        cor: corDoResultado(avaliacao.resultadoRc),
      }),
    ]),

    painelDeAlertas(carteira.alertas),

    el("section", { class: "mundos" }, [
      el("h2", { texto: "Mundos" }),
      mundos.length === 0
        ? el("p", { class: "apoio", texto: "Você ainda não tem gold em nenhum mundo." })
        : el(
            "div",
            { class: "grade-mundos" },
            mundos.map(([id, mundo]) => cartaoDoMundo(id, mundo, nomes, cotacoes[id])),
          ),
    ]),

    acoesRapidas(),
  ]);
}
