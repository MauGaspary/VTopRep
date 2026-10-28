# Plano de Melhorias: Revisão da Fase 1

Este documento consolida os pontos levantados na revisão do repositório ao final da Fase 1 (cadastros base). Cada item deve ser atacado seguindo o pipeline de Vertical Slice do `AGENTS.md` e encerrado com `pnpm validate`.

**Prioridade:** 🔴 Alta (corrigir antes da Fase 2) · 🟡 Média · 🟢 Baixa

---

## 0. Baseline

- [x] Instalar ferramentas (`pnpm` 12.16.1, dependências) e rodar a validação.
- [x] Registrar o resultado (28/10/2026, Windows):

| Etapa | Resultado |
|---|---|
| `pnpm type-check` (`tsc -b`) | ✅ Sem erros |
| `pnpm test:run` (Vitest) | ✅ 11 arquivos, 126 testes passando |
| `pnpm biome check`, regras de lint | ✅ Sem erros |
| `pnpm biome check`, formatação | ❌ 72 erros, **todos de quebra de linha (CRLF)**, ver 0.1 |

### 0.1. 🔴 Quebras de linha CRLF quebram o `biome check` no Windows
- **Problema:** o repositório guarda os arquivos em LF, mas `core.autocrlf=true` nesta máquina converte para CRLF no checkout (`git ls-files --eol` → `i/lf w/crlf`). O Biome espera LF e acusa os 72 arquivos. Confirmado: com `biome format --line-ending=crlf`, não sobra nenhum erro. A falha depende da máquina, e por isso não aparecia na outra.
- **Ação:**
  - [x] Criar `.gitattributes` com `* text=auto eol=lf` (força LF no working tree em qualquer SO).
  - [x] Renormalizar o checkout local (arquivos versionados apagados e restaurados via `git checkout -- .`, agora todos `w/lf`).
  - [x] Fixar `"lineEnding": "lf"` no `formatter` do `biome.json` para deixar a intenção explícita.
  - [x] Rodar `pnpm validate` de novo: ✅ Biome limpo, `tsc` sem erros, 126/126 testes.
  - [ ] Na outra máquina, depois do pull: se houver arquivos em CRLF, rodar a mesma renormalização (`git ls-files --eol` mostra o estado).
- **Atenção:** **não** rodar `pnpm biome check --write` antes de resolver isso. Ele reescreveria os 72 arquivos e geraria um diff enorme só de quebra de linha.

---

## 1. Regras de Negócio

### 1.1. 🔴 Unicidade de SKU por representada
- **Problema:** `garantirUnicidadeSku` em `src/modules/produtos/repositories/produto-dexie.adapter.ts` considera o SKU único por tenant. Fábricas diferentes podem usar o mesmo SKU (ex.: "001").
- **Ação:**
  - [ ] Unicidade por `tenant_id + representada_id + sku normalizado`.
  - [ ] Ajustar `obterPorSku` para receber `representadaId`.
  - [ ] Adicionar índice `[tenant_id+representada_id+sku]` em nova versão do Dexie.
  - [ ] Testes: mesmo SKU em representadas distintas é permitido; na mesma representada é rejeitado; caso do inativo continua oferecendo reativação.

### 1.2. 🔴 Unicidade de nomes em clientes
- **Problema:** `garantirUnicidade` em `src/modules/clientes/repositories/cliente-dexie.adapter.ts` bloqueia razão social e nome fantasia duplicados. Isso impede o cadastro de filiais (mesma razão social, CNPJs diferentes) e de redes com o mesmo nome fantasia.
- **Ação:**
  - [ ] Manter como bloqueio apenas o CPF/CNPJ.
  - [ ] Transformar conflito de nomes em **aviso** (não bloqueante) na UI.
  - [ ] Revisar se a mesma regra faz sentido para representadas (provavelmente sim para CNPJ; avaliar nomes).
  - [ ] Atualizar testes.

### 1.3. 🔴 Tipo de frete inconsistente
- **Problema:** `Representada.regras_frete_padrao` aceita `CIF | FOB | FOB_REDESPACHO`, mas `Pedido.tipo_frete` aceita só `CIF | FOB`. Um pedido não consegue herdar o padrão da representada.
- **Ação:**
  - [ ] Criar um único `TipoFreteSchema` em `shared/domain/` e reutilizá-lo nos dois schemas.
  - [ ] Atualizar o PRD.

