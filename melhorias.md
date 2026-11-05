# Melhorias: visual no celular

## Teste com Playwright (2026-11-05)

Emulação de celular real (Pixel 7: 412 px, toque, `devicePixelRatio` 2,6) com perfil limpo e banco grande gerado só no navegador de teste: 410 produtos, 18 pedidos (6 rascunhos, 12 emitidos) e um cliente com razão social longa. Foram 15 telas, cada uma no topo e depois de rolar. Os dados do seu Chrome não foram tocados.

### Causa dos bugs da navbar (confirmada)

No catálogo, a página ficou com **455 px de largura num celular de 412 px**: o navegador do celular aumenta a área da página para caber o conteúdo largo. A barra inferior (fixa) acompanha essa área maior, e por isso:

- a aba "Transp." fica cortada fora da tela (visto no print);
- ao rolar ou dar zoom com o dedo, a barra parece "sumir" ou deslizar, porque a parte visível da tela já não coincide com a área da página;
- elementos do conteúdo passam por baixo da barra e parecem "sobrepostos".

Sem dados não acontece porque o catálogo vazio não mostra a tabela nem os botões que alargam a página.

Outros suspeitos a eliminar junto:

- `content-visibility: auto` em `.workspace-pane` (catálogo e orçamento): o navegador pula a pintura do que está fora da tela e pode mostrar áreas **em branco** por um instante durante a rolagem rápida, com tamanho reservado de 320 × 600 px.
- `backdrop-blur` nas barras fixas: no Chrome Android, o desfoque sobre listas longas pode piscar ou deixar ícones sem pintar durante a rolagem.
- O botão "Popular Banco de Dados" (só em desenvolvimento) fica por cima do conteúdo e da sacola.

### Bugs encontrados

| # | Tela | Problema |
| --- | --- | --- |
| 1 | Catálogo | **Alarga a página inteira** (455 px em 412): a barra inferior é cortada e "some" na rolagem. Causa principal |
| 2 | Catálogo | Nome do produto quebra em 6 a 8 linhas (coluna estreita); preço cortado ("R$ 48"); coluna Ações fora da tela |
| 3 | Orçamentos | **Valor do pedido fora da tela**: a tabela tem 686 px; aparecem só código, cliente e status |
| 4 | Histórico do cliente | Tabela de 621 px; valor e ações fora da tela |
| 5 | Representadas | Tabela de 687 px; só a coluna "Fábrica" aparece |
| 6 | Clientes | Tabela de 514 px; CNPJ quebra no meio do número |
| 7 | Orçamento (sacola) | Cada item ocupa quase uma tela de altura, numa lista com rolagem própria dentro da página |
| 8 | Orçamento (rodapé) | Totais e "Fechar pedido" apertados contra a barra inferior |
| 9 | Pedido emitido | O aviso "somente leitura" usa o estilo de **erro** (vermelho), mas é informação; os campos continuam com cara de editáveis (placeholder "Digite o nome…") |
| 10 | Barra superior | Seletor de tema com 3 botões ocupa metade da barra; o nome do tenant é truncado em telas de 360 px |
| 11 | Barra inferior | "Representadas" quase encosta em "Transp." em 360 px |
| 12 | Catálogo | A faixa de fábricas mostra barra de rolagem visível |

### Pela skill Web Interface Guidelines

- `touch-action: manipulation` ausente (atraso de toque duplo em botões de +/− da sacola).
- Listas longas: o catálogo já usa `ShowMore`; as tabelas de pedidos e clientes renderizam tudo.
- `<meta name="theme-color">` deve acompanhar o tema escuro.
- Barras fixas não podem cobrir o elemento focado (campos no fim do orçamento ficam atrás da barra inferior com o teclado aberto: a verificar no aparelho).

### A conferir

- **Possível bug lógico:** na sacola, um produto com "Múlt. 8" apareceu com quantidade 2. Conferir se a regra do múltiplo de embalagem é aplicada ao adicionar o item.
- PDF e teclado virtual sobre os formulários (só no aparelho).

## DESIGN.md (Linear)

Usar como referência de **densidade e acabamento**: bordas finas (hairline) em vez de sombra, raio de 8 px em botões e campos, 12 px em cartões, uma cor de destaque só (a do tenant), números em `tabular-nums`, toque mínimo de 40–44 px. **Não** adotar o "só tema escuro" do Linear: a Fase 2.6 decidiu o claro como padrão para uso em campo, sob luz do dia.

## Listas no celular: decisão

