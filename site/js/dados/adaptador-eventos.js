// adaptador-eventos.js — a ponte entre os dados guardados e o motor.
//
// O que está salvo são "tabelas": movimentos, ofertas e execuções, com o RC
// em décimos. O motor da carteira espera uma LINHA DO TEMPO de eventos, em
// ordem, com RC natural. Este arquivo faz essa tradução.
//
// REGRAS DESTE ARQUIVO:
//   • Não lê nem grava nada: recebe o estado e devolve a lista de eventos.
//   • É o único lugar onde décimos viram RC natural na ida para o motor.
//   • Não altera o estado que recebe.
//
// AINDA NÃO ENTRA AQUI: lançamentos de itens (o motor ainda não trata itens).

// ---------- Conversão de unidade ----------
const decimosParaRc = (decimos) => (decimos ?? 0) / 10;

// ---------- Ordem ----------
const ORDEM_TURNO = { manha: 0, tarde: 1, noite: 2 };

// Desempate quando dois eventos têm exatamente o mesmo momento:
// o que traz saldo vem antes do que gasta.
const PRIORIDADE = {
  "rc-entrada": 0,
  "gold-entrada": 0,
  "ajuste-rc": 1,
  "ajuste-gold": 1,
  "oferta-criada": 2,
  "oferta-executada": 3,
  "oferta-cancelada": 4,
  "oferta-expirada": 4,
  "rc-saida": 5,
  "gold-saida": 5,
};

// Movimentos cuja quantidade é RC (nos outros a quantidade é gold).
const MOVIMENTOS_EM_RC = ["rc-entrada", "rc-saida", "ajuste-rc"];

// Ordena por: dia → turno → hora em que foi lançado → prioridade do tipo.
// O dia e o turno vêm primeiro porque você pode lançar hoje algo de ontem.
function compararEventos(a, b) {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;

  const turnoA = ORDEM_TURNO[a.turno] ?? 0;
  const turnoB = ORDEM_TURNO[b.turno] ?? 0;
  if (turnoA !== turnoB) return turnoA - turnoB;

  // sem horário de lançamento, o evento vai para o fim do turno
  const horaA = a.criadoEm ?? Infinity;
  const horaB = b.criadoEm ?? Infinity;
  if (horaA !== horaB) return horaA < horaB ? -1 : 1;

  return (PRIORIDADE[a.tipo] ?? 9) - (PRIORIDADE[b.tipo] ?? 9);
}

// ---------- Cada tabela vira eventos ----------

function eventoDoMovimento(m) {
  const base = {
    tipo: m.tipo,
    data: m.data,
    turno: m.turno,
    criadoEm: m.criadoEm ?? null,
    origemId: m.id,
  };

  if (MOVIMENTOS_EM_RC.includes(m.tipo)) {
    return { ...base, qtd: decimosParaRc(m.qtd) };
  }

  const evento = { ...base, mundoId: m.mundoId, gold: m.qtd };
  if (m.tipo === "gold-entrada") {
    evento.custoRc = decimosParaRc(m.valorRc); // quanto RC esse gold custou
  }
  return evento;
}

// Uma oferta vira 1 evento de criação e, se foi encerrada, mais 1 de encerramento.
function eventosDaOferta(o) {
  const eventos = [
    {
      tipo: "oferta-criada",
      data: o.data,
      turno: o.turno,
      criadoEm: o.criadoEm ?? null,
      origemId: o.id,
      ofertaId: o.id,
      mundoId: o.mundoId,
      lado: o.tipo, // "venda" ou "compra" de RC
      qtd: decimosParaRc(o.qtd),
      preco: o.preco,
      teveTaxa: Boolean(o.teveTaxa),
      taxa: o.taxa ?? null, // a taxa cobrada de fato; sem ela, o motor calcula
    },
  ];

  if (o.status === "cancelada" || o.status === "expirada") {
    eventos.push({
      tipo: o.status === "cancelada" ? "oferta-cancelada" : "oferta-expirada",
      data: o.canceladaData ?? o.data,
      turno: o.canceladaTurno ?? o.turno,
      criadoEm: o.canceladaEm ?? null,
      origemId: o.id,
      ofertaId: o.id,
    });
  }
  return eventos;
}

function eventoDaExecucao(x) {
  return {
    tipo: "oferta-executada",
    data: x.data,
    turno: x.turno,
    criadoEm: x.criadoEm ?? null,
    origemId: x.id,
    ofertaId: x.ofertaId,
    qtd: decimosParaRc(x.qtd),
  };
}

// ---------- Função principal ----------

// Recebe o estado guardado e devolve a linha do tempo, já em ordem,
// pronta para o calcularCarteira().
export function gerarLinhaDoTempo(estado) {
  const eventos = [
    ...(estado?.movimentos ?? []).map(eventoDoMovimento),
    ...(estado?.ofertas ?? []).flatMap(eventosDaOferta),
    ...(estado?.execucoes ?? []).map(eventoDaExecucao),
  ];
  return eventos.sort(compararEventos);
}
