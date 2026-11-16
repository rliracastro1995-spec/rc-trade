// formato.js — como os números aparecem na tela.
// Só formata: não calcula nada. Toda tela usa estas funções, para o app
// inteiro mostrar os números do mesmo jeito.

const VAZIO = "—";

const ehNumero = (n) => typeof n === "number" && Number.isFinite(n);

function comSeparador(n, casas = 0) {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

// 3500000 → "3.500.000"
export function formatarGold(gold) {
  if (!ehNumero(gold)) return VAZIO;
  return comSeparador(Math.round(gold));
}

// 3500000 → "3,5kk" | 74000 → "74k" | 850 → "850"
export function formatarGoldCurto(gold) {
  if (!ehNumero(gold)) return VAZIO;
  const absoluto = Math.abs(gold);
  if (absoluto >= 1_000_000) return `${comSeparador(gold / 1_000_000, 2).replace(/,?0+$/, "")}kk`;
  if (absoluto >= 1_000) return `${comSeparador(gold / 1_000, 1).replace(/,0$/, "")}k`;
  return comSeparador(Math.round(gold));
}

// 1250 → "1.250" | 1004.2857 → "1.004,3" (RC tem 1 casa: é guardado em décimos)
export function formatarRc(rc) {
  if (!ehNumero(rc)) return VAZIO;
  const arredondado = Math.round(rc * 10) / 10;
  return comSeparador(arredondado, Number.isInteger(arredondado) ? 0 : 1);
}

// Com sinal na frente, para resultado: 4.3 → "+4,3"
export function formatarRcComSinal(rc) {
  if (!ehNumero(rc)) return VAZIO;
  const texto = formatarRc(Math.abs(rc));
  if (Math.round(rc * 10) === 0) return texto;
  return (rc > 0 ? "+" : "−") + texto;
}

// RC → reais, usando quanto vale 1 RC (0,10 por padrão): 1250 → "R$ 125,00"
export function formatarReais(rc, reaisPorRc = 0.1) {
  if (!ehNumero(rc)) return VAZIO;
  return (rc * reaisPorRc).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// 0.039 → "+3,9%"
export function formatarPercentual(fracao, casas = 1) {
  if (!ehNumero(fracao)) return VAZIO;
  const sinal = fracao > 0 ? "+" : fracao < 0 ? "−" : "";
  return `${sinal}${comSeparador(Math.abs(fracao) * 100, casas)}%`;
}

// "2026-11-16" → "16/11/2026"
export function formatarData(iso) {
  if (typeof iso !== "string" || iso.length < 10) return VAZIO;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Hoje em "2026-11-16" (horário daqui, não UTC)
export function hoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// Lê o que a pessoa digitou e devolve gold.
// Aceita "74k", "57,5k", "1,5kk", "74.000" e "74000".
// Devolve null se estiver vazio e NaN se não der para entender.
export function lerGold(texto) {
  if (texto == null) return null;
  let t = String(texto).trim().toLowerCase().replace(/\s/g, "");
  if (t === "") return null;

  let multiplicador = 1;
  if (t.endsWith("kk")) {
    multiplicador = 1_000_000;
    t = t.slice(0, -2);
  } else if (t.endsWith("k")) {
    multiplicador = 1_000;
    t = t.slice(0, -1);
  }

  // sem k, o ponto é separador de milhar ("74.000"); com k, é decimal ("57.5k")
  t = multiplicador === 1 ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(Number(t) * multiplicador);
}
