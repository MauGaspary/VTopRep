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
- [x] **UI:** Criar formulário de cadastro/edição permitindo adicionar múltiplos contatos, endereços e tabelas padrão por representada (tabelas padrão removidas na Fase 2.7).
- [x] **Validação:** Rodar `pnpm validate`.

### 1.7. Módulo de Produtos

- [x] **Repositório:** Implementar repositório Dexie para gestão de produtos.
- [x] **UI:** Criar tela de listagem por representada e formulário de cadastro de produtos com preços por tabela.
- [x] **Validação:** Rodar `pnpm validate`.

### 1.8. Revisão da Fase 1

- [x] **Melhorias:** Unicidade, isolamento de tenant, modelo de dados, formulários e módulo de dinheiro (decisões registradas no PRD).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2: Motor de Orçamentos, Vendas e Emissão de Pedidos

### 2.1. Tabelas de Preços e Resolução Dinâmica

- [x] **Lógica Pura:** Resolução de preço pela tabela selecionada e vigência (`src/modules/produtos/domain/preco.ts`), com motivo quando não há preço (`tabela_nao_encontrada`, `tabela_inativa`, `fora_de_vigencia`, `produto_sem_preco`).
- [x] **Repositório:** `PrecoRepository` + adaptador Dexie (`preco-dexie.adapter.ts`), com índice `[tenant_id+tabela_id+produto_id]` (Dexie v6).
- [x] **Tabela por Cliente:** `clientes_tabelas_preco` (tabela padrão por cliente e representada), usada para sugerir a tabela do pedido. *Removida na Fase 2.7: a tabela passou a ser exclusiva da representada.*
- [x] **UI de Tabelas e Preços:** Criação automática de *Tabela Padrão* e gestão de tabelas no cadastro da representada, preços por tabela no formulário do produto e exibição/seleção de tabela no catálogo.
- [x] **UI de Vínculo:** Escolha da tabela padrão no cadastro do cliente e da tabela no orçamento. *Escolha no cliente removida na Fase 2.7.*
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

- [x] **Contrato & Migração Dexie:** Adicionar `tipo_cliente: 'REVENDA' | 'FABRICA'` no `ClienteSchema` (padrão `'REVENDA'` na migração para registros existentes) e `percentual_comissao_revenda` / `percentual_comissao_fabrica` na `RepresentadaSchema`. Deixar `percentual_comissao_revenda` como opcional e `percentual_comissao_fabrica` como obrigatório.
- [x] **Lógica Pura de Comissão:** Resolver automaticamente o percentual de comissão aplicável ao pedido cruzando a `Representada` e o `tipo_cliente` do `Cliente` selecionado, mantendo testes em `BigInt` / *half-even*.
- [x] **UI nos Cadastros e Orçamento:** Seletor `Revenda / Fábrica` no formulário e lista de Clientes; campos de Comissão p/ Revenda e Comissão p/ Fábrica na Representada; exibição clara de qual alíquota está ativa no Orçamento.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.5.2. Seletores Digitáveis (Combobox) sem Pré-seleção e Cadastro Rápido de Cliente

- [x] **Componente Compartilhado `Combobox`:** Criar `src/shared/components/ui/Combobox.tsx` com busca por digitação (nome, razão social, CNPJ/CPF), navegação por teclado e suporte a ação de rodapé.
- [x] **Sem Escolha Padrão no Novo Orçamento:** Ao abrir `/pedidos/novo` sem parâmetros de atalho, iniciar Cliente e Representada vazios para que o representante digite e selecione com precisão.
- [x] **Cadastro Rápido de Cliente Inline:** Incluir a ação `+ Cadastrar novo cliente` diretamente dentro do `Combobox` de Cliente no orçamento (via Modal/Drawer enxuto), salvando e selecionando o cliente sem sair da tela de cotação.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.5.3. Módulo de Transportadoras e Vínculo Logístico

- [x] **Contrato, Lógica e Persistência (Dexie):** Criar módulo `src/modules/transportadoras/` com schema Zod (`nome_fantasia`, `razao_social` opcional, `cnpj` opcional validado, `telefone`, `cidade_uf`, `ativo` + campos sincronizáveis) e repositório Dexie com Outbox.
- [x] **Vínculo em Cliente e Pedido:** Adicionar `transportadora_padrao_id` (opcional) no `Cliente` e `transportadora_id` (opcional) no `Pedido` (sugerindo a transportadora habitual do cliente ao selecioná-lo).
- [x] **UI e Espelho PDF:** Tela de listagem/cadastro de Transportadoras, seleção digitável (`Combobox`) no orçamento e exibição da Transportadora no bloco logístico do Espelho PDF.
- [x] **Validação:** Rodar `pnpm validate`.

