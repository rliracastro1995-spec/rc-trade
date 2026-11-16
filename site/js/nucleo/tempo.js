// tempo.js — ordem dos turnos e comparação de momentos.
// Fica aqui porque a ponte de eventos e as cotações usam a mesma regra.

export const ORDEM_TURNO = { manha: 0, tarde: 1, noite: 2 };

export const NOME_TURNO = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

// Compara dois lançamentos por dia e turno. Devolve < 0 se "a" veio antes.
export function compararMomento(a, b) {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  return (ORDEM_TURNO[a.turno] ?? 0) - (ORDEM_TURNO[b.turno] ?? 0);
}
