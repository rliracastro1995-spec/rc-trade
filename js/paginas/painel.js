// paginas/painel.js — visão geral do Rubini Coin em todos os mundos
// (Fases seguintes acrescentam patrimônio, lucro real, ofertas abertas e gráficos)

const PaginaPainel = {
  render(main) {
    const hoje = Formato.hoje();
    const itemId = "rc";
    const mundos = Dados.mundosParaRonda();

    const deHoje = Dados.cotacoes().filter((c) => c.data === hoje && c.itemId === itemId);
    const mundosHoje = new Set(deHoje.map((c) => c.mundoId)).size;
    const periodosHoje = ["manha", "tarde", "noite"].filter((p) => deHoje.some((c) => c.periodo === p));
    const rondasTexto = periodosHoje.length
      ? periodosHoje.map((p) => Formato.nomePeriodo[p]).join(", ")
      : "nenhuma ainda";

    const linhas = mundos.map((m) => {
      const ultima = Calculos.ultima(m.id, itemId);
      const venda = Calculos.ultimoValor(m.id, itemId, "venda");
      const compra = Calculos.ultimoValor(m.id, itemId, "compra");
      const media = ultima ? Calculos.media7Dias(m.id, itemId, ultima.data) : null;
      const vsMedia = Calculos.variacao(venda, media);
      return { m, ultima, venda, compra, media, vsMedia };
    });

    // maior desvio da média (para cima ou para baixo) primeiro: é onde pode ter oportunidade
    const comDesvio = linhas.filter((l) => l.vsMedia !== null).sort((a, b) => Math.abs(b.vsMedia) - Math.abs(a.vsMedia));
    const maior = comDesvio[0];

    main.innerHTML = `
      <div class="cabecalho"><h1>Painel</h1><span class="fraco">${Formato.data(hoje)}</span></div>

      <div class="cartoes">
        <div class="cartao">
          <div class="rotulo">Mundos cotados hoje</div>
          <div class="valor">${mundosHoje} <span class="fraco" style="font-size:15px">de ${mundos.length}</span></div>
        </div>
        <div class="cartao">
          <div class="rotulo">Rondas feitas hoje</div>
          <div class="valor" style="font-size:20px">${rondasTexto}</div>
        </div>
        <div class="cartao">
          <div class="rotulo">Maior desvio da média de 7 dias</div>
          <div class="valor ${maior ? (maior.vsMedia > 0 ? "sobe" : "desce") : ""}">${maior ? Formato.percentual(maior.vsMedia) : "—"}</div>
          <div class="sub">${maior ? maior.m.nome + " · " + Formato.numero(maior.venda) : "precisa de pelo menos 2 dias de cotação"}</div>
        </div>
        <div class="cartao">
          <div class="rotulo">Cotações salvas</div>
          <div class="valor">${Formato.numero(Dados.cotacoes().length)}</div>
        </div>
      </div>

      <div class="caixa">
        <h2>Rubini Coin por mundo</h2>
        <table>
          <thead>
            <tr>
              <th>Mundo</th>
              <th class="num">Última venda</th>
              <th class="num">Última compra</th>
              <th class="num">Média 7 dias</th>
              <th class="num">vs. média</th>
              <th class="num">Quando</th>
              <th class="num">Idade</th>
            </tr>
          </thead>
          <tbody>
            ${linhas.map(({ m, ultima, venda, compra, media, vsMedia }) => `
              <tr>
                <td><b>${m.nome}</b>${m.posicao ? '<span class="etiqueta">posição</span>' : ""}</td>
                <td class="num">${Formato.numero(venda)}</td>
                <td class="num">${Formato.numero(compra)}</td>
                <td class="num fraco">${media ? Formato.numero(Math.round(media)) : "—"}</td>
                <td class="num ${vsMedia > 0 ? "sobe" : vsMedia < 0 ? "desce" : "fraco"}">${Formato.percentual(vsMedia)}</td>
                <td class="num fraco">${ultima ? Formato.data(ultima.data).slice(0, 5) + " · " + Formato.nomePeriodo[ultima.periodo] : "—"}</td>
                <td class="num fraco">${Formato.idade(ultima ? ultima.criadoEm : null)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  },
};
