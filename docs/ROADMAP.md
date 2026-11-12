# Roteiro de construção

Cada item com `[ ]` pode virar uma Issue no GitHub. Uma fase só começa quando a anterior funciona.

## Fase 1 · Mundos, cotações e backup ✅
- [x] 16 mundos, ativo e posição aberta
- [x] Cadastro de itens
- [x] Ronda de cotação (manhã, tarde, noite) com `74k` / `1,5kk`
- [x] Comparação com a última cotação e com a média de 7 dias
- [x] Histórico com filtros
- [x] Backup e restauração em JSON

## Fase 2 · Ofertas
- [ ] Nova oferta: mundo, item, venda/compra, quantidade, preço, **Teve taxa? Sim/Não**
- [ ] Taxa = quantidade × preço × 5%, paga na criação (Não = aceitei oferta, taxa 0)
- [ ] Execuções parciais (ex.: 825 de 1.500)
- [ ] Cancelar o resto: registra a taxa perdida da parte não vendida
- [ ] Equilíbrio da recompra: venda × 0,95 (aceitando) e venda × 0,95 ÷ 1,05 (criando)

## Fase 3 · Carteira e itens
- [ ] RC livre, RC em ofertas, gold por mundo
- [ ] Lançamento de item: pago em kk, retorno, lucro, ROI, em estoque, custo médio
- [ ] Consumo de item como ajuste
- [ ] Avaliar oferta: vale aceitar? quanto dá para comprar com o gold que tenho?

## Fase 4 · Cenários e gráfico
- [ ] Cenários de recompra (otimista, alvo, apertado, stop)
- [ ] Gráfico de preço por mundo (Chart.js)

## Fase 5 · Fechamento de caixa
- [ ] Fechar o dia: patrimônio inicial, final, conferência com o jogo, ajustes
- [ ] Fechar a semana e o mês (só fecha o mês com todos os dias fechados)

## Fase 6 · Painel e comparativos
- [ ] Métricas: % de acerto, payoff, expectativa, queda máxima, peso das taxas, reserva em RC
- [ ] Comparar dias, semanas e meses
- [ ] Cotação do RC em R$ por fonte (melhor para comprar / vender)

## Fase 7 · Nuvem
- [ ] Supabase com login (dados no celular e no PC)
- [ ] Trocar `dados.js` para ler/salvar no Supabase
