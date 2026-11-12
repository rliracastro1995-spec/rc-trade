// formato.js — ler e escrever números do jeito do jogo (74k, 1,5kk)

const Formato = {
  // Converte o que a pessoa digitou em número de gold.
  // Aceita: "74k" → 74000 | "57,5k" → 57500 | "1,5kk" → 1500000 | "74.000" → 74000 | "74000"
  // Devolve null se estiver vazio e NaN se não der para entender.
  lerGold(texto) {
    if (texto === null || texto === undefined) return null;
    let t = String(texto).trim().toLowerCase().replace(/\s/g, "");
    if (t === "") return null;

    let multiplicador = 1;
    if (t.endsWith("kk")) { multiplicador = 1000000; t = t.slice(0, -2); }
    else if (t.endsWith("k")) { multiplicador = 1000; t = t.slice(0, -1); }

    if (multiplicador === 1) {
      // Sem k: ponto é separador de milhar ("74.000"), vírgula é decimal
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      // Com k: "57,5k" ou "57.5k" são decimais
      t = t.replace(",", ".");
    }

    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Math.round(Number(t) * multiplicador);
  },

  // 74000 → "74.000"
  numero(n, casas = 0) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  },

  // 74000 → "74k" | 1500000 → "1,5kk"
  curto(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    if (Math.abs(n) >= 1000000) {
      let t = Formato.numero(n / 1000000, 3);
      if (t.includes(",")) t = t.replace(/0+$/, "").replace(/,$/, "");
      return t + "kk";
    }
    if (Math.abs(n) >= 1000) return Formato.numero(n / 1000, n % 1000 === 0 ? 0 : 1) + "k";
    return Formato.numero(n);
  },

  // 0.039 → "+3,9%"
  percentual(p) {
    if (p === null || p === undefined || isNaN(p)) return "—";
    const sinal = p > 0 ? "+" : p < 0 ? "−" : "";
    return sinal + Formato.numero(Math.abs(p) * 100, 1) + "%";
  },

  // "2026-11-11" → "11/11/2026"
  data(iso) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  },

  // Data de hoje no formato "2026-11-11" (horário local, não UTC)
  hoje() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  },

  // Quanto tempo passou desde um momento (em ms) → "agora", "3h", "2 dias"
  idade(ms) {
    if (!ms) return "—";
    const horas = (Date.now() - ms) / 3600000;
    if (horas < 1) return "agora";
    if (horas < 24) return Math.floor(horas) + "h";
    const dias = Math.floor(horas / 24);
    return dias === 1 ? "1 dia" : dias + " dias";
  },

  // Período pelo horário: manhã até 12h, tarde até 18h, noite depois
  periodoAgora() {
    const h = new Date().getHours();
    if (h < 12) return "manha";
    if (h < 18) return "tarde";
    return "noite";
  },

  nomePeriodo: { manha: "Manhã", tarde: "Tarde", noite: "Noite" },

  // Protege textos digitados (notas, nomes) antes de pôr no HTML
  esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
};
