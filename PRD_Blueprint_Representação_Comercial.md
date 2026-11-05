# Product Requirement Document (PRD) & Blueprint de Engenharia

## Sistema de Gestão para Representante Comercial Multirrepresentada

---

## 1. Visão Geral e Contexto de Negócio

O sistema é a ferramenta central de trabalho em campo para representantes comerciais autônomos B2B que operam com múltiplas fábricas (multirrepresentadas). O software é projetado sob a filosofia **Offline-First**, operando com máxima fluidez independentemente da conectividade com a internet.

### Gargalos Operacionais Resolvidos

1. **Agilidade em Campo (Offline-First):** Emissão de pedidos em segundos sem dependência de sinal de internet, com cache local de catálogos e sincronização em segundo plano.
2. **Conformidade Automática de Políticas Comerciais:** Validação de regras parametrizadas por representada (múltiplos de embalagem, valor/volume mínimo de faturamento, tetos de desconto escalonados e regras de frete CIF/FOB).
3. **Auditoria e Conciliação de Comissões:** Rastreamento do ciclo de vida completo do pedido (*Rascunho* -> *Emitido* -> *Faturado Parcial/Total* -> *Comissão Liquidada*), alertando sobre glosas, devoluções e divergências entre o pedido emitido e a nota fiscal faturada.
4. **Inteligência de Recompra e Carteira (CRM B2B):** Alertas preditivos baseados na curva média de recompra de cada cliente, ficha pré-visita e categorização por curva ABC.

---

## 2. Invariantes de Domínio e Modelo de Dados

### 2.1. Invariantes Inegociáveis

* **Precisão Monetária Absoluta:** O uso de tipos de ponto flutuante (`float`, `double`, `number` decimal nativo) para valores monetários é estritamente proibido. Todos os valores de moeda e descontos no banco de dados e na memória da aplicação devem ser armazenados e manipulados como **inteiros representando centavos** (ex.: R$ 150,50 = `15050`). O frontend utiliza funções puras de formatação apenas na camada de apresentação.
* **Isolamento Multi-Tenant:** Toda entidade persistida contém obrigatoriamente a coluna `tenant_id: UUID`. Nenhuma consulta é realizada sem esse filtro.
* **Soft Delete Universal:** Nenhuma exclusão em tabelas de negócio é física. Toda tabela sincronizável possui a coluna `deleted_at: timestamptz (nullable)`. O cliente local filtra registros ativos com `deleted_at is null` e processa remoções remotas recebendo registros marcados (*tombstones*).
* **Inativo ≠ Excluído:** São dois conceitos com colunas distintas.
  * `ativo: boolean` é **estado de negócio**, reversível. Um cadastro inativo some das seleções de novos orçamentos, mas continua na lista de "inativos" e pode ser reativado.
  * `deleted_at` é **exclusão lógica** (tombstone de sincronização). O registro some de todas as telas e consultas, inclusive da lista de inativos, e não participa das regras de unicidade.
  * Inativar ou reativar altera apenas `ativo` e `updated_at`. Nunca preenche `deleted_at`.
* **Unicidade de Cadastros (por tenant):**
  * **Bloqueantes:** CPF/CNPJ do cliente; CNPJ da representada; SKU do produto **por representada** (fábricas diferentes podem repetir o SKU). A comparação usa o valor normalizado (sem pontuação/espaços, maiúsculo). Se a chave pertence a um registro **inativo**, a UI oferece reativá-lo em vez de criar um duplicado.
  * **Não bloqueantes:** razão social e nome fantasia (de clientes e de representadas) podem se repetir, já que filiais e redes compartilham nomes. No cadastro de **clientes**, a UI avisa (sem bloquear) quando encontra outro cliente com o mesmo nome, para pegar duplicados com documento diferente (erro de digitação, CPF do dono × CNPJ da empresa). Representadas não têm aviso: são poucas e conhecidas pelo representante.
* **CPF/CNPJ obrigatório:** todo cliente exige documento válido no cadastro (CPF ou CNPJ, inclusive alfanumérico).
* **Datas:** timestamps (`created_at`, `updated_at`, `deleted_at`, `data_emissao`) são ISO-8601 em UTC (`2026-10-28T12:00:00.000Z`). Datas de calendário (`vigencia_*`, `data_*` sem horário) usam `AAAA-MM-DD`.
* **Imutabilidade de Pedidos Sincronizados:** Um pedido marcado como `emitido` ou superior torna-se somente-leitura. Ajustes pós-envio à fábrica exigem a emissão de aditivos ou novos pedidos vinculados.

