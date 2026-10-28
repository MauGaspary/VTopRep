# Plano de Melhorias: Revisão da Fase 1

Este documento consolida os pontos levantados na revisão do repositório ao final da Fase 1 (cadastros base). Cada item deve ser atacado seguindo o pipeline de Vertical Slice do `AGENTS.md` e encerrado com `pnpm validate`.

**Prioridade:** 🔴 Alta (corrigir antes da Fase 2) · 🟡 Média · 🟢 Baixa

**Situação em 28/10/2026:** todos os itens de código foram resolvidos. `pnpm validate` ✅ (Biome limpo, `tsc` sem erros, 20 arquivos / 227 testes). Ficam pendentes apenas os itens que dependem de outra máquina, do navegador real ou do backend Supabase (ver "Pendências").

---

## Decisões Registradas

| Tema | Decisão |
|---|---|
| CPF/CNPJ do cliente (1.4) | **Continua obrigatório** e precisa ser válido. |
| Nomes repetidos (1.2) | Em **clientes e representadas**, só o documento bloqueia. Só **clientes** mostram aviso de nome igual (`HomonymWarning`, com *debounce* de 400 ms); em representadas o aviso foi descartado por ter pouco valor. |
| Desconto do item (3.6) | **Percentual** em centésimos (0 a 10000) é a fonte da verdade; o preço líquido deriva dele com half-even. |
| `ativo` × `deleted_at` (3.1) | `ativo` = estado de negócio reversível; `deleted_at` = tombstone de sincronização (some de tudo e não conta na unicidade). |
| Hooks reativos (4.5) | Wrapper `useLiveRepositoryQuery` em `shared/hooks/`; `DevSeedButton` documentado como exceção dev-only no `AGENTS.md`. |
| Conflito de sync (6.2) | **Proposta**, a confirmar: LWW por `updated_at` para edições de cadastros de campo; mestres da fábrica seguem server-wins. Registrado no PRD 3.2. |

---

## 0. Baseline

- [x] Instalar ferramentas (`pnpm` 12.16.1, dependências) e rodar a validação.
- [x] Registrar o resultado (28/10/2026, Windows): `tsc` ✅, Vitest ✅ (126 testes), lint ✅, formatação ❌ (72 erros de CRLF, ver 0.1).

### 0.1. 🔴 Quebras de linha CRLF quebram o `biome check` no Windows
- [x] `.gitattributes` com `* text=auto eol=lf`.
- [x] Checkout local renormalizado (todos `w/lf`).
- [x] `"lineEnding": "lf"` no `formatter` do `biome.json`.
- [x] `pnpm validate` verde.
- [ ] Na outra máquina, depois do pull: se houver arquivos em CRLF, rodar a mesma renormalização (`git ls-files --eol` mostra o estado).

---

## 1. Regras de Negócio

### 1.1. 🔴 Unicidade de SKU por representada ✅
- [x] Unicidade por `tenant_id + representada_id + sku normalizado` (`detectarConflitoSku`).
- [x] `obterPorSku(tenantId, representadaId, sku)`.
- [x] Índice `[tenant_id+representada_id+sku]` na v4 do Dexie. O SKU passa a ser **gravado normalizado** (trim + maiúsculas), então a consulta é exata pelo índice. A migração normaliza os SKUs existentes.
- [x] Testes: mesmo SKU em representadas distintas permitido; na mesma representada rejeitado; inativo continua oferecendo reativação; tombstone não bloqueia.

### 1.2. 🔴 Unicidade de nomes em clientes ✅
- [x] Bloqueio apenas por CPF/CNPJ.
- [x] Conflito de nomes vira aviso não bloqueante na UI (`buscarHomonimos` no repositório + `useHomonimosCliente` + `HomonymWarning`).
- [x] Representadas: CNPJ bloqueia, nomes repetidos são livres e sem aviso (poucos cadastros, conhecidos pelo representante).
- [x] Erros `RazaoSocial*Duplicad*Error` / `NomeFantasia*Duplicado*Error` removidos; `*InativoExistenteError` passa a tratar só o documento.
- [x] Testes atualizados (cenário de filiais).