### 2.5.4. Cotação Multi-Representada (Orçamento Unificado com Desmembramento por Fábrica)

- [x] **Modelo de Agrupamento (`cotacao_grupo_id`):** Permitir que múltiplos registros de `Pedido` (um para cada fábrica) compartilhem um mesmo `cotacao_grupo_id: UUID (nullable)`.
- [x] **Workspace Multi-Fábrica no Orçamento:** Permitir alternar livremente entre as Representadas no painel de catálogo do orçamento sem limpar a sacola; agrupar os itens da sacola em seções por Representada (cada seção com sua Tabela de Preço, Condição de Pagamento, Tipo de Frete e indicador de Pedido Mínimo).
- [x] **Gravação Transacional Desmembrada:** Ao salvar rascunho ou fechar a cotação, gravar transacionalmente 1 `Pedido` individual por representada presente na sacola.
- [x] **Espelho PDF Unificado vs. Individual:** Permitir baixar o **PDF Unificado da Cotação** (visão consolidada para o cliente com todas as fábricas) ou o **PDF Individual por Representada** (para envio separado a cada fábrica).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.6: Alternância de Tema (Claro / Escuro)

O representante escolhe o tema no próprio aparelho. O **claro continua sendo o padrão** (uso em campo, sob luz do dia). O tema escuro é ligado por `data-tema="escuro"` no `<html>` (seletor Claro / Escuro / Sistema na barra lateral e na barra superior do celular).

### 2.6.1. Preferência e Aplicação do Tema

- [x] **Contrato & Lógica Pura:** `PreferenciaTemaSchema = z.enum(["claro", "escuro", "sistema"])` em `src/shared/domain/tema.ts`, padrão `claro`, e `resolverTema(preferencia, sistemaEscuro): "claro" | "escuro"`, com testes.
- [x] **Persistência por Aparelho:** Guardar a preferência no `localStorage` por meio de um repositório em `src/shared/repositories/`. Não sincroniza (não é dado de negócio). Valor ausente ou inválido volta para `claro`.
- [x] **CSS e Tailwind:** Trocar o `@media (prefers-color-scheme: dark)` por um atributo no `<html>` (`data-tema="escuro"`) e declarar `@custom-variant dark` no Tailwind v4, para que as classes `dark:` sigam a escolha do usuário.
- [x] **Sem Flash:** Script inline no `index.html` aplica o tema antes de o React montar. No modo `sistema`, acompanhar `matchMedia` ao vivo.

### 2.6.2. Interface

- [x] **Controle:** Seletor segmentado *Claro / Escuro / Sistema* no rodapé da `Sidebar` e no `MobileNav`, reaproveitando os componentes de `src/shared/components/ui/`.
- [x] **Revisão de Contraste:** Percorrer todas as telas no tema escuro (listas, formulários, orçamento, `Combobox`, `Badge`, `Alert`, cores das representadas e cor primária do tenant) e garantir contraste AA nos dois temas.
- [x] **PDF:** O espelho PDF continua sempre claro (documento para impressão e envio).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.7: Tabela de Preço Exclusiva da Representada

**Decisão:** a tabela de preço pertence à fábrica; o cliente não tem tabela própria. No orçamento, a sugestão é a **tabela vigente de início mais recente** da representada, e o representante pode trocar a tabela em cada pedido. Variações por estado (ICMS, ST e outros impostos) ficam no `BACKLOG.md` 1.5.

### 2.7.1. Regra de Sugestão

- [x] **Lógica Pura:** Simplificar `escolherTabelaSugerida` (`src/modules/produtos/domain/preco.ts`) para receber só as tabelas vigentes, sem `tabelaPadraoId`. Testes: várias vigentes → início mais recente; empate → ordem alfabética; nenhuma vigente → `null` (o orçamento pede a escolha manual).
- [x] **Rascunhos:** Ao reabrir um rascunho, manter a tabela gravada enquanto ela estiver vigente (comportamento atual de `resolverTabelaEfetivaGrupo`).