---

### 2.2. Diagrama de Relacionamento (ERD)

```text
Representada (1) ----< (N) TabelaPreco (1) ----< (N) ItemPreco >---- (1) Produto
     |                                                                   |
     | (1)                                                               | (1)
     v (N)                                                               v (N)
   Pedido (1) ------------------------< (N) ItemPedido >------------------+
     |
     +--- (N) >--- (1) Cliente (1) ----< (N) ClienteEndereco
     |                   |     (1) ----< (N) ClienteContato
     |                   +---- (1) ---- (1) ClienteMetrica
     |
     +--- (1) >--- (N) FaturamentoParcial (Notas Fiscais emitidas pela fábrica)
     |
     +--- (1) >--- (N) ExtratoComissao (Conciliação financeira)
```

---

### 2.3. Dicionário de Dados

#### `representadas`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `razao_social: text`
* `nome_fantasia: text`
* `cnpj: text`
* `percentual_comissao_padrao: integer` (Base em centésimos de %, ex: 500 = 5,00%; alíquota padrão / revenda)
* `percentual_comissao_revenda: integer` (Centésimos de %, aplicável quando `clientes.tipo_cliente = 'REVENDA'` — Fase 2.5)
* `percentual_comissao_fabrica: integer` (Centésimos de %, aplicável quando `clientes.tipo_cliente = 'FABRICA'` — Fase 2.5)
* `valor_pedido_minimo_centavos: integer`
* `regras_frete_padrao: text` (`'CIF' | 'FOB' | 'FOB_REDESPACHO'`; mesmo domínio de `pedidos.tipo_frete`)
* `cor: text (nullable)` (`'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'blue' | 'orange'`)
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `clientes`

* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `cnpj_cpf: text`
* `razao_social: text`
* `nome_fantasia: text (nullable)`
* `tipo_cliente: text` (`'REVENDA' | 'FABRICA'`; padrão `'REVENDA'`, determina a alíquota de comissão na representada — Fase 2.5)
* `transportadora_padrao_id: UUID (nullable)` (FK para `transportadoras` — Fase 2.5)
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `transportadoras` (Fase 2.5)

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `nome_fantasia: text`
* `razao_social: text (nullable)`
* `cnpj: text (nullable)` (normalizado; quando informado, único por tenant — bloqueante, com oferta de reativação se pertencer a uma inativa)
* `telefone: text (nullable)`
* `cidade_uf: text (nullable)`
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `clientes_enderecos`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK; igual ao do cliente pai)
* `cliente_id: UUID` (FK)
* `tipo_endereco: text` (`'PRINCIPAL' | 'ENTREGA' | 'COBRANCA'`)
* `endereco_completo: text`
* `latitude: double precision (nullable)`
* `longitude: double precision (nullable)`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `clientes_contatos`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK; igual ao do cliente pai)
* `cliente_id: UUID` (FK)
* `nome: text`
* `papel: text (nullable)` (`'COMPRADOR' | 'FINANCEIRO' | 'DIRETORIA'`)
* `telefone_whatsapp: text`
* `email: text (nullable)`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

Ao editar um cliente, a coleção de endereços/contatos enviada é reconciliada com a gravada: itens sem alteração não são regravados, alterados recebem novo `updated_at` e removidos recebem `deleted_at`. Nada é apagado fisicamente.

#### `clientes_metricas`

* `cliente_id: UUID` (PK/FK)
* `tenant_id: UUID`
* `data_ultima_compra: date (nullable)`
* `frequencia_recompra_dias: integer` (Default: 30)
* `curva_abc: text (nullable)` (`'A' | 'B' | 'C'`)
* `ticket_medio_centavos: integer`

#### `produtos`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `sku: text` (normalizado em maiúsculas; único por `tenant_id + representada_id`)
* `descricao: text`
* `unidade_medida: text` (Ex: `'UN'`, `'CX'`, `'KG'`)
* `multiplo_embalagem: integer` ("Peças por embalagem", **só informativo**: quantas peças vêm em cada unidade de venda, exibido como "CX com 8"; padrão 1. Quantidade e preço do pedido são sempre na unidade de venda. Regra de venda por múltiplo: `BACKLOG.md` 1.3)
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `tabelas_preco`

