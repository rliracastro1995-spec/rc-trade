// paginas/avaliar.js — vale a pena aceitar essa oferta? + oportunidades em todos os mundos

const PaginaAvaliar = {
  lado: "comprar", // "comprar" = vi alguém VENDENDO RC (eu compro) · "vender" = vi alguém COMPRANDO RC (eu vendo)

  render(main) {
    const { E, A } = Motor.agora();
    PaginaAvaliar.A = A;
    const mundoInicial = (A.mundos.find((m) => m.gold > 0) || Dados.mundosParaRonda()[0] || {}).id;

    main.innerHTML = `
      <div class="cabecalho"><h1>Avaliar oferta</h1></div>
      <div class="duas-colunas">
        <div class="caixa">
          <h2>A oferta que você viu no market</h2>
          <div class="form">
            <label>Mundo<select id="av-mundo">${UI.opcoesMundos(mundoInicial)}</select></label>
            <label>Preço por RC<input id="av-preco" placeholder="Ex.: 70k" inputmode="decimal"></label>
            <label class="inteiro">Que oferta é?
              <div class="grupo largo" id="av-lado">
                <button data-v="comprar" class="${PaginaAvaliar.lado === "comprar" ? "ativo" : ""}">Alguém vendendo RC → eu compro</button>
                <button data-v="vender" class="${PaginaAvaliar.lado === "vender" ? "ativo" : ""}">Alguém comprando RC → eu vendo</button>
              </div>
            </label>
            <label>Quantidade na oferta (opcional)<input id="av-qtd" placeholder="Ex.: 600" inputmode="decimal"></label>
          </div>
          <p class="fraco">Aceitar uma oferta que já está no market não paga taxa.</p>
        </div>
        <div class="caixa" id="av-resultado"></div>
      </div>
      <div class="caixa">
        <h2>Oportunidades agora em todos os mundos</h2>
        <div id="av-oportunidades"></div>
      </div>`;

    const atualizar = () => {
      main.querySelector("#av-resultado").innerHTML = PaginaAvaliar.resultado(
        main.querySelector("#av-mundo").value,
        Formato.lerGold(main.querySelector("#av-preco").value),
        Formato.lerGold(main.querySelector("#av-qtd").value)
      );
    };
    main.querySelectorAll("#av-lado button").forEach((b) =>
      b.addEventListener("click", () => {
        PaginaAvaliar.lado = b.dataset.v;
        main.querySelectorAll("#av-lado button").forEach((x) => x.classList.toggle("ativo", x === b));
        atualizar();
      })
    );
    ["#av-mundo", "#av-preco", "#av-qtd"].forEach((s) => main.querySelector(s).addEventListener("input", atualizar));
    atualizar();
    main.querySelector("#av-oportunidades").innerHTML = PaginaAvaliar.oportunidades();
  },

  resultado(mundoId, preco, qtdOferta) {
    const cfg = Dados.config();
    const A = PaginaAvaliar.A;
    const nome = Dados.nomeMundo(mundoId);
    const w = A.mundos.find((m) => m.id === mundoId) || { gold: 0, precoBase: null };
    const media = Calculos.media7Dias(mundoId, "rc", Formato.hoje());
    if (!(preco > 0)) return `<h2>Resultado</h2><div class="vazio">Digite o preço da oferta.</div>`;

    const kv = (r, v, cls = "") => `<div class="kv"><span class="fraco">${r}</span><b class="${cls}">${v}</b></div>`;
    let html = "", veredito, classe;

    if (PaginaAvaliar.lado === "comprar") {
      if (!w.precoBase) {
        return `<h2>Resultado</h2><div class="nota-alerta">Você não tem gold com custo registrado no ${nome}.
          Lance o gold em <b>Carteira → Lançar movimento</b> ou registre uma venda de RC nesse mundo.</div>`;
      }
      const lucro = w.precoBase / preco - 1;
      const podeComprar = Math.floor(w.gold / preco);
      const compra = qtdOferta > 0 ? Math.min(podeComprar, qtdOferta) : podeComprar;
      const custoRc = (compra * preco) / w.precoBase;
      html += kv("Seu preço base no " + nome, Formato.numero(Math.round(w.precoBase)));
      html += kv("Lucro por RC", Formato.percentual(lucro), UI.cor(lucro));
      html += kv("Dá para comprar com seu gold", `${Formato.numero(podeComprar)} RC`);
      html += kv(`Comprando ${Formato.numero(compra)} RC`, UI.rc(compra - custoRc, 1), UI.cor(compra - custoRc));
      html += kv("Gold que sobra", UI.kk(w.gold - compra * preco));
      html += kv("Média de 7 dias", media ? Formato.numero(Math.round(media)) : "—");
      if (lucro >= cfg.lucroMinimo) { veredito = "Vale aceitar"; classe = "nota-ok"; }
      else if (lucro >= 0) { veredito = "Lucro pequeno: só se quiser liberar o gold"; classe = "nota-alerta"; }
      else { veredito = "Não aceitar: você recebe menos RC do que vendeu"; classe = "nota-erro"; }
    } else {
      const vende = qtdOferta > 0 ? Math.min(qtdOferta, A.rcLivre) : A.rcLivre;
      const desvio = media ? preco / media - 1 : null;
      html += kv("Seu RC livre", UI.rc(A.rcLivre, 0, false));
      html += kv(`Vendendo ${Formato.numero(vende)} RC você recebe`, UI.kk(vende * preco));
      html += kv("Equilíbrio da recompra (aceitando)", Formato.numero(preco), "destaque");
      html += kv("Equilíbrio da recompra (criando oferta)", Formato.numero(Math.round(preco / (1 + cfg.taxa))));
      html += kv("Preço vs. média de 7 dias", desvio === null ? "sem histórico" : Formato.percentual(desvio), desvio > 0 ? "lucro" : "prejuizo");
      if (desvio === null) { veredito = "Sem histórico para comparar: faça mais rondas de cotação"; classe = "nota-alerta"; }
      else if (desvio >= 0.05) { veredito = "Preço bem acima da média: bom momento para vender"; classe = "nota-ok"; }
      else if (desvio >= 0) { veredito = "Um pouco acima da média: só vale se o preço costuma cair depois"; classe = "nota-alerta"; }
      else { veredito = "Abaixo da média: melhor esperar"; classe = "nota-erro"; }
      if (A.reserva !== null && vende > 0 && (A.rcLivre - vende) / A.patrimonioRc < cfg.reservaMinima) {
        html += `<div class="nota-alerta">Vendendo isso sua reserva em RC fica abaixo de ${Formato.numero(cfg.reservaMinima * 100)}%.</div>`;
      }
    }
    return `<h2>Resultado</h2><div class="${classe} veredito">${veredito}</div>${html}`;
  },

  oportunidades() {
    const cfg = Dados.config();
    const A = PaginaAvaliar.A;
    const hoje = Formato.hoje();
    const linhas = Dados.mundosParaRonda().map((m) => {
      const w = A.mundos.find((x) => x.id === m.id);
      const venda = Calculos.cotacaoAte(m.id, "rc");
      const compra = Calculos.cotacaoAte(m.id, "rc", null, "compra");
      const media = Calculos.media7Dias(m.id, "rc", hoje);
      const desvio = venda && media ? venda / media - 1 : null;
      const recompra = w && w.lucroRecompraAgora;
      let ideia = "", cls = "fraco";
      if (recompra !== null && recompra !== undefined && w.gold > 0) {
        if (recompra >= cfg.lucroMinimo) { ideia = `Recomprar: ${Formato.percentual(recompra)}`; cls = "lucro"; }
        else if (recompra >= 0) { ideia = `Recompra empata (${Formato.percentual(recompra)})`; }
        else { ideia = `Esperar cair (${Formato.percentual(recompra)})`; cls = "prejuizo"; }
      }
      if (desvio !== null && desvio >= 0.05 && A.rcLivre > 0) {
        const vender = `Bom p/ vender RC: ${Formato.percentual(desvio)} acima da média`;
        if (cls === "lucro") ideia += " · " + vender;
        else { ideia = vender + (ideia ? " · " + ideia : ""); cls = "sobe"; }
      }
      return { m, w, venda, compra, media, desvio, ideia, cls, peso: Math.abs(recompra || 0) + Math.abs(desvio || 0) };
    }).filter((l) => l.venda || (l.w && l.w.gold));

    if (!linhas.length) return `<div class="vazio">Faça uma ronda de cotação para ver as oportunidades.</div>`;
    linhas.sort((a, b) => (b.ideia ? 1 : 0) - (a.ideia ? 1 : 0) || b.peso - a.peso);

    return `<table><thead><tr><th>Mundo</th><th class="num">Venda</th><th class="num">Compra</th><th class="num">Média 7d</th>
      <th class="num">vs. média</th><th class="num">Seu gold</th><th class="num">Preço base</th><th>Leitura</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr>
        <td><b>${l.m.nome}</b></td>
        <td class="num">${Formato.numero(l.venda)}</td>
        <td class="num">${Formato.numero(l.compra)}</td>
        <td class="num fraco">${l.media ? Formato.numero(Math.round(l.media)) : "—"}</td>
        <td class="num ${l.desvio > 0 ? "sobe" : l.desvio < 0 ? "desce" : "fraco"}">${Formato.percentual(l.desvio)}</td>
        <td class="num">${l.w ? UI.kk(l.w.gold) : "—"}</td>
        <td class="num">${l.w && l.w.precoBase ? Formato.numero(Math.round(l.w.precoBase)) : "—"}</td>
        <td class="${l.cls}">${l.ideia || "—"}</td></tr>`).join("")}</tbody></table>
      <p class="fraco">Preço base = cotação em que recomprar RC com o gold daquele mundo empata. Abaixo dele, a recompra dá lucro.</p>`;
  },
};
