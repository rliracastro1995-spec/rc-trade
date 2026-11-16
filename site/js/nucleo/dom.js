// dom.js — um ajudante curto para montar elementos sem escrever HTML em texto.
//
// el("p", { class: "aviso", texto: "Olá" })
// el("div", { class: "cartao" }, [filho1, filho2])
//
// Usamos texto em vez de innerHTML para nome de item e de mundo nunca
// serem interpretados como HTML.

export function el(tag, props = {}, filhos = []) {
  const no = document.createElement(tag);

  for (const [chave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (chave === "class") no.className = valor;
    else if (chave === "texto") no.textContent = valor;
    else if (chave.startsWith("on")) no.addEventListener(chave.slice(2).toLowerCase(), valor);
    else no.setAttribute(chave, valor === true ? "" : String(valor));
  }

  for (const filho of [].concat(filhos)) {
    if (filho == null || filho === false) continue;
    no.append(filho);
  }
  return no;
}

// Coloca os filhos dentro de "no", trocando o que já estava lá.
// Ignora null e false, para a tela poder decidir não mostrar um pedaço
// (replaceChildren sozinho escreveria a palavra "null" na tela).
export function trocarFilhos(no, filhos) {
  no.replaceChildren(...[].concat(filhos).filter((f) => f != null && f !== false));
  return no;
}
