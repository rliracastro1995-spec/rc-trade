// app.js — ponto de partida do RC Trade.
// Só liga as peças; cada peça fica no seu próprio arquivo.

import { iniciarTema } from "./nucleo/tema.js";
import { iniciarRoteador } from "./nucleo/roteador.js";

iniciarTema();
iniciarRoteador();
