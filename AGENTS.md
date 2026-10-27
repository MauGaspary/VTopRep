## Diretrizes de Execução para Agentes de IA (`AGENTS.md`)

Este bloco atua como as instruções operacionais para agentes de codificação trabalhando neste repositório.

### 1. Regras Operacionais Inegociáveis
1. **Tipagem e Linter:** Proibido o uso de `any` ou type-assertions cegas (`as Type` sem validação). Qualquer entrada externa deve ser validada via Zod. O código deve passar 100% pelo `pnpm biome check`.
2. **Dinheiro e Aritmética:** Nunca utilize tipos decimais para cálculo financeiro. Valores são sempre inteiros representando centavos. Cálculos de comissão e totais devem ser testados contra casos com dízimas periódicas e arredondamentos bancários (*half-even*).
3. **Isolamento de Infraestrutura:** Nunca importe `@supabase/supabase-js` ou `dexie` diretamente dentro da pasta `components/` ou `hooks/`. Sempre passe por interfaces em `repositories/`.
4. **Isolamento de Tenant:** Toda mutação local e remota deve injetar e validar o `tenant_id`.
5. **Reaproveitamento de Componentes de UI:** Antes de criar novos elementos visuais, verifique obrigatoriamente se já existem componentes correspondentes em `src/shared/components/ui/` (ex: `Button`, `Input`, `FormField`, `Badge`, `Alert`, `SearchInput`, `PageHeader`, `InactiveRecoveryCard`). Reutilize-os sempre que possível para manter consistência visual, evitar duplicação e otimizar tokens. Crie componentes atômicos compartilhados sempre que um padrão visual se repetir entre módulos.

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