A tabela de preço pertence à representada; o cliente não tem tabela própria. No orçamento, cada fábrica sugere a tabela **ativa e vigente de início mais recente** (empate: ordem alfabética do nome), e o representante pode trocar a tabela em cada pedido. Sem tabela vigente, o orçamento pede a escolha manual. Variações por estado (ICMS, ST) estão no `BACKLOG.md` 1.5.

**Substituição de tabela:** ao criar uma tabela que substitui outra (importação de CSV com "Substitui a tabela" ou reajuste em lote), a substituída passa a terminar na **véspera do início da nova** (só se ainda terminava depois disso), e a nova precisa começar depois do início da substituída. Assim as duas nunca ficam vigentes ao mesmo tempo. Pedidos já gravados não mudam, porque o item do pedido guarda o próprio preço.

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `nome_tabela: text`
* `vigencia_inicio: date`
* `vigencia_fim: date (nullable)` (`null` = vigência em aberto; se informada, não pode ser anterior ao início)
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `itens_preco`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `tabela_id: UUID` (FK)
* `produto_id: UUID` (FK)
* `preco_base_centavos: integer`
* `desconto_maximo_permitido: integer` (Centésimos de %, ex: 1500 = 15,00%; entre 0 e 10000; padrão 0)
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### Importação de produtos e preços por CSV (TODO 2.9)

* **Arquivo:** CSV com separador `;`, `,` ou tabulação (detectado), UTF-8 ou Windows-1252 (detectado), BOM e campos entre aspas. Arquivos `.xlsx` são recusados com a orientação de salvar como CSV. A linha do cabeçalho é detectada (títulos acima dela são ignorados) e pode ser trocada na tela.
* **Preço:** convertido em centavos por análise de texto, sem ponto flutuante ("1.234,56", "1234.56", "R$ 1.234,56"). O separador decimal é decidido pela coluna inteira; sem pistas, vale a vírgula. Mais de 2 casas decimais são arredondadas *half-even* e geram aviso na linha.
* **Validação por linha:** SKU vazio, preço ou múltiplo inválido e produto novo sem descrição viram erro e a linha fica de fora. SKU repetido com os mesmos dados vale a primeira linha (aviso); com dados diferentes, todas as ocorrências viram erro.
* **Cadastro:** SKU existente é atualizado só nos campos preenchidos no arquivo; inativo que reaparece é reativado; novo recebe unidade `UN` e múltiplo 1 quando não vierem. Produtos ativos ausentes do arquivo são mantidos (padrão) ou inativados, por escolha do representante. Um SKU presente numa linha com erro nunca conta como ausente.
* **Preços:** gravados numa tabela existente (só os que mudaram) ou numa nova tabela, que pode substituir outra (regra em `tabelas_preco`). Linha sem preço não mexe no preço já existente.
* **Gravação:** a prévia e a gravação usam a mesma função pura; a gravação recalcula o plano com os dados atuais dentro de uma única transação Dexie (produtos, tabelas, itens de preço e Outbox), em lotes de 500.
* **`mapeamentos_importacao` (só no aparelho, não sincroniza):** `[tenant_id+representada_id]` (PK), `colunas` (nome do cabeçalho escolhido para SKU, descrição, unidade, múltiplo e preço; `null` = não importar) e `updated_at`. Guarda o nome, não a posição, porque a fábrica pode reordenar as colunas.

#### Reajuste em lote (TODO 2.9.4)

Cria uma tabela nova a partir de outra da mesma representada, com todos os itens vivos reajustados por `preço + aplicarPercentual(preço, ±X)` (centésimos de %, *half-even*; de -99,99% a +1.000%), mantendo o desconto máximo de cada item. A origem é encerrada na véspera do início da nova (regra em `tabelas_preco`). Tudo numa transação com a Outbox.

#### `pedidos`

* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `cotacao_grupo_id: UUID (nullable)` (Agrupador quando uma cotação multi-representada gera múltiplos pedidos individuais por fábrica — Fase 2.5)
* `cliente_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `tabela_id: UUID` (FK)
* `endereco_entrega_id: UUID (nullable)`
* `contato_id: UUID (nullable)`
* `transportadora_id: UUID (nullable)` (FK para `transportadoras` — Fase 2.5)
* `data_emissao: timestamptz`
* `condicao_pagamento: text`
* `tipo_frete: text` (`'CIF' | 'FOB' | 'FOB_REDESPACHO'`; herda `representadas.regras_frete_padrao` por padrão)
* `status: text` (`'rascunho' | 'emitido' | 'parcialmente_faturado' | 'faturado_total' | 'cancelado'`; o status logístico encerra em `faturado_total`, enquanto a liquidação da comissão é controlada em `extratos_comissao.status_comissao`)
* `valor_total_centavos: integer`
* `comissao_projetada_centavos: integer`
* `observacoes: text (nullable)`
* `idempotency_key: text` (UUIDv4 único gerado no momento da emissão)
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

Cotação multi-representada: a sacola é gravada numa única transação como 1 pedido por representada. Cliente, endereço de entrega, contato, transportadora e observações são comuns a todos; tabela, condição de pagamento e tipo de frete são de cada fábrica. O `cotacao_grupo_id` só é criado quando há mais de uma representada e, uma vez criado, é mantido nas edições. Ao editar um rascunho, os pedidos são casados pela representada, e os das fábricas retiradas da sacola recebem `deleted_at`. A cotação só é editável enquanto todos os seus pedidos estão em `rascunho`.

#### `itens_pedido`

* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `pedido_id: UUID` (FK)
* `produto_id: UUID` (FK)
* `quantidade: integer` (Na unidade de venda do produto, maior que zero; não é validada contra `multiplo_embalagem`)
* `preco_unitario_tabela_centavos: integer`
* `percentual_desconto: integer` (Centésimos de %, entre 0 e 10000. É a fonte da verdade do desconto)
* `preco_liquido_unitario_centavos: integer` (Derivado: `preco_unitario_tabela_centavos` com `percentual_desconto` aplicado, arredondamento half-even)
* `subtotal_centavos: integer`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### Colunas só do servidor (TODO 2.11.1)

Toda tabela sincronizável do Supabase tem, além das colunas acima, `sincronizado_em timestamptz`, preenchida pelo servidor a cada gravação. É o **checkpoint do pull** (`sincronizado_em > :checkpoint`, com uma pequena sobreposição, aplicando as mudanças de forma idempotente): `updated_at` vem do aparelho, e um aparelho offline pode enviar hoje uma edição com `updated_at` de ontem. `pedidos` ainda tem `criado_por uuid` (usuário que criou; o servidor preenche e não aceita troca). `clientes_metricas` ganhou `created_at`/`updated_at`/`deleted_at` no servidor. Dinheiro é `bigint` e percentuais são `integer`, com `check` espelhando o Zod (inclusive `subtotal = quantidade x preço líquido` em `itens_pedido`). A unicidade (CNPJ, CPF/CNPJ, SKU por representada, um preço por produto/tabela) vale só para registros vivos.

#### `faturamentos_parciais`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `pedido_id: UUID` (FK)
* `numero_nota_fiscal: text`
* `valor_faturado_centavos: integer`
* `data_faturamento: date`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `extratos_comissao`

* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `faturamento_id: UUID` (FK)
* `comissao_prevista_centavos: integer`
* `comissao_recebida_centavos: integer (nullable)`
* `data_pagamento_comissao: date (nullable)`
* `status_comissao: text` (`'aguardando' | 'paga' | 'divergente' | 'estornada'`)
* `motivo_glosa: text (nullable)`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

---

## 3. Arquitetura Offline-First e Sincronização

### 3.1. Estrutura da Fila Outbox Local (Dexie.js)

Toda mutação executada pelo usuário em modo offline não toca a rede; ela persiste na store local de negócio e cria uma entrada na tabela de outbox:

```typescript
export interface OutboxMutation {
  id: string; // UUID local
  tenant_id: string;
  entity: EntidadeSincronizavel; // nome de qualquer tabela de negócio (ver abaixo)
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: 'pending' | 'syncing' | 'failed';
  retry_count: number;
  last_error?: string;
  created_at: string; // ISO-8601
}
```

Os campos seguem o mesmo snake_case das tabelas. `EntidadeSincronizavel` cobre `representadas`, `transportadoras`, `clientes`, `clientes_enderecos`, `clientes_contatos`, `clientes_metricas`, `produtos`, `tabelas_preco`, `itens_preco`, `pedidos` e `itens_pedido` (fonte: `ENTIDADES_SINCRONIZAVEIS` em `src/modules/sync/domain/outbox.schema.ts`).

### 3.2. Estratégia de Resolução de Conflitos

* **Entidades Transacionais Geradas em Campo (Pedidos, Itens, Clientes Novos):**
  * Política: **Client-Wins com Idempotency Key**.
  * Chave primária gerada no cliente (UUIDv4). O backend trata requisições repetidas via `idempotency_key` no PostgreSQL (`ON CONFLICT (idempotency_key) DO NOTHING`). O pedido cadastrado offline nunca é sobrescrito ou rejeitado pelo servidor, exceto por falha de validação estrutural de segurança.
* **Entidades Mestres da Fábrica (Produtos, Preços, Representadas):**
  * Política: **Server-Wins via Last-Write-Wins (LWW)**.
  * O backend é a fonte de autoridade. O cliente consome rotinas de *delta sync* consultando `updated_at > :ultimaSincronizacaoLocal`.
* **Tratamento de Exclusões:**
  * O servidor envia registros com `deleted_at != null`. O Dexie.js atualiza o registro local marcando o soft-delete para removê-lo das telas sem perder integridade referencial com pedidos antigos já persistidos.
* **Cadastros editados em campo (Transportadoras, Clientes, Endereços, Contatos):**
  * Edições do mesmo cliente em dois aparelhos offline seguem **Last-Write-Wins por `updated_at`**, registro a registro (sem merge por campo nesta fase).
* **Imutabilidade remota de pedidos (implementada em `20261105120200_imutabilidade_de_pedidos.sql`):**
  * Pedido fora de `rascunho` só aceita mudar `status`, `updated_at` e `sincronizado_em`; qualquer outro campo (inclusive `deleted_at`) é recusado. Um UPDATE sem mudança comercial (reenvio da Outbox) é aceito.
  * Transições aceitas (provisórias até a Fase 3): `emitido` → `parcialmente_faturado` | `faturado_total` | `cancelado`; `parcialmente_faturado` → `faturado_total`. `faturado_total` e `cancelado` são finais.
  * Itens de um pedido não-rascunho também são somente-leitura, **exceto na transação que gravou o pedido** (novo ou vindo de rascunho). Como o aparelho envia o pedido antes dos itens, o envio de um pedido e dos seus itens deve ser **uma única transação** no servidor (TODO 2.11.3).

---

## 4. Stack Tecnológica e Engenharia de Ambiente (DX)

### 4.1. Tecnologias Principais

* **Frontend:** Vite + React (TypeScript estrito) configurado como PWA via `vite-plugin-pwa`.
* **Banco Local (Navegador):** `Dexie.js` com reatividade via `useLiveQuery`.
* **Validação Universal:** `Zod` (todos os DTOs, schemas de formulários e tipos do Dexie derivam de schemas Zod via `z.infer`).
* **Backend:** Supabase (PostgreSQL gerenciado, GoTrue Auth, Storage e Row Level Security).
* **PDF Engine:** `@react-pdf/renderer` para geração client-side determinística sem dependência de APIs externas.

### 4.2. Tooling e Ferramental de Alta Velocidade

* **Gerenciador de Pacotes:** `pnpm` (eficiência de I/O em disco e resolução determinística).
* **Linter & Formatter:** `Biome` (`@biomejs/biome`) substituindo ESLint e Prettier.
* **Test Runner:** `Vitest` com `fake-indexeddb` configurado no `setupFiles`. Permite executar a suíte inteira de repositórios do Dexie em milissegundos no terminal.
* **Supabase Local (CLI):** O desenvolvimento diário ocorre contra o PostgreSQL do Supabase via Docker local (`supabase start`). Migrações SQL são controladas via versionamento declarativo (`supabase migration new`), gerando tipos TypeScript automaticamente:

  ```bash
  pnpm supabase:types # supabase gen types typescript --local > src/types/database.types.ts
  ```

---

## 5. Padrões de Arquitetura de Software

### 5.1. Repositórios e Desacoplamento de Infraestrutura

A camada de apresentação (telas e hooks do React) consome apenas contratos de domínio. Nenhum componente importa `@supabase/supabase-js` ou `dexie` diretamente:

```text
[React Views / UI Components]
              |
              V
   [Domain Services / Use Cases]
              |
              V
    [Repository Interfaces] (src/domain/repositories/)
              |
     +--------+--------+
     V                 V