Preferência do usuário: lista igual à do desktop. Proposta: **lista densa em 2 linhas** (não cartões grandes). Mesma lista, mesma ordem e mesmos dados da tabela, mas cada linha se reorganiza no celular:

```text
Albuquerque-Melo                      R$ 12.430,00
#098FDA6C · 05/11 · ● Oliveira e Assoc.   Emitido
```

Motivo: numa tela de 360–412 px não cabem 5 ou 6 colunas. A tabela com rolagem lateral (opção atual) esconde justamente o valor e as ações, que são o que o representante procura, e é a rolagem lateral que quebra a navbar. A lista em 2 linhas mantém a densidade (cerca de 56 px por linha, 9 a 10 linhas por tela) e no desktop continua a tabela atual.

## Plano

1. [x] **Estrutura:** nenhuma tela pode alargar a página (itens 1, 11 e 12); revisar `content-visibility` e `backdrop-blur` das barras. *Feito: `main` com `min-w-0` e `overflow-x: clip`; botões do cabeçalho quebram linha (`PageHeader` e catálogo); faixa de fábricas sem barra de rolagem; `content-visibility` removido (`.workspace-pane`); barras do mobile sem desfoque e com fundo sólido; abas da barra inferior com largura fixa e rótulo truncado ("Fábricas" no lugar de "Representadas"). Conferido com Playwright em 360 e 412 px nas 15 telas: a página tem sempre a largura da tela e a barra inferior cabe inteira.*
2. **Listas (formato aprovado):** lista densa em 2 linhas no celular para catálogo, orçamentos, histórico, clientes, representadas e transportadoras, num componente compartilhado em `src/shared/components/ui/` (itens 2 a 6).
3. **Orçamento:** item da sacola em 2 a 3 linhas, sem rolagem interna, totais e ações num rodapé fixo acima da barra inferior (itens 7 e 8).
4. **Detalhes:** aviso de pedido emitido como informação (item 9), barra superior (item 10), rótulos da barra inferior (item 11), `touch-action`, `theme-color`.
5. Conferir a regra do múltiplo de embalagem.
6. Teste automatizado com Playwright em 360 e 412 px verificando que nenhuma tela alarga a página.

## Andamento (2026-11-05)

- [x] **Barra lateral só a partir de 1024 px:** celular deitado e tablet usam a barra inferior e a largura inteira.
- [x] **Formato pelo espaço disponível (Orçamentos e Clientes):** a lista mede a largura que tem (`@container`). Abaixo de 672 px vira cards (Orçamentos) ou lista em 2 linhas (Clientes); acima disso, tabela. Colunas secundárias aparecem só quando cabem. Conferido com Playwright de 360 a 1440 px: nenhuma tabela rola para o lado.
- [x] **Decisão do usuário: cards** (a lista em 2 linhas cortava demais a segunda linha). Aplicado em orçamentos, clientes, catálogo, histórico do cliente, fábricas e transportadoras com o componente `ListaResponsiva` (`src/shared/components/ui/ListaResponsiva.tsx`). Conferido com Playwright de 360 a 1440 px: nenhuma tabela rola para o lado.
- [ ] Tabelas de prévia (importação de CSV, reajuste) continuam com rolagem própria: são conferência de dados, não listas de cadastro. Avaliar depois.
- [x] **Sacola do orçamento:** itens em card compacto (nome e subtotal em cima, preços embaixo, quantidade e desconto numa linha) quando a sacola é estreita, tabela quando há espaço; sem rolagem interna (a sacola e o catálogo do orçamento rolam com a página abaixo de 1024 px). Total e botões "Salvar rascunho" / "Fechar pedido" numa barra fixa acima da barra inferior (uma linha só no celular deitado). Item com nome longo: de cerca de 300 px para 170–190 px em 360–412 px.
- [x] **Múltiplo de embalagem:** decisão do usuário, é só informativo (quantidade em embalagens). Exibido como "CX com 8" no catálogo, na sacola e no PDF; campo renomeado para "Peças por embalagem". Regra de múltiplo anotada no `BACKLOG.md` 1.3.
- [x] **Pedido emitido:** aviso de somente leitura em estilo informativo (cinza), não mais de erro.
- [x] **Barra superior no celular:** seletor de tema virou um botão só, que alterna Claro → Escuro → Sistema.
- [x] **`touch-action: manipulation`** em botões, links e campos: sem atraso nem zoom por toque duplo (ex.: + / − da sacola); zoom com dois dedos continua.
- [x] **`theme-color`:** barra do sistema com a cor da marca no tema claro e o fundo do app (`#0e0f10`) no escuro, aplicada já antes do React montar.