### 1.4. 🟡 CPF/CNPJ obrigatório no cliente (`duvidas.md`)
- **Problema:** o schema exige documento válido, o que bloqueia o cadastro rápido de prospects em campo.
- **Ação:**
  - [ ] Decidir a regra (opcional para prospect? obrigatório só para emitir pedido?).
  - [ ] Refletir a decisão no schema, nos testes e no PRD; remover de `duvidas.md`.

---

## 2. Isolamento de Tenant (Regra 4 do `AGENTS.md`)

### 2.1. 🔴 `tenant_id` em tabelas filhas
- **Problema:** `clientes_enderecos` e `clientes_contatos` não têm `tenant_id`. Vai faltar para a RLS no Supabase e contraria a regra de "toda entidade persistida contém `tenant_id`".
- **Ação:**
  - [ ] Adicionar `tenant_id` aos schemas `ClienteEnderecoSchema` e `ClienteContatoSchema`.
  - [ ] Nova versão do Dexie com índices `[tenant_id+cliente_id]` e `upgrade()` preenchendo o `tenant_id` a partir do cliente pai.
  - [ ] Filtrar por tenant nas consultas de `obterPorId` e `atualizar`.
  - [ ] Atualizar o dicionário de dados do PRD.

### 2.2. 🟡 Tenant em `inativarProduto` / `reativarProduto`
- **Problema:** as funções de domínio de produto não recebem nem validam `tenantId`. Clientes e representadas recebem.
- **Ação:**
  - [ ] Padronizar a assinatura `(existente, tenantId, agora)` e lançar `TenantDivergente*Error`.
  - [ ] Teste de tenant divergente.

### 2.3. 🟢 Seed apaga dados de todos os tenants
- **Problema:** `seedDatabase` em `src/db/seed.ts` faz `clear()` em todas as tabelas.
- **Ação:**
  - [ ] Apagar apenas os registros do tenant informado, ou renomear para `resetarBancoEPopular` deixando o efeito explícito.
  - [ ] Incluir `pedidos`, `itens_pedido` e `outbox` na limpeza, se mantido o reset total.

---

## 3. Modelo de Dados

### 3.1. 🔴 `ativo` vs `deleted_at`
- **Problema:** em Cliente e Produto, inativar preenche `ativo = false` **e** `deleted_at`. Os dois campos dizem a mesma coisa, mas o PRD trata `deleted_at` como *tombstone* de sincronização (exclusão), enquanto "inativo" é um estado de negócio.
- **Ação:**
  - [ ] Decidir a semântica: `ativo` = estado de negócio (reversível, aparece em "inativos"); `deleted_at` = exclusão lógica (some da UI, propaga como tombstone).
  - [ ] Aplicar a decisão de forma uniforme em Cliente, Produto e Representada (hoje Representada só tem `deleted_at`).
  - [ ] Migração Dexie e ajuste dos filtros/listagens/testes.

### 3.2. 🔴 Nomes de campos divergentes do PRD
- **Problema:** `ItemPreco.teto_desconto_permitido` no código vs `desconto_maximo_permitido` no PRD.
- **Ação:**
  - [ ] Escolher um nome e alinhar schema, seed e PRD.
  - [ ] Varrer os demais schemas comparando com o dicionário de dados do PRD.

### 3.3. 🟡 Convenção do Outbox
- **Problema:** `OutboxMutationSchema` usa camelCase (`tenantId`, `createdAt`, `idempotencyKey`), e o restante usa snake_case. `entity` cobre só `pedidos`, `clientes` e `itens_pedido`.
- **Ação:**
  - [ ] Padronizar para snake_case (e índice Dexie correspondente).
  - [ ] Incluir `produtos`, `representadas`, `clientes_enderecos`, `clientes_contatos`, `tabelas_preco`, `itens_preco`, ou derivar a lista dos nomes de tabela.