### 1.3. 🔴 Tipo de frete inconsistente ✅
- [x] `TipoFreteSchema` / `TIPOS_FRETE` / `ROTULOS_FRETE` em `src/shared/domain/frete.ts`, usados por `Representada.regras_frete_padrao` e `Pedido.tipo_frete`.
- [x] PRD atualizado.

### 1.4. 🟡 CPF/CNPJ obrigatório no cliente ✅
- [x] Decisão: continua obrigatório. Testes cobrem documento ausente e inválido; PRD registra a regra; `duvidas.md` limpo.

---

## 2. Isolamento de Tenant (Regra 4 do `AGENTS.md`)

### 2.1. 🔴 `tenant_id` em tabelas filhas ✅
- [x] `tenant_id` em `ClienteEnderecoSchema` e `ClienteContatoSchema`, preenchido por `montarFilhosCliente`.
- [x] Dexie v4 com `[tenant_id+cliente_id]`; `upgrade()` herda o tenant do cliente pai e remove órfãos (inalcançáveis pela UI).
- [x] `obterPorId` e `atualizar` consultam/apagam filhos por `[tenant_id+cliente_id]`.
- [x] Dicionário de dados do PRD atualizado.

### 2.2. 🟡 Tenant em `inativarProduto` / `reativarProduto` ✅
- [x] Assinatura `(existente, tenantId, agora)` também em `atualizarProduto`; `criarProduto({ tenantId, input, id, agora })` no padrão de representadas.
- [x] `TenantDivergenteError` único em `src/shared/domain/tenant.ts` (substitui `TenantDivergenteError`/`TenantDivergenteClienteError` dos módulos).
- [x] Testes de tenant divergente nos três módulos.

### 2.3. 🟢 Seed apaga dados de todos os tenants ✅
- [x] `limparDadosDoTenant` apaga só o tenant informado, em **todas** as tabelas (inclusive `pedidos`, `itens_pedido` e `outbox`).
- [x] Teste garante que dados de outro tenant sobrevivem.

---

## 3. Modelo de Dados

### 3.1. 🔴 `ativo` vs `deleted_at` ✅
- [x] Semântica decidida (ver tabela) e aplicada em Cliente, Produto e Representada (Representada ganhou `ativo`).
- [x] Migração v4: todo `deleted_at` legado era inativação, então vira `ativo = false` + `deleted_at = null`.
- [x] Listagens: `listar` = ativos; `listarTodos/listarTodas` = ativos + inativos; tombstones nunca aparecem e não participam da unicidade.

### 3.2. 🔴 Nomes de campos divergentes do PRD ✅
- [x] `teto_desconto_permitido` → `desconto_maximo_permitido` (schema, seed, migração), com teto de 100%.
- [x] Varredura dos demais schemas: `multiplo_embalagem` agora é obrigatório na entidade (padrão 1); `vigencia_fim` documentada como nullable no PRD, com validação `fim >= início`.

### 3.3. 🟡 Convenção do Outbox ✅
- [x] snake_case (`tenant_id`, `idempotency_key`, `retry_count`, `last_error`, `created_at`) e índice `[tenant_id+status]`; migração renomeia registros existentes.
- [x] `entity` derivado de `ENTIDADES_SINCRONIZAVEIS` (todas as tabelas de negócio).

### 3.4. 🟡 Datas sem formato validado ✅
- [x] `TimestampSchema` (`z.iso.datetime()`) e `DataSchema` (`z.iso.date()`) em `src/shared/domain/datas.ts`; `CamposSincronizaveisSchema` reaproveitado por todas as entidades.
- [x] Vigências e `data_ultima_compra` como data pura; migração converte valores legados.

### 3.5. 🟡 Seed não passa pelos schemas ✅
- [x] Seed usa `criarRepresentada`, `criarProduto`, `criarClienteCompleto` e `Schema.parse`.
- [x] CPF/CNPJ válidos e distintos (`calcularDigitosVerificadoresCpf` criado).
- [x] Teste valida todos os registros gerados contra os schemas.

### 3.6. 🟢 Desconto em `ItemPedido` ✅
- [x] Percentual (0 a 10000) como fonte da verdade; PRD e TODO 2.2 ajustados.

---

## 4. Organização e Duplicação de Código

