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
- [x] **UI do Catálogo:** Desenvolver componente visual com listagem densa, sub-menu lateral por representada com cor identificadora e filtro de busca por nome/SKU.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.4. Configuração Multi-Tenant (White-Label)
- [x] **Contratos:** Criar schema `TenantConfig`.
- [x] **Contexto Global:** Implementar `TenantContext` e `useTenant` para distribuir dados da empresa sem uso de `.env`.
- [x] **Injeção de UI:** Consumir dados da marca no cabeçalho/layout principal.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.5. Módulo de Representadas
- [x] **Repositório:** Implementar adaptador Dexie para gestão de representadas.
- [x] **UI:** Criar tela de listagem densa e formulário de cadastro com cor identificadora e tabelas de preço.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.6. Módulo de Clientes (CRM Base)
- [x] **Repositório:** Implementar operações de CRUD no Dexie com inserção transacional (Cliente + Endereços + Contatos).
- [x] **UI:** Criar tela de listagem densa de clientes na carteira.
- [x] **UI:** Criar formulário de cadastro/edição permitindo adicionar múltiplos contatos, endereços e tabelas padrão por representada.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.7. Módulo de Produtos
- [x] **Repositório:** Implementar repositório Dexie para gestão de produtos.
- [x] **UI:** Criar tela de listagem por representada e formulário de cadastro de produtos com preços por tabela.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.8. Revisão da Fase 1
- [x] **Melhorias:** Unicidade, isolamento de tenant, modelo de dados, formulários e módulo de dinheiro (detalhes em `MELHORIAS.md`).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2: Motor de Orçamentos, Vendas e Emissão de Pedidos

### 2.1. Tabelas de Preços e Resolução Dinâmica
- [x] **Lógica Pura:** Resolução de preço pela tabela selecionada e vigência (`src/modules/produtos/domain/preco.ts`), com motivo quando não há preço (`tabela_nao_encontrada`, `tabela_inativa`, `fora_de_vigencia`, `produto_sem_preco`).
- [x] **Repositório:** `PrecoRepository` + adaptador Dexie (`preco-dexie.adapter.ts`), com índice `[tenant_id+tabela_id+produto_id]` (Dexie v6).
- [x] **Tabela por Cliente:** `clientes_tabelas_preco` (tabela padrão por cliente e representada), usada para sugerir a tabela do pedido.
- [x] **UI de Tabelas e Preços:** Criação automática de *Tabela Padrão* e gestão de tabelas no cadastro da representada, preços por tabela no formulário do produto e exibição/seleção de tabela no catálogo.
- [x] **UI de Vínculo:** Escolha da tabela padrão no cadastro do cliente e da tabela no orçamento.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.2. Motor Financeiro do Orçamento (Cálculos Puros)
- [x] **Base de Aritmética:** `src/shared/domain/dinheiro.ts` com `aplicarPercentual`, `multiplicarPorFracao`, `dividirHalfEven` e `somarCentavos` (inteiros/`BigInt`, half-even).
- [x] **Cálculo de Itens:** Preço líquido unitário em centavos a partir do `percentual_desconto` (centésimos de %, fonte da verdade): `preco_liquido = preco_unitario - aplicarPercentual(preco_unitario, percentual_desconto)`. Subtotal = `quantidade * preco_liquido`.
- [x] **Cálculo Global:** Totalizadores do orçamento/pedido e projeção de comissão do representante em centavos (`aplicarPercentual(total, comissao_padrao)`).
- [x] **Testes de Arredondamento:** Cobrir com Vitest casos de arredondamento bancário e centavos no motor do pedido.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.3. Orçamento Ágil e Fechamento de Orçamento/Pedido
- [x] **Contexto de Venda:** Seleção rápida de Cliente, Endereço de Entrega, Contato, Tipo de Frete (CIF/FOB/FOB Redespacho, herdando o padrão da representada) e Condição de Pagamento.
- [x] **UI do Orçamento:** Workspace em *Split-View* (Catálogo à esquerda + Sacola e Totais fixos à direita), edição ágil de quantidade e desconto sem travas obstrutivas.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.4. Persistência Offline, Sincronização e Espelho PDF
- [x] **Gravação Transacional:** Salvar Orçamento/Pedido no Dexie com status (`rascunho` ou `emitido`) e `idempotency_key`.
- [x] **Fila Outbox:** Registrar mutações na fila local para sincronização em segundo plano. Conflitos de cadastros de campo seguem LWW por `updated_at`, registro a registro (PRD 3.2).
- [x] **Espelho PDF:** Gerar PDF profissional via `@react-pdf/renderer` para envio imediato ao cliente (WhatsApp/E-mail).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.5: Refinamento Operacional de Campo, Comissões por Segmento e Cotação Multi-Representada