[DexieAdapter]   [SupabaseAdapter]
 (IndexedDB)        (Cloud API)
```

Exemplo de contrato:

```typescript
export interface PedidoRepository {
  salvarLocal(pedido: NovoPedidoInput): Promise<Pedido>;
  buscarPorId(id: string): Promise<Pedido | null>;
  listarPendentesSincronizacao(tenantId: string): Promise<Pedido[]>;
}
```

### 5.2. Arquitetura Vertical Slice

O código-fonte em `src/` é organizado por módulos funcionais orientados a negócio, não por tipo técnico de arquivo:

```text
src/
├── modules/
│   ├── pedidos/
│   │   ├── domain/        # Schemas Zod, tipos e regras de negócio puras
│   │   ├── repositories/  # Interfaces abstratas
│   │   ├── adapters/      # Implementações concretas Dexie e Supabase
│   │   ├── hooks/         # Hooks de integração React (useLiveQuery)
│   │   ├── components/    # Componentes visuais do módulo
│   │   └── __tests__/     # Testes unitários e de integração (Vitest)
│   ├── catalogo/
│   ├── clientes/
│   └── financeiro/
├── shared/                # Layouts primitivos, UI tokens e utilitários de formatação
├── config/                # Injeção de dependências e configuração do tenant
└── db/                    # Instância e migrações do Dexie.js
```

---

## 6. Arquitetura Multi-Tenant e White-Label

Base de código única (*Single Codebase*) para comercialização do software a diferentes representantes ou assessorias sem necessidade de novos repositórios ou branches.

### 6.1. Segurança por Linha (Supabase RLS)

**Decisão (2026-11-05):** o acesso vem de uma tabela de membros, não de claim no JWT. Revogar um usuário vale na hora, e um usuário pode pertencer a mais de um tenant (suporte, assessoria). Dentro do tenant **tudo é compartilhado**: dois representantes da mesma empresa veem os mesmos clientes, pedidos e comissões (`pedidos.criado_por` é só informativo).

* `tenants` (`id`, `slug`, `nome_fantasia`, `ativo`): criada e alterada só pelo painel/serviço.
* `usuarios_tenant` (`user_id`, `tenant_id`, `papel`, `ativo`; PK `user_id + tenant_id`). Papéis: `admin` (faz tudo o que o representante faz, mais convidar e desativar membros) e `representante`. Nada é apagado: use `ativo = false`.
* As funções `tenant_ids_do_usuario()` e `tenant_ids_admin_do_usuario()` (`security definer`, `search_path` vazio) devolvem os tenants ativos do usuário autenticado. Um tenant `ativo = false` bloqueia todos os membros.
* As tabelas de negócio têm RLS ligado, sem política de `delete` (a exclusão é lógica) e sem acesso para `anon`:

```sql
create policy isolamento_select on public.pedidos
  for select to authenticated
  using (tenant_id in (select public.tenant_ids_do_usuario()));
