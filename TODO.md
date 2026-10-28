# Checklist de Implementação: Sistema de Gestão B2B (Offline-First)

Este documento mapeia o desenvolvimento do sistema focado no **representante comercial**, garantindo máxima agilidade na elaboração de orçamentos e pedidos em campo. O pipeline de Vertical Slice continua sendo o padrão: `Contrato (Zod) -> Lógica (Pura) -> Persistência (Dexie) -> UI (React) -> Autovalidação`.

---

## Fase 1: Fundação, Configuração e Cadastros Base

### 1.1. Setup e Fundação
- [x] Inicializar Vite, React, TypeScript, Tailwind e Biome.
- [x] Configurar Vitest com `fake-indexeddb` e injetar utilitários de tipo do Node.
- [x] Estabelecer script unificado de validação (`pnpm validate`).

### 1.2. Modelagem de Domínio e Banco Local
- [x] **Schemas Universais (Zod):** Criar esquemas para Clientes, Produtos, Pedidos e Outbox com `tenant_id` e cálculos estritos em centavos.
- [x] **Instância Dexie.js:** Configurar `src/db/database.ts` mapeando as tabelas e índices de busca (ex: SKU, descrição).
- [x] **Testes de Persistência:** Escrever testes garantindo o funcionamento do Dexie e a rejeição de schemas inválidos.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.3. Catálogo Rápido Offline
- [x] **Repositório de Produtos:** Implementar interface e adaptador Dexie para busca instantânea de produtos.
- [x] **UI do Catálogo:** Desenvolver componente visual com listagem e filtro de busca por nome/SKU.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.4. Configuração Multi-Tenant (White-Label)
- [x] **Contratos:** Criar schema `TenantConfig`.
- [x] **Contexto Global:** Implementar `TenantContext` e `useTenant` para distribuir dados da empresa sem uso de `.env`.
- [x] **Injeção de UI:** Consumir dados do tenant no cabeçalho/layout principal.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.5. Módulo de Representadas
- [x] **Repositório:** Implementar adaptador Dexie para gestão de representadas.
- [x] **UI:** Criar tela de listagem e formulário de cadastro básico de representadas.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.6. Módulo de Clientes (CRM Base)
- [x] **Repositório:** Implementar operações de CRUD no Dexie com inserção transacional (Cliente + Endereços + Contatos).
- [x] **UI:** Criar tela de listagem de clientes na carteira.
- [x] **UI:** Criar formulário de cadastro/edição permitindo adicionar múltiplos contatos e endereços.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.7. Módulo de Produtos
- [x] **Repositório:** Implementar repositório Dexie para gestão de produtos.
- [x] **UI:** Criar tela de listagem e formulário de cadastro de produtos.
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2: Motor de Orçamentos, Vendas e Emissão de Pedidos

### 2.1. Tabelas de Preços e Resolução Dinâmica
- [ ] **Lógica Pura:** Função de resolução de preço ativo baseada na tabela e vigência selecionadas.
- [ ] **Repositório:** Adaptador Dexie para consulta rápida de preços (`tabelas_preco` e `itens_preco`).
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.2. Motor Financeiro do Orçamento (Cálculos Puros)
- [x] **Base de Aritmética:** `src/shared/domain/dinheiro.ts` com `aplicarPercentual`, `multiplicarPorFracao`, `dividirHalfEven` e `somarCentavos` (inteiros/`BigInt`, half-even).
- [ ] **Cálculo de Itens:** Preço líquido unitário em centavos a partir do `percentual_desconto` (centésimos de %, fonte da verdade): `preco_liquido = preco_unitario - aplicarPercentual(preco_unitario, percentual_desconto)`. Subtotal = `quantidade * preco_liquido`.
- [ ] **Cálculo Global:** Totalizadores do orçamento/pedido e projeção de comissão do representante em centavos (`aplicarPercentual(total, comissao_padrao)`).
- [ ] **Testes de Arredondamento:** Cobrir com Vitest casos de arredondamento bancário e centavos no motor do pedido.
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.3. Orçamento Ágil e Fechamento de Orçamento/Pedido
- [ ] **Contexto de Venda:** Seleção rápida de Cliente, Endereço de Entrega, Contato, Tipo de Frete (CIF/FOB) e Condição de Pagamento.
- [ ] **UI do Orçamento:** Grid/lista com adição rápida a partir do catálogo, edição ágil de quantidade e desconto sem travas obstrutivas.
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.4. Persistência Offline, Sincronização e Espelho PDF
- [ ] **Gravação Transacional:** Salvar Orçamento/Pedido no Dexie com status (`rascunho` ou `emitido`) e `idempotency_key`.
- [ ] **Fila Outbox:** Registrar mutações na fila local para sincronização em segundo plano.
- [ ] **Espelho PDF:** Gerar PDF profissional via `@react-pdf/renderer` para envio imediato ao cliente (WhatsApp/E-mail).
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 3: Funil de Faturamento e Conciliação Financeira

### 3.1. Máquina de Estados do Pedido
- [ ] **Atualização de Status:** Transições: `Emitido` -> `Faturado Parcial` -> `Faturado Total` -> `Liquidado`.
- [ ] **UI de Acompanhamento:** Visão de pipeline do representante para acompanhamento dos pedidos.
- [ ] **Validação:** Rodar `pnpm validate`.

### 3.2. Conciliação de Faturamento
- [ ] **Schemas (Zod):** Modelar `faturamentos_parciais` e `extratos_comissao`.
- [ ] **Input de NF:** Registro da nota emitida pela fábrica e cortes de itens.
- [ ] **Validação:** Rodar `pnpm validate`.

### 3.3. Gestão de Comissões e Previsão de Caixa
- [ ] **Extrato de Comissões:** Comparativo entre comissão prevista na emissão vs faturada.
- [ ] **Projeção de Caixa:** Estimativa de recebíveis para 30, 60 e 90 dias.
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 4: CRM B2B e Inteligência de Recompra

### 4.1. Ciclo e Frequência de Recompra
- [ ] **Algoritmo Analítico:** Cálculo da média de dias entre compras por cliente.
- [ ] **Alertas de Carteira:** Indicadores visuais de clientes em atraso no ciclo de recompra.
- [ ] **Validação:** Rodar `pnpm validate`.

### 4.2. Raio-X Pré-Visita
- [ ] **Painel de Apoio ao Representante:** Histórico recente, itens habituais e produtos do catálogo ainda não comprados.
- [ ] **UI Responsiva/Mobile:** Interface limpa para consulta rápida pelo representante no celular antes da visita.
- [ ] **Validação:** Rodar `pnpm validate`.

### 4.3. Curva ABC
- [ ] **Segmentação:** Classificação dos clientes (A/B/C) por volume faturado.
- [ ] **Validação:** Rodar `pnpm validate`.
