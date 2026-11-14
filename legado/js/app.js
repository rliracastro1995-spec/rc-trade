// app.js — liga tudo: carrega os dados e troca de tela conforme o # da URL

const PAGINAS = {
  painel: PaginaPainel,
  cotacoes: PaginaCotacoes,
  ofertas: PaginaOfertas,
  avaliar: PaginaAvaliar,
  carteira: PaginaCarteira,
  fechamento: PaginaFechamento,
  historico: PaginaHistorico,
  config: PaginaMundos,
  backup: PaginaBackup,
};

const App = {
  abrir() {
    const nome = location.hash.replace("#", "") || "painel";
    const pagina = PAGINAS[nome] || PaginaPainel;

    document.querySelectorAll("#menu a").forEach((a) =>
      a.classList.toggle("ativo", a.getAttribute("href") === "#" + nome)
    );
    const main = document.getElementById("conteudo");
    try {
      pagina.render(main);
    } catch (erro) {
      console.error(erro);
      main.innerHTML = `<div class="nota-erro">Algo deu errado nesta tela: ${Formato.esc(erro.message)}.
        Seus dados continuam salvos. Faça um backup e me mande o erro.</div>`;
    }
    window.scrollTo(0, 0);
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