### 4.1. 🟡 Normalização de texto duplicada ✅
- [x] `src/shared/domain/texto.ts` (`normalizarTexto`) com testes; módulos não importam mais uns dos outros.
- [x] `normalizarCpfCnpj` delega para `normalizarCnpj` (uma única implementação); buscas por documento reutilizam essas funções.

### 4.2. 🟡 Lógica de unicidade copiada ✅
- [x] `detectarConflito` e `detectarHomonimos` puros em `src/shared/domain/unicidade.ts`, com testes; cada módulo expõe seu `detectarConflito*`/`detectarHomonimos*`.
- [x] Adapters só buscam candidatos e traduzem o conflito em erro.

### 4.3. 🔴 Verificação de unicidade fora de transação (produtos) ✅
- [x] `criar`/`atualizar`/`reativar` (e `inativar`) dentro de `transaction("rw", [produtos, representadas])`; teste de duas criações concorrentes.
- [x] Representadas conferidas (já eram transacionais).

### 4.4. 🟢 Consultas por varredura (parcial)
- [x] Unicidade usa índices compostos: `[tenant_id+cnpj_cpf]`, `[tenant_id+cnpj]`, `[tenant_id+representada_id+sku]`.
- [ ] Medir a busca do catálogo com alguns milhares de SKUs **no navegador** (o `fake-indexeddb` não é representativo) e avaliar índice de prefixo se necessário.

### 4.5. 🟡 Regra de infraestrutura vs `dexie-react-hooks` ✅
- [x] `useLiveRepositoryQuery` em `src/shared/hooks/`, usado por todos os hooks de módulo.
- [x] Exceção do `DevSeedButton` documentada no `AGENTS.md`.

### 4.6. 🟡 Type-assertion cega no formulário de produtos ✅
- [x] Type guard `isCampoProdutoForm`; caminhos desconhecidos vão para o erro geral (`mapearIssues`).

### 4.7. 🟡 Validação de formulário inconsistente entre módulos ✅
- [x] `cliente-form.ts` e `produto-form.ts` no padrão de `representada-form.ts`, com testes.
- [x] Múltiplo de embalagem validado com `^\d+$` (vazio = padrão 1; `"12abc"`, `"1,5"` e `"abc"` viram erro de campo).
- [x] Nenhum `ZodError` cru na UI: `mapearIssues` (erros por campo + geral) e `mensagemDeErro` nos `catch` de todas as telas. E-mail inválido do contato aparece no próprio campo.

---

## 5. Higiene do Repositório ✅

- [x] `supabase/.temp/` já estava no `.gitignore`; removido do índice.
- [x] `.oxlintrc.json` removido (o oxlint não é dependência; o lint oficial é o Biome).
- [x] Script `"test": "vitest"` (watch) e README atualizado (`pnpm validate`).
- [x] Zero `any` e zero casts cegos.

---

## 6. Pré-requisitos da Fase 2

### 6.1. 🔴 Módulo de dinheiro com arredondamento *half-even* ✅
- [x] `src/shared/domain/dinheiro.ts`: `dividirHalfEven`, `multiplicarPorFracao`, `aplicarPercentual`, `somarCentavos` (em `BigInt`).
- [x] Testes: dízimas (1/3, 2/3), empates (x,5 → par), negativos, valores acima de 2^53 no intermediário, zero e 100%.

### 6.2. 🟡 Estratégia de conflito na sincronização (parcial)
- [x] Política registrada no PRD 3.2 (proposta de LWW para cadastros de campo, a confirmar).
- [ ] Trigger de imutabilidade de pedidos `emitido+` no PostgreSQL, a ser criado junto com a primeira migração Supabase de `pedidos` (ainda não há migrações).

---

## Pendências e Novos Achados

- [x] 🟡 **Filhos de cliente sem soft delete:** endereços e contatos ganharam `created_at`/`updated_at`/`deleted_at` (migração Dexie v5). `atualizar` agora reconcilia a coleção (`sincronizarFilhosCliente`): mantém os inalterados, atualiza os alterados, marca `deleted_at` nos removidos e ignora ids de outro cliente.
- [x] 🟢 **Aviso de nomes a cada tecla:** `useHomonimosCliente` só consulta 400 ms depois que o usuário para de digitar (`useDebouncedValue`) e nunca com nomes vazios. Aviso removido de representadas.
- [ ] 0.1, 4.4 e 6.2: itens externos listados acima.
