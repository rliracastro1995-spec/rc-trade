// registro.js — qual função desenha cada tela.
// Tela que ainda não existe aqui mostra "Em construção".
// Para ligar uma tela nova: importe o arquivo dela e acrescente uma linha.

import { desenharPainel } from "./painel.js";

export const DESENHOS = {
  painel: desenharPainel,
};
