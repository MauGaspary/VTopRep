## Diretrizes de Execução para Agentes de IA (`AGENTS.md`)

Este bloco atua como as instruções operacionais para agentes de codificação trabalhando neste repositório.

### 1. Regras Operacionais Inegociáveis

1. **Tipagem e Linter:** Proibido o uso de `any` ou type-assertions cegas (`as Type` sem validação). Qualquer entrada externa deve ser validada via Zod. O código deve passar 100% pelo `pnpm biome check`.
2. **Dinheiro e Aritmética:** Nunca utilize tipos decimais para cálculo financeiro. Valores são sempre inteiros representando centavos. Cálculos de comissão e totais devem ser testados contra casos com dízimas periódicas e arredondamentos bancários (*half-even*).
3. **Isolamento de Infraestrutura:** Nunca importe `@supabase/supabase-js`, `dexie` ou `dexie-react-hooks` diretamente dentro da pasta `components/` ou `hooks/`. Sempre passe por interfaces em `repositories/`.
   - Para consultas reativas, use `useLiveRepositoryQuery` (`src/shared/hooks/use-live-repository-query.ts`), o único ponto do app que importa `dexie-react-hooks`.
   - Exceção documentada: `src/shared/components/dev/DevSeedButton.tsx` importa o banco e o seed diretamente. Ele só é renderizado em desenvolvimento (`import.meta.env.DEV`) e não deve ser usado como modelo.
4. **Isolamento de Tenant:** Toda mutação local e remota deve injetar e validar o `tenant_id`.
5. **Reaproveitamento de Componentes de UI:** Antes de criar novos elementos visuais, verifique obrigatoriamente se já existem componentes correspondentes em `src/shared/components/ui/` (ex: `Button`, `Input`, `FormField`, `Badge`, `Alert`, `SearchInput`, `PageHeader`, `InactiveRecoveryCard`, `HomonymWarning`). Reutilize-os sempre que possível para manter consistência visual, evitar duplicação e otimizar tokens. Crie componentes atômicos compartilhados sempre que um padrão visual se repetir entre módulos.

### 2. Protocolo de Desenvolvimento em Fatias Verticais (Vertical Slice TDD)

Ao implementar uma nova funcionalidade, o agente deve seguir estritamente o pipeline:

1. **Contrato & Schemas:** Criar o schema Zod e derivar os tipos em `domain/`.
2. **Lógica Pura & Testes Unitários:** Escrever a função pura de negócio e os testes no Vitest cobrindo cenários nominais e casos de borda.
3. **Persistência Local (Dexie):** Implementar o repositório Dexie correspondente e validar com testes automatizados utilizando `fake-indexeddb`.
4. **Interface e Integração:** Desenvolver o componente React consumindo o hook do repositório, garantindo conformidade com o design token (variáveis HSL do tema).
5. **Autovalidação:** NENHUMA tarefa deve ser dada como concluída sem a execução prévia do comando de validação.
   Ao finalizar qualquer implementação ou refatoração, execute obrigatoriamente no terminal:
   `pnpm validate`
   Se o comando retornar código de saída diferente de 0 (erros de lint, tipagem do TypeScript ou testes quebrados), analise os logs do terminal, corrija o código autonomamente e repita a execução até que todos os checks passem com sucesso.
   Não declare a tarefa finalizada nem entregue a resposta final até que o comando retorne sucesso pleno.

### 3. Armadilhas Conhecidas (Lições do Projeto)

Problemas já encontrados neste repositório. Leia antes de mexer em persistência, listas grandes ou arquivos.

#### Dexie e IndexedDB

