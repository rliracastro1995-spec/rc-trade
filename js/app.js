// app.js — liga tudo: carrega os dados e troca de tela conforme o # da URL

const PAGINAS = {
  painel: PaginaPainel,
  cotacoes: PaginaCotacoes,
  historico: PaginaHistorico,
  mundos: PaginaMundos,
  backup: PaginaBackup,
};

const App = {
  abrir() {
    const nome = location.hash.replace("#", "") || "painel";
    const pagina = PAGINAS[nome] || PaginaPainel;

    document.querySelectorAll("#menu a").forEach((a) =>
      a.classList.toggle("ativo", a.getAttribute("href") === "#" + nome)
    );
    pagina.render(document.getElementById("conteudo"));
  },

  // Mensagem rápida no canto da tela (sem alert)
  avisar(texto, ehErro = false) {
    const el = document.getElementById("aviso");
    el.textContent = texto;
    el.classList.toggle("erro", ehErro);
    el.hidden = false;
    clearTimeout(App._timer);
    App._timer = setTimeout(() => (el.hidden = true), 3000);
  },
};

Dados.carregar();
window.addEventListener("hashchange", App.abrir);
App.abrir();
