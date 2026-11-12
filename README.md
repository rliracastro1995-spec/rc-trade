# RC Trade

App pessoal para controlar o trade de Rubini Coins (RC) entre os 16 mundos do RubinOT: cotações 3 vezes ao dia, ofertas com execução parcial, carteira, lucro real e fechamento de caixa.

Feito em HTML, CSS e JavaScript puro, sem framework e sem servidor. Os dados ficam no navegador (localStorage), com backup em arquivo JSON.

> Todos os preços são digitados à mão. O app não lê o cliente do jogo nem automatiza nada (regras 2C e 2F do RubinOT).

## Como rodar

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` no navegador (dois cliques já funcionam).
3. No VS Code, a extensão **Live Server** recarrega a página sozinha a cada vez que você salva.

## O que já funciona (Fase 1)

| Tela | O que faz |
|---|---|
| Painel | Última cotação de cada mundo, média de 7 dias, desvio da média, idade da cotação |
| Cotações | Ronda de manhã, tarde e noite: digita `74k`, `57,5k` ou `1,5kk`, compara com a última e com a média |
| Histórico | Lista de cotações salvas com filtro por mundo, item e período; apagar com dois cliques |
| Mundos | Liga/desliga mundos, marca posição aberta, cadastra itens |
| Backup | Baixa e restaura um `.json`; apaga tudo |

## Estrutura

```
rc-trade/
├── index.html            menu e ordem dos scripts
├── css/style.css         cores e layout (variáveis no topo)
├── js/
│   ├── formato.js        ler "74k"/"1,5kk", formatar números, datas e %
│   ├── dados.js          tudo que salva/lê do localStorage
│   ├── calculos.js       última cotação, média de 7 dias, variação, spread
│   ├── app.js            troca de tela pelo # da URL e avisos
│   └── paginas/          uma tela por arquivo
│       ├── painel.js
│       ├── cotacoes.js
│       ├── historico.js
│       ├── mundos.js
│       └── backup.js
└── docs/ROADMAP.md       as 7 fases do projeto
```

Regra simples para não bagunçar: **telas não mexem no localStorage**. Elas chamam `Dados` (salvar/ler) e `Calculos` (contas). Assim, quando a Fase 7 trocar o localStorage pelo Supabase, só o `dados.js` muda.

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
