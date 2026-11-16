// roteador.js — troca de tela pelo final do endereço (#painel, #cotacoes...).
// Não recarrega a página: só redesenha a área <main id="conteudo">.

import { PAGINAS, PAGINA_INICIAL } from "../paginas/lista.js";

// Descobre a página pelo endereço. Se for inválida, volta para a inicial.
function paginaAtual() {
  const id = location.hash.replace("#", "");
  return id in PAGINAS ? id : PAGINA_INICIAL;
}

// Deixa azul o link da página aberta no menu.
function marcarMenu(id) {
  document.querySelectorAll("[data-pagina]").forEach((link) => {
    if (link.dataset.pagina === id) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

// Desenha a tela. Por enquanto todas mostram "Em construção".
function desenhar(id) {
  const conteudo = document.getElementById("conteudo");
  const titulo = PAGINAS[id];

  const h1 = document.createElement("h1");
  h1.textContent = titulo;

  const aviso = document.createElement("p");
  aviso.textContent = "Em construção.";

  conteudo.replaceChildren(h1, aviso);
  document.title = `${titulo} · RC Trade`;
}

function irPara(id, { focar = true } = {}) {
  marcarMenu(id);
  desenhar(id);
  if (focar) {
    document.getElementById("conteudo").focus();
  }
}

export function iniciarRoteador() {
  window.addEventListener("hashchange", () => irPara(paginaAtual()));
  irPara(paginaAtual(), { focar: false });
}