### 3.4. 🟡 Datas sem formato validado
- **Problema:** timestamps e vigências são `z.string()` livres.
- **Ação:**
  - [ ] Usar `z.iso.datetime()` para `created_at`/`updated_at`/`deleted_at`/`data_emissao`.
  - [ ] Usar `z.iso.date()` para `vigencia_inicio`/`vigencia_fim`/`data_ultima_compra`.
  - [ ] Pré-requisito para a resolução de preço por vigência (TODO 2.1).

### 3.5. 🟡 Seed não passa pelos schemas
- **Problema:** `seed.ts` monta objetos à mão; `cnpj_cpf: faker.string.numeric(14)` gera CNPJs quase sempre inválidos, e a tela de edição depois recusa o registro.
- **Ação:**
  - [ ] Gerar dados via funções de domínio (`criarClienteCompleto`, `criarProduto`, `criarRepresentada`) ou validar com `Schema.parse` antes de gravar.
  - [ ] Gerar CPF/CNPJ válidos com `calcularDigitosVerificadoresCnpj` (e equivalente para CPF).

### 3.6. 🟢 Desconto em `ItemPedido`
- **Problema:** `percentual_desconto` não tem teto (`max(10000)`) e o TODO 2.2 fala em `desconto_unitario` em centavos.
- **Ação:**
  - [ ] Definir se o desconto é percentual, valor ou ambos; ajustar o schema antes do motor financeiro.

---

## 4. Organização e Duplicação de Código

### 4.1. 🟡 Normalização de texto duplicada
- **Problema:** `normalizarTextoComparacao` (representadas) e `normalizarTexto` (produtos) fazem o mesmo. Clientes importa de `representadas/domain`, acoplando módulos.
- **Ação:**
  - [ ] Criar `src/shared/domain/texto.ts` com uma única função + testes.
  - [ ] Substituir os usos nos três módulos.
- **Problema relacionado:** `normalizarCnpj` e `normalizarCpfCnpj` também são idênticas. Unificar.

### 4.2. 🟡 Lógica de unicidade copiada
- **Problema:** `garantirUnicidade` e `garantirUnicidadeEntreAtivos` (clientes) repetem o mesmo laço; representadas tem padrão parecido.
- **Ação:**
  - [ ] Extrair função pura de domínio, ex.: `detectarConflito(lista, dados) => Conflito | null`, testável sem Dexie.
  - [ ] Adapter apenas busca candidatos e traduz o conflito em erro.

### 4.3. 🔴 Verificação de unicidade fora de transação (produtos)
- **Problema:** `ProdutoDexieAdapter.criar` (e `atualizar`/`reativar`) verificam a unicidade e depois gravam sem `db.transaction`. Dois envios rápidos podem duplicar o registro.
- **Ação:**
  - [ ] Envolver verificação + escrita em `transaction("rw", [produtos, representadas], ...)`, como em clientes.
  - [ ] Conferir o mesmo em representadas.

### 4.4. 🟢 Consultas por varredura
- **Problema:** as listagens e verificações usam `.where("tenant_id").filter(...)`, carregando o tenant inteiro, mesmo com índices compostos disponíveis (`[tenant_id+cnpj_cpf]`).
- **Ação:**
  - [ ] Usar os índices compostos nas verificações de unicidade.
  - [ ] Medir a busca do catálogo com alguns milhares de SKUs; avaliar índice de prefixo por SKU/descrição normalizados se necessário.

### 4.5. 🟡 Regra de infraestrutura vs `dexie-react-hooks`
- **Problema:** o `AGENTS.md` proíbe Dexie em `hooks/`, mas os hooks importam `useLiveQuery` de `dexie-react-hooks`. O `DevSeedButton` importa `db` direto em `shared/components`.
- **Ação (escolher uma):**
  - [ ] Atualizar o `AGENTS.md` permitindo explicitamente `useLiveQuery`, **ou**
  - [ ] Criar wrapper `useLiveRepositoryQuery` em `shared/hooks/` e usá-lo nos módulos.
  - [ ] Documentar a exceção do `DevSeedButton` (dev-only) ou movê-lo para trás de um serviço.