### 2.5.1. Segmentação de Clientes (Fábrica vs. Revenda) e Comissão Diferenciada
- [ ] **Contrato & Migração Dexie:** Adicionar `tipo_cliente: 'REVENDA' | 'FABRICA'` no `ClienteSchema` (padrão `'REVENDA'` na migração para registros existentes) e `percentual_comissao_revenda` / `percentual_comissao_fabrica` na `RepresentadaSchema`.
- [ ] **Lógica Pura de Comissão:** Resolver automaticamente o percentual de comissão aplicável ao pedido cruzando a `Representada` e o `tipo_cliente` do `Cliente` selecionado, mantendo testes em `BigInt` / *half-even*.
- [ ] **UI nos Cadastros e Orçamento:** Seletor `Revenda / Fábrica` no formulário e lista de Clientes; campos de Comissão p/ Revenda e Comissão p/ Fábrica na Representada; exibição clara de qual alíquota está ativa no Orçamento.
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.5.2. Seletores Digitáveis (Combobox) sem Pré-seleção e Cadastro Rápido de Cliente
- [ ] **Componente Compartilhado `Combobox`:** Criar `src/shared/components/ui/Combobox.tsx` com busca por digitação (nome, razão social, CNPJ/CPF), navegação por teclado e suporte a ação de rodapé.
- [ ] **Sem Escolha Padrão no Novo Orçamento:** Ao abrir `/pedidos/novo` sem parâmetros de atalho, iniciar Cliente e Representada vazios para que o representante digite e selecione com precisão.
- [ ] **Cadastro Rápido de Cliente Inline:** Incluir a ação `+ Cadastrar novo cliente` diretamente dentro do `Combobox` de Cliente no orçamento (via Modal/Drawer enxuto), salvando e selecionando o cliente sem sair da tela de cotação.
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.5.3. Módulo de Transportadoras e Vínculo Logístico
- [ ] **Contrato, Lógica e Persistência (Dexie):** Criar módulo `src/modules/transportadoras/` com schema Zod (`nome_fantasia`, `razao_social` opcional, `cnpj` opcional validado, `telefone`, `cidade_uf`, `ativo` + campos sincronizáveis) e repositório Dexie com Outbox.
- [ ] **Vínculo em Cliente e Pedido:** Adicionar `transportadora_padrao_id` (opcional) no `Cliente` e `transportadora_id` (opcional) no `Pedido` (sugerindo a transportadora habitual do cliente ao selecioná-lo).
- [ ] **UI e Espelho PDF:** Tela de listagem/cadastro de Transportadoras, seleção digitável (`Combobox`) no orçamento e exibição da Transportadora no bloco logístico do Espelho PDF.
- [ ] **Validação:** Rodar `pnpm validate`.

### 2.5.4. Cotação Multi-Representada (Orçamento Unificado com Desmembramento por Fábrica)
- [ ] **Modelo de Agrupamento (`cotacao_grupo_id`):** Permitir que múltiplos registros de `Pedido` (um para cada fábrica) compartilhem um mesmo `cotacao_grupo_id: UUID (nullable)`.
- [ ] **Workspace Multi-Fábrica no Orçamento:** Permitir alternar livremente entre as Representadas no painel de catálogo do orçamento sem limpar a sacola; agrupar os itens da sacola em seções por Representada (cada seção com sua Tabela de Preço, Condição de Pagamento, Tipo de Frete e indicador de Pedido Mínimo).
- [ ] **Gravação Transacional Desmembrada:** Ao salvar rascunho ou fechar a cotação, gravar transacionalmente 1 `Pedido` individual por representada presente na sacola.
- [ ] **Espelho PDF Unificado vs. Individual:** Permitir baixar o **PDF Unificado da Cotação** (visão consolidada para o cliente com todas as fábricas) ou o **PDF Individual por Representada** (para envio separado a cada fábrica).
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 3: Funil de Faturamento e Conciliação Financeira

### 3.1. Máquina de Estados Logísticos do Pedido
- [ ] **Atualização de Status Logístico:** Transições do pedido: `emitido` -> `parcialmente_faturado` -> `faturado_total` (e `cancelado`). A liquidação financeira não é status do pedido, mas sim controlada em `extratos_comissao.status_comissao = 'paga'` e exibida como badge financeiro ao lado do pedido.
- [ ] **Imutabilidade Remota:** Trigger no PostgreSQL bloqueando a edição de campos comerciais de pedidos `emitido+` (`MELHORIAS.md` 6.2).
- [ ] **UI de Acompanhamento:** Visão de pipeline do representante para acompanhamento logístico e financeiro dos pedidos.
- [ ] **Validação:** Rodar `pnpm validate`.

### 3.2. Conciliação de Faturamento
- [ ] **Schemas (Zod):** Modelar `faturamentos_parciais` e `extratos_comissao`.
- [ ] **Input de NF:** Registro da nota emitida pela fábrica e cortes de itens.
- [ ] **Validação:** Rodar `pnpm validate`.

### 3.3. Gestão de Comissões e Previsão de Caixa
- [ ] **Extrato de Comissões:** Comparativo entre comissão prevista na emissão vs faturada/paga (`aguardando`, `paga`, `divergente`, `estornada`).
- [ ] **Projeção de Caixa:** Estimativa de recebíveis para 30, 60 e 90 dias.
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 4: CRM B2B e Inteligência de Recompra

### 4.1. Ciclo e Frequência de Recompra (Derivado do Histórico de Pedidos)
- [ ] **Algoritmo Analítico:** Cálculo automático da média de dias entre compras, ticket médio e data da última compra a partir do histórico de pedidos do cliente (`clientes_metricas` como projeção/cache com `CamposSincronizaveisSchema`).
- [ ] **Alertas de Carteira:** Indicadores visuais de clientes em atraso no ciclo de recompra.
- [ ] **Validação:** Rodar `pnpm validate`.

### 4.2. Raio-X Pré-Visita
- [ ] **Painel de Apoio ao Representante:** Histórico recente, itens habituais e produtos do catálogo ainda não comprados.
- [ ] **UI Responsiva/Mobile:** Interface limpa para consulta rápida pelo representante no celular antes da visita.
- [ ] **Validação:** Rodar `pnpm validate`.

### 4.3. Curva ABC
- [ ] **Segmentação:** Classificação automática dos clientes (A/B/C) por volume faturado/emitido acumulado.
- [ ] **Validação:** Rodar `pnpm validate`.