- **Prefira `toArray()` + filtro em JS a `.filter()` do Dexie.** O `.filter()` percorre um cursor registro a registro: no `fake-indexeddb` fica quadrático (5.000 produtos travaram um teste por mais de 60 s) e no navegador é bem mais lento que o `getAll`. Exemplos: `ProdutoDexieAdapter.consultar` e `ImportacaoDexieAdapter`.
- **O `fake-indexeddb` é quadrático ao sobrescrever registros existentes** (`put`/`bulkPut` sobre chaves que já existem). Testes de atualização em massa devem ficar em cerca de 1.000 registros; inserções de 5.000 rodam em cerca de 1,5 s. A medição de desempenho real é feita no navegador (TODO 2.9.5).
- **Outbox na mesma transação:** toda gravação sincronizável deve registrar a mutação com `criarMutacaoParaRegistro` dentro da mesma `db.transaction`, como fazem transportadoras, clientes, pedidos, representadas, produtos, preços, importação CSV e reajuste.
- **Dado só do aparelho** (preferências como o tema ou o mapeamento de colunas do CSV) não entra em `ENTIDADES_SINCRONIZAVEIS`.
- **Tabela nova no Dexie entra no backup** (`TabelasBackupSchema` e `BackupDexieAdapter`); o teste do adaptador falha se alguma tabela ficar de fora. Subir a versão do Dexie torna incompatíveis os backups da versão anterior (a restauração exige `versao_banco` igual); se a mudança for só de índice, avalie aceitar a versão anterior.

#### Supabase (migrações)

- As migrações ficam em `supabase/migrations/` e são testadas num PostgreSQL real (PGlite) por `src/db/__tests__/supabase-migracoes.test.ts`, dentro do `pnpm validate` (não precisa de Docker). Mudou schema Zod ou migração: o teste de colunas acusa a divergência.
- Tabela sincronizável nova: criar a migração (colunas, FKs compostas `(tenant_id, id)`, RLS e `sincronizado_em`, copiando o bloco `do $$` de `20261105120100_tabelas_de_negocio.sql`) e incluí-la no teste.
- Não edite migração já aplicada num projeto Supabase: crie uma nova.
- O pull usa `sincronizado_em` (servidor), nunca `updated_at` (aparelho), como checkpoint.

#### PWA

- O service worker só existe no build (`pnpm build && pnpm preview`); no `pnpm dev` não há precache nem aviso de versão nova.
- Telas com formulário longo devem chamar `useRegistrarEdicaoEmAndamento` enquanto houver alterações não salvas, para o aviso de versão nova não recarregar a página por cima.

#### Listas grandes e desempenho

- Listas de cadastro usam `ListaResponsiva` + `ListaCards` + `ListaTabela` (`src/shared/components/ui/ListaResponsiva.tsx`): cards quando a própria lista tem menos de 672 px, tabela acima disso, sem rolagem lateral. Colunas secundárias da tabela usam variantes de container (`@4xl:`, `@5xl:`), nunca `sm:`/`md:`; confira no Playwright que `scrollWidth` da tabela não passa do `clientWidth`.
- No app, a barra lateral só aparece a partir de `lg` (1024 px); abaixo disso valem a barra superior e a inferior do celular.
- Listas que podem ter milhares de itens usam `useListaIncremental` (`src/shared/hooks/`) com o componente `ShowMore` (100 por vez) e `useDeferredValue` no termo de busca. Renderizar 5.000 linhas levava cerca de 4 s para abrir o catálogo.
- Em ordenações grandes, use um `Intl.Collator` criado uma vez, e não `localeCompare(..., "pt-BR", opções)` dentro do `sort`, que cria um collator a cada comparação.

#### Arquivos e formatação (Windows)

- O repositório usa LF (`.gitattributes`). Scripts auxiliares que escrevem arquivos devem preservar LF; por exemplo, em Python use `open(caminho, "w", encoding="utf-8", newline="")`, porque o modo texto do Windows grava CRLF e o `biome check` falha.
- O formatador do Biome troca escapes como `"﻿"` pelo caractere invisível literal. Para caracteres invisíveis, use `String.fromCharCode(0xfeff)` (ver `BOM` em `src/shared/domain/csv.ts`).

#### Números vindos de texto

- Valores de planilha ou digitados viram centavos por análise de texto (`parseDecimalBrParaInteiro`, `parsePrecoCsv`), nunca por `Number(...)` / `parseFloat`. Mais de 2 casas decimais são arredondadas *half-even* e sinalizadas ao usuário.

#### Decisões de produto

- Decisões grandes ou difíceis de desfazer (modelo de dados, sincronização, regras comerciais) são perguntadas ao usuário antes de implementar, com as consequências reais de cada opção. Detalhes de implementação são decididos pelo agente e relatados no fim.
