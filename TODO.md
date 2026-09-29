# Checklist de Implementação: Sistema de Gestão B2B (Offline-First)

Este documento mapeia as 4 fases de implementação do PRD em tarefas granulares. Cada funcionalidade deve seguir estritamente o pipeline de Vertical Slice: `Contrato (Zod) -> Lógica (Pura) -> Persistência (Dexie) -> UI (React) -> Autovalidação`.

## Fase 1: MVP - Emissão Rápida de Pedidos (Offline-First)

### 1.1. Setup e Fundação (Concluído)
- [x] Inicializar Vite, React, TypeScript, Tailwind e Biome.
- [x] Configurar Vitest com `fake-indexeddb` e injetar utilitários de tipo do Node.
- [x] Estabelecer script unificado de validação (`pnpm validate`).

### 1.2. Modelagem de Domínio e Banco Local
- [ ] **Schemas Universais (Zod):** Criar esquemas para Clientes, Produtos, Pedidos e Outbox com `tenant_id` e cálculos estritos em centavos.
- [ ] **Instância Dexie.js:** Configurar `src/db/database.ts` mapeando as tabelas e índices de busca (ex: SKU, descrição).
- [ ] **Testes de Persistência:** Escrever testes garantindo o funcionamento do Dexie e a rejeição de schemas inválidos.

### 1.3. Catálogo Rápido Offline
- [ ] **Repositório de Produtos:** Implementar interface e adaptador Dexie para busca instantânea de produtos.
- [ ] **UI do Catálogo:** Desenvolver componente visual com listagem e filtro de busca por nome/SKU.
- [ ] **Validação:** Rodar `pnpm validate`.

### 1.4. Carrinho e Emissão de Pedidos
- [ ] **Regras de Negócio (Puras):** Criar funções de cálculo de subtotais e totais garantindo precisão com números inteiros (centavos).
- [ ] **Repositório de Pedidos:** Implementar persistência local atrelando os itens selecionados ao pedido.
- [ ] **UI de Fechamento:** Criar tela de resumo do pedido com seleção de cliente e cálculo de valores.
- [ ] **Validação:** Rodar `pnpm validate`.

### 1.5. Sincronização e Geração de PDF
- [ ] **Fila Outbox:** Implementar mecanismo de salvamento na `sync_queue` para persistência de mutações.
- [ ] **Idempotência:** Configurar geração de chaves únicas (Idempotency Key) no ato da emissão do pedido.
- [ ] **Exportação PDF:** Utilizar `@react-pdf/renderer` para gerar o espelho do pedido finalizado.
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 2: Motor de Políticas Comerciais Multirrepresentada

### 2.1. Tabelas de Preços Dinâmicas
- [ ] **Schemas (Zod):** Modelar entidades `tabelas_preco` e `itens_preco` associadas a clientes e representadas.
- [ ] **Repositório:** Implementar busca de preços baseados na vigência e tabela ativa do cliente selecionado.

### 2.2. Validações Comerciais Estritas
- [ ] **Pedido Mínimo:** Criar lógica para bloquear a emissão se o valor (em centavos) ou volume mínimo da representada não for atingido.
- [ ] **Trava de Embalagem:** Validar inputs de quantidade contra o campo `multiplo_embalagem` do produto.
- [ ] **Teto de Desconto:** Implementar bloqueio se o desconto aplicado exceder o limite escalonado parametrizado.

### 2.3. Condições e Frete
- [ ] **Integração CIF/FOB:** Adicionar seletor de regras de frete e embutir os dados no payload do pedido.
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 3: Funil de Faturamento e Conciliação Financeira

### 3.1. Máquina de Estados do Pedido
- [ ] **Atualização de Status:** Implementar transições lógicas e na interface: `Emitido` -> `Faturado Parcial` -> `Faturado Total` -> `Liquidado`.
- [ ] **UI de Acompanhamento:** Criar dashboard para rastreamento visual do status de cada pedido.

### 3.2. Conciliação de Notas Fiscais
- [ ] **Schemas (Zod):** Modelar `faturamentos_parciais` e `extratos_comissao`.
- [ ] **Input de NF:** Desenvolver formulário para inclusão do número da nota fiscal e divergências de itens/valores cortados pela fábrica.

### 3.3. Gestão de Comissões e Fluxo de Caixa
- [ ] **Extrato de Comissões:** Criar relatório cruzando as comissões projetadas na emissão com as efetivamente recebidas/glosadas.
- [ ] **Projeção de Caixa:** Implementar cálculo de fluxo futuro estimando os recebíveis para 30, 60 e 90 dias.
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 4: CRM B2B e Inteligência de Recompra

### 4.1. Curva e Frequência de Recompra
- [ ] **Algoritmo Analítico:** Desenvolver função para calcular a média de dias entre compras baseada no histórico de pedidos de cada cliente.
- [ ] **Alertas Preventivos:** Configurar flags na UI disparadas quando o cliente atrasar a recompra além do ciclo habitual.

### 4.2. Raio-X Pré-Visita
- [ ] **Agregação de Dados:** Construir view que cruza histórico de itens comprados, itens inexplorados e pendências financeiras.
- [ ] **UI Mobile:** Criar ficha de visualização rápida focada na experiência do representante em campo antes da visita.

### 4.3. Classificação de Carteira
- [ ] **Curva ABC:** Codificar rotina que segmenta os clientes pelo faturamento acumulado e exibe no grid de clientes.
- [ ] **Validação:** Rodar `pnpm validate`.