### 4.6. 🟡 Type-assertion cega no formulário de produtos (Regra 1)
- **Problema:** `src/modules/produtos/components/produto-form-view.tsx:178` faz `issue.path[0] as keyof ProdutoFormErrors`, violando a regra "proibido `as Type` sem validação". Se o Zod reportar um caminho que não é campo do formulário, o erro vai parar numa chave que a UI não exibe e se perde em silêncio.
- **Ação:**
  - [ ] Substituir por um type guard (ex.: `isCampoProdutoForm(chave): chave is keyof ProdutoFormErrors`) e mandar caminhos desconhecidos para o erro geral.

### 4.7. 🟡 Validação de formulário inconsistente entre módulos
- **Problema:** Representadas tem a conversão e validação do formulário em função pura testada (`representada-form.ts` + `representada-form.spec.ts`). Clientes e Produtos fazem isso dentro do componente:
  - `cliente-form-view.tsx` revalida campos **à mão** (`if (!razaoSocial.trim())…`), duplicando as regras do `ClienteInputSchema`. O e-mail do contato não é validado no formulário: um e-mail inválido chega ao repositório, o Zod lança `ZodError` e a UI mostra a **mensagem crua do Zod (JSON)** no alerta geral.
  - `produto-form-view.tsx` usa `Number.parseInt`, que aceita `"12abc"` como 12 e `"1,5"` como 1. Quando o resultado é `NaN` (ex.: `"abc"`), troca em silêncio por `1` em vez de mostrar erro.
- **Ação:**
  - [ ] Criar `cliente-form.ts` e `produto-form.ts` no padrão de `representada-form.ts` (valores crus → `safeParse` → erros por campo), com testes.
  - [ ] Validar o múltiplo de embalagem com regex `^\d+$` e devolver erro de campo em vez de usar `1` como padrão.
  - [ ] Garantir que nenhum `ZodError` chegue cru à UI: mapear `issues` para erros de campo.

---

## 5. Higiene do Repositório

- [ ] 🟢 Adicionar `supabase/.temp/` ao `.gitignore` e remover do índice (`git rm -r --cached supabase/.temp`).
- [ ] 🟢 Remover `.oxlintrc.json` se o oxlint não for usado (o lint oficial é o Biome).
- [ ] 🟢 Adicionar script `"test": "vitest"` (modo watch) ao `package.json` e atualizar o README.
- [ ] 🟢 Não há `any` no código. Há **um** cast cego (ver 4.6); depois de corrigido, manter zero.

---

## 6. Pré-requisitos da Fase 2

### 6.1. 🔴 Módulo de dinheiro com arredondamento *half-even*
- **Problema:** exigido no `AGENTS.md`, mas ainda não implementado.
- **Ação:**
  - [ ] Criar `src/shared/domain/dinheiro.ts` com, por exemplo, `aplicarPercentual(centavos, centesimosPercentual)` e `arredondarHalfEven`, usando aritmética inteira (ou `BigInt` para evitar overflow).
  - [ ] Testes: dízimas periódicas (1/3, 2/3), empates exatos (x,5 → par), valores grandes, zero e 100%.

### 6.2. 🟡 Estratégia de conflito na sincronização
- **Problema:** cadastros editados offline em dois aparelhos vão conflitar; o outbox ainda não define a política.
- **Ação:**
  - [ ] Decidir a política (last-write-wins por `updated_at`, versão por registro, ou merge por campo) e registrar no PRD.
  - [ ] Garantir que pedidos `emitido+` sejam imutáveis também no lado remoto.

---

## Ordem Sugerida de Ataque

1. **0.1** `.gitattributes` + renormalização para LF, até `pnpm validate` ficar verde
2. **4.1** Normalização em `shared/`: pequeno, destrava os outros
3. **1.1** SKU por representada + **4.3** transação em produtos
4. **1.2** Unicidade de clientes + **4.2** função pura de conflito
5. **3.1** `ativo` vs `deleted_at` + **2.2** tenant em produtos
6. **2.1** `tenant_id` em tabelas filhas (migração Dexie)
7. **1.3**, **3.2**, **3.3**, **3.4**: alinhamento de schemas com o PRD
8. **4.6** + **4.7** Formulários de cliente/produto como funções puras testadas
9. **6.1** Módulo de dinheiro (abre a Fase 2)
10. Demais itens 🟡/🟢
