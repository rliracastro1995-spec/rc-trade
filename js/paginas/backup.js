// paginas/backup.js — baixar e restaurar os dados (o localStorage pode ser apagado pelo navegador)

const PaginaBackup = {
  render(main) {
    main.innerHTML = `
      <div class="cabecalho"><h1>Backup</h1></div>

      <div class="dica">
        Os dados ficam só neste navegador. Baixe um backup toda semana e guarde no Drive.
        Para passar os dados para outro computador: baixe aqui e restaure lá.
      </div>

      <div class="caixa">
        <h2>Baixar backup</h2>
        <p class="fraco">${Formato.numero(Dados.cotacoes().length)} cotações, ${Dados.ofertas().length} ofertas, ${Dados.movimentos().length + Dados.lancamentosItens().length} lançamentos, ${Dados.fechamentos().length} dias fechados.</p>
        <button class="principal" id="baixar">Baixar arquivo .json</button>
      </div>

      <div class="caixa">
        <h2>Restaurar backup</h2>
        <p class="fraco">Substitui tudo o que está salvo agora pelo conteúdo do arquivo.</p>
        <input type="file" id="arquivo" accept=".json,application/json" style="max-width:420px">
      </div>

      <div class="caixa">
        <h2>Começar do zero</h2>
        <p class="fraco">Apaga todas as cotações e configurações deste navegador.</p>
        <button class="perigo" id="apagar">Apagar tudo</button>
      </div>
    `;

    main.querySelector("#baixar").addEventListener("click", () => {
      const blob = new Blob([Dados.exportar()], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rctrade-backup-${Formato.hoje()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });

    main.querySelector("#arquivo").addEventListener("change", async (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      try {
        Dados.importar(await arquivo.text());
        App.avisar("Backup restaurado.");
        PaginaBackup.render(main);
      } catch (erro) {
        App.avisar(erro.message || "Não consegui ler esse arquivo.", true);
      }
    });

    const botaoApagar = main.querySelector("#apagar");
    botaoApagar.addEventListener("click", () => {
      if (botaoApagar.dataset.confirmar) {
        Dados.apagarTudo();
        App.avisar("Tudo apagado.");
        PaginaBackup.render(main);
      } else {
        botaoApagar.dataset.confirmar = "1";
        botaoApagar.textContent = "Clique de novo para confirmar";
      }
    });
  },
};