### 2.7.2. Remoção do Vínculo Cliente → Tabela

- [x] **Código:** Remover a seção de tabelas padrão do formulário do cliente, os hooks de `use-precos.ts`, os métodos do `PrecoRepository`/adaptador, as funções de definição de tabela padrão e os testes correspondentes.
- [x] **Dexie v10:** Remover a store `clientes_tabelas_preco`, tirá-la de `ENTIDADES_SINCRONIZAVEIS` e do seed, e descartar na migração as entradas pendentes da Outbox dessa entidade.
- [x] **PRD:** Remover `clientes_tabelas_preco` do dicionário de dados e do ERD e registrar a regra de sugestão em `tabelas_preco`.
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.8: Histórico de Pedidos do Cliente

Base para a Fase 4 (recompra, Raio-X e Curva ABC).

### 2.8.1. Consulta, Ordenação e Resumo

- [x] **Repositório:** `listarPorCliente(tenantId, clienteId)` usando o índice `[tenant_id+cliente_id]` que já existe em `pedidos`, com testes no `fake-indexeddb` (inclusive isolamento de tenant).
- [x] **Lógica Pura:** Ordenação por data (**padrão: mais recente → mais antigo**), valor, status ou representada; filtros por representada, status (com opção de esconder orçamentos em rascunho) e período.
- [x] **Resumo em Centavos:** Quantidade de pedidos, valor total, ticket médio e data da última compra, contando apenas pedidos `emitido` ou superior.

### 2.8.2. Interface

- [x] **Aba "Pedidos" no Cliente:** Lista densa com data, número, representada (com a cor identificadora), status, valor e etiqueta de cotação. O clique abre o pedido.
- [x] **Atalho:** Botão "Novo orçamento" já com o cliente selecionado.

### 2.8.3. Repetir Pedido

- [x] **Lógica Pura:** Montar os valores iniciais de um novo orçamento a partir de um pedido existente, mantendo produtos, quantidades e descontos e **buscando o preço na tabela vigente** (nunca copiar o preço antigo). Itens inativos ou sem preço viram aviso e não entram.
- [x] **UI:** Botão "Repetir pedido" no histórico e na tela do pedido. Em cotações, repete todas as fábricas.
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.9: Importação de Produtos e Preços por CSV

**Escopo:** arquivos CSV (exportados do Excel com "Salvar como CSV"). Importação de PDF fica no `BACKLOG.md` 1.4; até lá, o representante pede à fábrica a planilha em CSV ou Excel.

### 2.9.1. Leitura e Mapeamento de Colunas

- [x] **Parser Puro:** Ler CSV com separador `;` ou `,` detectado, campos entre aspas, BOM e encoding UTF-8 ou Windows-1252, com testes.
- [x] **Mapeamento:** Ligar as colunas do arquivo aos campos SKU (obrigatório), descrição, unidade, múltiplo de embalagem e preço. Salvar o mapeamento por representada para as próximas importações (só no aparelho, Dexie v11 `mapeamentos_importacao`, pelo nome do cabeçalho).
- [x] **Preço sem Ponto Flutuante:** Converter `"1.234,56"`, `"1234.56"` e `"R$ 1.234,56"` para centavos por parsing de texto, com testes de borda.
- [x] **Validação por Linha (Zod):** Erros apontando a linha (SKU vazio, preço inválido, SKU repetido no arquivo). Mais de 2 casas decimais: arredonda *half-even* e avisa na linha.

### 2.9.2. Prévia das Mudanças

- [x] **Lógica Pura:** Comparar o arquivo com o cadastro: produtos novos, alterados (descrição, unidade, múltiplo), preços que subiram ou caíram (com %), inalterados, ausentes no arquivo e inativos que reaparecem (reativar).
- [x] **UI de Prévia:** Contadores e filtros por tipo de mudança. Para os ausentes, o representante escolhe entre **manter** (padrão) ou **inativar**.

### 2.9.3. Gravação

- [x] **Destino:** Atualizar uma tabela existente ou criar uma **nova tabela** com nome e data de início (pode ser futura), opcionalmente substituindo outra (encerrada na véspera do início da nova). Pedidos já gravados não mudam, porque guardam o preço no item.
- [x] **Transação:** Gravar produtos, tabela, `itens_preco` e Outbox numa transação, em lotes, com `tenant_id` validado e SKU normalizado. Teste com cerca de 5.000 linhas.

