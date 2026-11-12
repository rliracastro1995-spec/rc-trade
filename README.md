# RC Trade

App pessoal para controlar o trade de Rubini Coins (RC) entre os 16 mundos do RubinOT: cotações 3 vezes ao dia, ofertas com execução parcial, carteira, lucro real e fechamento de caixa.

Feito em HTML, CSS e JavaScript puro, sem framework e sem servidor. Os dados ficam no navegador (localStorage), com backup em arquivo JSON.

> Todos os preços são digitados à mão. O app não lê o cliente do jogo nem automatiza nada (regras 2C e 2F do RubinOT).

## Como rodar

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` no navegador (dois cliques já funcionam).
3. No VS Code, a extensão **Live Server** recarrega a página sozinha a cada vez que você salva.

## O que já funciona

| Tela | O que faz |
|---|---|
| Painel | Patrimônio em RC e R$, resultado total, realizado no mês, não realizado, taxas, reserva, % de acerto, avisos, gráfico de 30 dias, ofertas abertas, oportunidades, métricas e composição |
| Cotações | Ronda de manhã, tarde e noite: `74k`, `57,5k`, `1,5kk`; compara com a última e com a média de 7 dias |
| Ofertas | Venda e compra de RC, **Teve taxa? Sim/Não**, prévia antes de confirmar, execuções parciais, cancelar o resto, cenários de recompra |
| Avaliar | Diz se uma oferta do market vale aceitar e mostra as oportunidades em todos os mundos |
| Carteira | RC livre, RC em ofertas, gold e custo por mundo, preço base, itens (pago, recebido, lucro, ROI), lançamentos de saldo e ajustes |
| Fechamento | Dia, semana e mês: resultado, realizado, taxas, comparativo, conferência com o jogo e fechar o dia |
| Histórico | Cotações salvas com filtros |
| Configurações | Taxa, valor do RC em R$, reserva mínima, lucro mínimo, mundos e itens |
| Backup | Baixa e restaura um `.json` |

## Como o lucro é calculado

Tudo é medido em **RC**.

- Cada mundo tem um monte de gold e **quanto RC esse gold custou**. Vendeu 825 RC por 61,875kk → o monte ganhou 61,875kk que custaram 825 RC.
- Taxa tira gold do monte sem mexer no custo: o gold que sobra fica mais caro.
- **Preço base** = gold ÷ custo em RC. Recomprar RC abaixo dele dá lucro.
- **Lucro realizado** = RC recebido na recompra − custo em RC do gold usado (e o lucro dos itens vendidos).
- **Patrimônio** = RC livre + RC em ofertas + (gold e itens de cada mundo ÷ cotação do mundo).
- **Resultado** = Patrimônio − Capital colocado = Realizado + Não realizado.

## Primeiros passos

1. Configurações: marque **Posição aberta** nos mundos onde você tem RC ou gold.
2. Cotações: faça a ronda.
3. Carteira → Lançar movimento: **Entrada de RC** com o RC que você tem hoje e **Entrada de gold** em cada mundo.
4. Ofertas: registre as ofertas abertas no jogo e vá lançando as execuções.
5. No fim do dia: Fechamento → conferir com o jogo → **Fechar o dia**.

## Estrutura

```
rc-trade/
├── index.html            menu e ordem dos scripts
├── css/style.css         cores e layout (variáveis no topo)
├── js/
│   ├── formato.js        ler "74k"/"1,5kk", formatar números, datas e %
│   ├── dados.js          tudo que salva/lê do localStorage (+ migração de versões)
│   ├── calculos.js       cotações: última, média de 7 dias, variação, spread; datas
│   ├── motor.js          carteira: saldos, custo em RC, lucro realizado/não realizado, taxas, métricas
│   ├── ui.js             pedaços de tela reaproveitados (cartões, gráficos, campos)
│   ├── app.js            troca de tela pelo # da URL e avisos
│   └── paginas/          uma tela por arquivo
└── docs/ROADMAP.md       o que já foi feito e o que falta
```
Regra simples para não bagunçar: **telas não mexem no localStorage**. Elas chamam `Dados` (salvar/ler), `Calculos` (cotações) e `Motor` (carteira e lucro). Assim, quando a Fase 7 trocar o localStorage pelo Supabase, só o `dados.js` muda.

## Como trabalhar em dupla

1. Antes de começar: `git pull` na `main`.
2. Crie um branch para a tarefa: `git checkout -b fase2-ofertas`.
3. Faça commits pequenos com mensagem clara: `git commit -m "Ofertas: campo Teve taxa?"`.
4. Suba o branch: `git push -u origin fase2-ofertas`.
5. No GitHub, abra um **Pull Request**. O outro revisa e aprova, e só então faz o merge na `main`.
6. Cada tarefa vira uma **Issue** (veja `docs/ROADMAP.md`). Escreva `Closes #3` no PR para fechar a issue sozinha.

Para não brigarem no mesmo arquivo: cada um pega telas diferentes (um faz `paginas/ofertas.js`, o outro `paginas/carteira.js`).

## Publicar de graça

Settings → Pages → Branch `main` → Save. O app fica em `https://SEU-USUARIO.github.io/rc-trade/`.
Os dados continuam salvos só no navegador de quem abre (cada um tem os seus) até a Fase 7.
