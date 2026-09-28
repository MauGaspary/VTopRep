# VinitopRS - Sistema de Representação Comercial

Um sistema robusto para gestão de representação comercial, construído com foco em resiliência offline, arquitetura limpa e testes automatizados.

## 🚀 Tecnologias

O projeto utiliza um stack moderno para garantir performance e manutenibilidade:

- **Core:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build & Dev:** [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Validação de Dados:** [Zod](https://zod.dev/)
- **Persistência Local (Offline-first):** [Dexie](https://dexie.org/) (IndexedDB wrapper)
- **Backend / DB Remoto:** [Supabase](https://supabase.com/)
- **Testes:** [Vitest](https://vitest.dev/) (com fake-indexeddb para persistência)
- **Lint & Code Formatter:** [Biome](https://biomejs.dev/)
- **Geração de PDF:** [@react-pdf/renderer](https://react-pdf.org/)
- **Gerenciador de Pacotes:** pnpm

## 🏗 Arquitetura e Padrões

O desenvolvimento segue o protocolo de **Fatias Verticais (Vertical Slice TDD)** e possui regras inegociáveis estipuladas no arquivo de diretrizes ([`AGENTS.md`](./AGENTS.md)):

1. **Camadas Isoladas:** Serviços de infraestrutura (Supabase/Dexie) nunca são importados diretamente dentro de componentes ou custom hooks de UI. A comunicação passa sempre por interfaces de `repositories/`.
2. **Design por Contratos:** Tudo inicia na pasta `domain/` com a criação de schemas do Zod, de onde derivamos os tipos TypeScript. O uso de `any` ou asserções cegas (`as Type`) sem validação é proibido.
3. **Cálculos Financeiros Seguros:** É proibido utilizar valores decimais (pontos flutuantes) para cálculos monetários. Valores são armazenados e transacionados **sempre como inteiros (centavos)**, suportando arredondamento bancário (*half-even*).
4. **Isolamento de Tenant (Multi-tenant):** Toda mutação, local ou remota, garante a injeção e a validação rigorosa de um `tenant_id`.

## 📦 Como Rodar o Projeto

**Pré-requisitos:** Certifique-se de ter o [Node.js](https://nodejs.org/) (versão mais recente LTS) e o [pnpm](https://pnpm.io/) instalados.

### 1. Instalação das dependências

```bash
pnpm install
```

### 2. Rodando o servidor de desenvolvimento

Para iniciar a aplicação localmente com o HMR do Vite:

```bash
pnpm dev
```

### 3. Rodando os Testes (Vitest)

Executa a suíte de testes (com suporte ao Dexie em memória via fake-indexeddb):

```bash
pnpm test:run
```

*(Para modo watch no dia a dia do TDD, use o comando original do vitest ou adicione um script para `vitest`)*.

### 4. Code Quality (Lint e Tipagem)

Para garantir que o código segue as diretrizes estabelecidas e a tipagem está segura:

```bash
# Verifica lint e regras de formatação sem alterar os arquivos
pnpm lint

# Verifica a integridade de todos os tipos do TypeScript no projeto
pnpm type-check

# Aplica correções automáticas seguras usando o Biome
pnpm biome check --write
```

### 5. Build de Produção

Cria a versão de build minificada e pronta para deploy, executando validação de tipos antes da compilação final:

```bash
pnpm build
```

### 6. Pipeline Completo (Autovalidação)

Se você é um contribuidor (ou IA), antes de dar commit na sua feature, sempre rode a validação completa do repositório garantindo que nenhum contrato foi quebrado:

```bash
pnpm biome check --write && pnpm type-check && pnpm test:run
```
