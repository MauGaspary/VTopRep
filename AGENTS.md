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
