// tema.js — troca entre tema claro e escuro e lembra a escolha.

const CHAVE = "rctrade-tema";
const TEMAS = ["claro", "escuro"];

// Lê o tema salvo. Se não tiver (ou o navegador bloquear), usa "claro".
function lerTemaSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return TEMAS.includes(salvo) ? salvo : "claro";
  } catch {
    return "claro";
  }
}

function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem permissão para salvar: o tema funciona, só não é lembrado.
  }
}

// Aplica o tema na página e marca o botão certo como pressionado.
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;

  document.querySelectorAll("[data-escolha-tema]").forEach((botao) => {
    const ativo = botao.dataset.escolhaTema === tema;
    botao.setAttribute("aria-pressed", String(ativo));
  });
}

export function iniciarTema() {
  aplicarTema(lerTemaSalvo());

  document.querySelectorAll("[data-escolha-tema]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const tema = botao.dataset.escolhaTema;
      aplicarTema(tema);
      salvarTema(tema);
    });
  });
}