### 2.9.4. Reajuste em Lote

- [x] **Clonar Tabela com Reajuste:** Nova tabela a partir de uma existente, com +/- X% (centésimos de %, *half-even*) e nova vigência, com prévia antes de gravar. A origem é encerrada na véspera do início da nova (decisão do usuário).

### 2.9.5. Desempenho do Catálogo

- [x] **Medição no Navegador:** Medir a busca do catálogo com alguns milhares de SKUs no navegador real (o `fake-indexeddb` não é representativo) e, se necessário, adotar índice de prefixo ou busca incremental. *Medido no Chrome (modo dev) com 5.000 SKUs: importação em ~2 s; abrir o catálogo recarregando a página caiu de ~4 s para ~1,2 s (navegando dentro do app, ~0,2–0,5 s) e a busca de ~1,6 s para ~0,1 s com renderização incremental (100 por vez), `useDeferredValue`, `getAll` no lugar do cursor do Dexie e `Intl.Collator` reaproveitado. Índice de prefixo não foi necessário.*
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.10: App Instalável Offline (PWA) e Backup Local

Hoje os dados ficam no aparelho, mas o app não abre sem internet, e enquanto não há sincronização tudo vive só no navegador.

### 2.10.1. PWA

- [x] **Service Worker e Manifesto:** `vite-plugin-pwa` (`generateSW`) com precache do app inteiro (~2,2 MB), `navigateFallback` para as rotas do SPA e manifesto com nome e cor do tenant (`src/config/tenant/tenant-padrao.ts`, lido também pelo `vite.config.ts`). Ícones gerados de `public/favicon.svg` com `pnpm icones`. Depois do primeiro acesso, o app abre sem internet.
- [x] **Atualização:** `registerType: "prompt"` e aviso "Nova versão disponível" (`AvisoNovaVersao`) com "Atualizar" / "Depois"; verificação a cada hora com internet. Enquanto um orçamento tem alterações não salvas (`useRegistrarEdicaoEmAndamento`), o botão fica bloqueado e o aviso pede para salvar antes.
- [ ] **Teste Manual (PENDENTE, não esquecer):** Instalar no Android e no desktop e, em modo avião, abrir o app, criar um orçamento e gerar o PDF. *Decisão: adiado para seguir com a Fase 2.11; fazer junto com a primeira publicação em HTTPS. Antes disso, quando estiver em casa, dar uma passada no celular pelo USB (`adb reverse`, sem `--host`) no fluxo central: orçamento, PDF e backup. Revalidar também login (2.11.2) e `ConnectionStatus` (2.11.5) no celular. Verificado por automação no Chromium (desktop): build de produção offline abre rotas não visitadas, cadastra, exporta e restaura backup; a versão nova aparece e fica bloqueada com orçamento em edição. Falta instalar de fato no Android e no desktop e gerar o PDF offline, o que depende de publicar o app em HTTPS (`BACKLOG.md` 2).*

### 2.10.2. Proteção dos Dados Locais

- [x] **Armazenamento Persistente:** `navigator.storage.persist()` pedido ao abrir o app e de novo pelo botão da tela **Dados e backup** (`/dados`), que mostra a proteção e o espaço usado (`navigator.storage.estimate()`).
- [x] **Exportar Backup:** JSON versionado (`formato`, `versao_formato`, `versao_banco` = `db.verno`, `tenant_id`) com as 13 tabelas do tenant, inclusive a Outbox e o mapeamento de colunas do CSV, descrito por `BackupLocalSchema` (`src/modules/backup/`). A exportação valida tudo com Zod e falha se algum registro local não passar.
- [x] **Restaurar Backup:** Valida o arquivo inteiro (Zod + tenant de cada registro + chaves repetidas) antes de gravar; recusa outro tenant e versão de banco diferente; mostra a comparação "neste aparelho × no backup", exige confirmação explícita e grava numa transação única (tudo ou nada). Mutações "em envio" voltam para `pending`.
- [x] **Lembrete:** Faixa no topo quando nunca houve backup ou o último tem 7 dias ou mais (dias de calendário), com "Lembrar amanhã". Data do último backup por aparelho no `localStorage`. Desliga com `SINCRONIZACAO_REMOTA_ATIVA` (2.11).
- [x] **Validação:** Rodar `pnpm validate`.

