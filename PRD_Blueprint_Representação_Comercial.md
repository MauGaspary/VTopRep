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
* **Imutabilidade de Pedidos Sincronizados:** Um pedido marcado como `emitido` ou superior torna-se somente-leitura. Ajustes pós-envio à fábrica exigem a emissão de aditivos ou novos pedidos vinculados.

---

### 2.2. Diagrama de Relacionamento (ERD)

```
Representada (1) ----< (N) TabelaPreco (1) ----< (N) ItemPreco >---- (1) Produto
     |                                                                   |
     | (1)                                                               | (1)
     v (N)                                                               v (N)
   Pedido (1) ------------------------< (N) ItemPedido >------------------+
     |
     +--- (N) >--- (1) Cliente
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
* `percentual_comissao_padrao: integer` (Base em centésimos de %, ex: 500 = 5,00%)
* `valor_pedido_minimo_centavos: integer`
* `regras_frete_padrao: text` (`'CIF' | 'FOB' | 'FOB_REDESPACHO'`)
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `clientes`
* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `cnpj_cpf: text`
* `razao_social: text`
* `nome_fantasia: text`
* `contato_comprador: text`
* `telefone_whatsapp: text`
* `endereco_completo: text`
* `latitude: double precision (nullable)`
* `longitude: double precision (nullable)`
* `frequencia_recompra_dias_estimada: integer` (Default: 30)
* `data_ultima_compra: date (nullable)`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `produtos`
* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `sku: text`
* `descricao: text`
* `unidade_medida: text` (Ex: `'UN'`, `'CX'`, `'KG'`)
* `multiplo_embalagem: integer` (Ex: 6 = só vende em múltiplos de 6)
* `ativo: boolean`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `tabelas_preco`
* `id: UUID` (PK)
* `tenant_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `nome_tabela: text`
* `vigencia_inicio: date`
* `vigencia_fim: date`
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
* `desconto_maximo_permitido: integer` (Centésimos de %, ex: 1500 = 15,00%)
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `pedidos`
* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `cliente_id: UUID` (FK)
* `representada_id: UUID` (FK)
* `tabela_id: UUID` (FK)
* `data_emissao: timestamptz`
* `condicao_pagamento: text`
* `tipo_frete: text` (`'CIF' | 'FOB'`)
* `status: text` (`'rascunho' | 'emitido' | 'parcialmente_faturado' | 'faturado_total' | 'cancelado'`)
* `valor_total_centavos: integer`
* `comissao_projetada_centavos: integer`
* `observacoes: text (nullable)`
* `idempotency_key: text` (UUIDv4 único gerado no momento da emissão)
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

#### `itens_pedido`
* `id: UUID` (PK gerada pelo cliente no Dexie via UUIDv4)
* `tenant_id: UUID` (FK)
* `pedido_id: UUID` (FK)
* `produto_id: UUID` (FK)
* `quantidade: integer` (Validada contra `multiplo_embalagem`)
* `preco_unitario_tabela_centavos: integer`
* `percentual_desconto: integer` (Centésimos de %)
* `preco_liquido_unitario_centavos: integer`
* `subtotal_centavos: integer`
* `created_at: timestamptz`
* `updated_at: timestamptz`
* `deleted_at: timestamptz (nullable)`

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
  tenantId: string;
  entity: 'pedidos' | 'clientes' | 'itens_pedido';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
  createdAt: string; // ISO-8601
}
```

### 3.2. Estratégia de Resolução de Conflitos
* **Entidades Transacionais Geradas em Campo (Pedidos, Itens, Clientes Novos):**
  * Política: **Client-Wins com Idempotency Key**.
  * Chave primária gerada no cliente (UUIDv4). O backend trata requisições repetidas via `idempotency_key` no PostgreSQL (`ON CONFLICT (idempotency_key) DO NOTHING`). O pedido cadastrado offline nunca é sobrescrito ou rejeitado pelo servidor, exceto por falha de validação estrutural de segurança.
* **Entidades Mestres da Fábrica (Produtos, Preços, Representadas):**
  * Política: **Server-Wins via Last-Write-Wins (LWW)**.
  * O backend é a fonte de autoridade. O cliente consome rotinas de *delta sync* consultando `updated_at > :ultimaSincronizacaoLocal`.
* **Tratamento de Exclusões:**
  * O servidor envia registros com `deleted_at != null`. O Dexie.js atualiza o registro local marcando o soft-delete para removê-lo das telas sem perder integridade referencial com pedidos antigos já persistidos.

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

```
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
  buscarPorId(id: string): Promise<Pedido null |>;
  listarPendentesSincronizacao(tenantId: string): Promise<Pedido[]>;
}
```

### 5.2. Arquitetura Vertical Slice
O código-fonte em `src/` é organizado por módulos funcionais orientados a negócio, não por tipo técnico de arquivo:

```
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
```sql
alter table public.pedidos enable row level security;

create policy "Isolamento estrito por tenant"
on public.pedidos
for all
using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

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

```
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
   pnpm biome check --write && pnpm type-check && pnpm test:run
   ```
   Se houver falha, ler o relatório de saída e corrigir o código antes de reportar a conclusão da tarefa.