-- insert (with check) e update (using + with check) seguem o mesmo critério.
```

* Chaves estrangeiras compostas `(tenant_id, id)` impedem apontar para registro de outro tenant, e um gatilho impede trocar o `tenant_id` de um registro.
* Migrações em `supabase/migrations/`; os testes (`src/db/__tests__/supabase-migracoes.test.ts`) aplicam todas num PostgreSQL real (PGlite) e rodam no `pnpm validate`.

### 6.2. Contrato de Configuração de Marca (`TenantConfig`)

```typescript
export interface TenantConfig {
  id: string;
  slug: string;
  empresa: {
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    ie?: string;
    email: string;
    telefone: string;
    whatsapp: string;
    enderecoCompleto: string;
  };
  visual: {
    logoUrl: string;
    faviconUrl: string;
    primaryColorHsl: string; // Ex: "142.1 76.2% 36.3%"
    accentColorHsl: string;
    borderRadius: string;
  };
  regrasNegocio: {
    permitirVendaSemEstoque: boolean;
    exigirValidacaoMinima: boolean;
  };
}
```

A identidade visual é aplicada em runtime via variáveis CSS no `:root` através do hook `useTenantTheme()`.

---

## 7. Fases de Implementação

```text
[Fase 1: MVP]               [Fase 2: Regras Comerciais]   [Fase 3: Financeiro]         [Fase 4: Inteligência]
Catálogo + Pedidos Offline  -> Motor de Descontos & Fretes -> Conciliação de Comissões -> Curva de Recompra & Rotas
```

### Fase 1: MVP - Emissão Rápida de Pedidos (Offline-First)

* Setup do projeto: Vite, React, TypeScript, Biome, Vitest, Dexie.js e Tailwind.
* Schemas Zod universais para Clientes, Produtos, Pedidos e Outbox.
* Catálogo rápido no IndexedDB com busca instantânea local por SKU ou descrição.
* Fechamento de pedido com cálculo estrito em centavos.
* Geração do espelho do pedido em PDF profissional via `@react-pdf/renderer`.
* Fila Outbox persistindo mutações e sincronizando via idempotency key ao detectar conexão.

### Fase 2: Motor de Políticas Comerciais Multirrepresentada

* Suporte a múltiplas tabelas de preço com regras de vigência e associação por cliente.
* Validações de pedido mínimo (valor em centavos ou volume) impedindo emissão inválida.
* Trava estrita de múltiplos de embalagem no input de quantidade.
* Controle de teto de desconto escalonado parametrizado por tabela e representada.
* Seleção de regras de frete (CIF/FOB).

### Fase 3: Funil de Faturamento e Conciliação Financeira

* Máquina de estados do pedido: `Emitido` -> `Faturado Parcial` -> `Faturado Total` -> `Liquidado`.
* Input e conciliação de faturas: registro do número da nota fiscal e divergências de corte de itens.
* Extrato de comissões previstas versus efetivamente depositadas.
* Projeção de fluxo de caixa futuro de comissões (30, 60, 90 dias).

### Fase 4: CRM B2B e Inteligência de Recompra

* Algoritmo de cálculo de ciclo médio de recompra por cliente, com flags de alerta preventivo.
* Ficha Raio-X pré-visita: histórico dos últimos pedidos, produtos nunca comprados e pendências financeiras.
* Curva ABC de clientes baseada em volume faturado acumulado.

---

## 8. Diretrizes de Execução para Agentes de IA (`AGENTS.md`)

Este bloco atua como as instruções operacionais para agentes de codificação trabalhando neste repositório.

### 8.1. Regras Operacionais Inegociáveis

1. **Tipagem e Linter:** Proibido o uso de `any` ou type-assertions cegas (`as Type` sem validação). Qualquer entrada externa deve ser validada via Zod. O código deve passar 100% pelo `pnpm biome check`.
2. **Dinheiro e Aritmética:** Nunca utilize tipos decimais para cálculo financeiro. Valores são sempre inteiros representando centavos. Cálculos de comissão e totais devem ser testados contra casos com dízimas periódicas e arredondamentos bancários (*half-even*).
3. **Isolamento de Infraestrutura:** Nunca importe `@supabase/supabase-js` ou `dexie` diretamente dentro da pasta `components/` ou `hooks/`. Sempre passe por interfaces em `repositories/`.
4. **Isolamento de Tenant:** Toda mutação local e remota deve injetar e validar o `tenant_id`.

### 8.2. Protocolo de Desenvolvimento em Fatias Verticais (Vertical Slice TDD)

Ao implementar uma nova funcionalidade, o agente deve seguir estritamente o pipeline:

1. **Contrato & Schemas:** Criar o schema Zod e derivar os tipos em `domain/`.
2. **Lógica Pura & Testes Unitários:** Escrever a função pura de negócio e os testes no Vitest cobrindo cenários nominais e casos de borda.
3. **Persistência Local (Dexie):** Implementar o repositório Dexie correspondente e validar com testes automatizados utilizando `fake-indexeddb`.
4. **Interface e Integração:** Desenvolver o componente React consumindo o hook do repositório, garantindo conformidade com o design token (variáveis HSL do tema).
5. **Autovalidação:** Executar no terminal:

   ```bash
   pnpm validate
   ```

   Se houver falha, ler o relatório de saída e corrigir o código antes de reportar a conclusão da tarefa. A versão vigente destas diretrizes está em `AGENTS.md`.