---

## Fase 2.11: Backend Supabase e Sincronização

Pré-requisito da Fase 3: a imutabilidade dos pedidos emitidos é garantida no servidor.

### 2.11.1. Banco Remoto

Decisões de 2026-11-05: colunas tipadas; acesso por tabela de membros (`usuarios_tenant`, papéis `admin` e `representante`, o admin também é representante); tudo compartilhado dentro do tenant (PRD 6.1).

- [x] **Migrações SQL:** `supabase/migrations/` com as 11 tabelas sincronizáveis espelhando os schemas Zod (dinheiro em `bigint` de centavos, `tenant_id`, `created_at`, `updated_at`, `deleted_at`), FKs compostas por tenant, unicidade só entre registros vivos e `checks`. O pull usa o índice `tenant_id + sincronizado_em` (preenchido pelo servidor), e não `updated_at`, que vem do aparelho (PRD 2.3). Um teste confere as colunas contra os schemas Zod.
- [x] **RLS por Tenant:** Políticas por `tenant_ids_do_usuario()`, sem `delete` e sem acesso `anon`; `admin` gerencia membros em `usuarios_tenant` (PRD 6.1).
- [x] **Imutabilidade Remota:** Triggers bloqueando a edição de campos comerciais e de itens de pedidos `emitido+`, com as transições do funil (provisórias até a Fase 3).
- [x] **Testes:** `src/db/__tests__/supabase-migracoes.test.ts` aplica as migrações num PostgreSQL real (PGlite) no `pnpm validate`: RLS, papéis, integridade e imutabilidade.
- [ ] **Aplicar no projeto Supabase:** instalar o Supabase CLI, `supabase link` e `supabase db push`; criar o primeiro tenant e o admin (sem tela de convite: SQL ou painel). Ainda não feito (depende de criar o projeto na região São Paulo, `HOSPEDAGEM_E_SINCRONIZACAO.md`).

### 2.11.2. Autenticação e Tenant

- [ ] **Login:** Autenticação Supabase com sessão que continua válida offline. O tenant passa a vir de `usuarios_tenant` do usuário autenticado (se tiver mais de um, o app pergunta), substituindo o tenant fixo de desenvolvimento.
- [ ] **Gestão de Membros:** Tela para o `admin` convidar e desativar usuários do tenant (hoje só por SQL/painel).

### 2.11.3. Envio da Outbox (Push)

- [ ] **Outbox nos Cadastros Mestres:** Hoje o cadastro manual de produtos, preços (`itens_preco`), tabelas e representadas grava só no Dexie, sem registrar mutação na Outbox. Só a importação CSV e o reajuste em lote (2.9) registram. Registrar `criarMutacaoParaRegistro` na mesma transação nesses adaptadores antes de ligar o envio.
- [ ] **Worker de Envio:** Enviar as mutações em ordem, com `idempotency_key`, **cada pedido junto com seus itens numa única transação** (função RPC: o servidor só aceita itens de pedido emitido na transação que gravou o pedido, PRD 3.2), novas tentativas com espera crescente e registro de `last_error`. Disparar ao abrir o app e ao voltar a conexão.

### 2.11.4. Recebimento e Conflitos (Pull)

- [ ] **Pull Incremental:** Buscar por `updated_at` com checkpoint por tabela, aplicando tombstones, LWW por registro nos cadastros de campo e *server-wins* nos mestres da fábrica (PRD 3.2).
- [ ] **Testes de Conflito:** Edições offline do mesmo registro em dois aparelhos.

### 2.11.5. Interface de Sincronização

- [ ] **Status:** `ConnectionStatus` mostra pendências, horário da última sincronização, erros e botão "Sincronizar agora".
- [ ] **Validação:** Rodar `pnpm validate`.

---

## Fase 3: Funil de Faturamento e Conciliação Financeira

### 3.1. Máquina de Estados Logísticos do Pedido

- [ ] **Atualização de Status Logístico:** Transições do pedido: `emitido` -> `parcialmente_faturado` -> `faturado_total` (e `cancelado`). A liquidação financeira não é status do pedido, mas sim controlada em `extratos_comissao.status_comissao = 'paga'` e exibida como badge financeiro ao lado do pedido.
- [ ] **Imutabilidade Remota:** Garantida pelo trigger da Fase 2.11.1; aqui, apenas cobrir as novas transições de status.
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
