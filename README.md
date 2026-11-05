# VTop Rep - Sistema de Representação Comercial

Um sistema robusto para gestão de representação comercial, construído com foco em resiliência offline, arquitetura limpa e testes automatizados. Funciona como app instalável (PWA): depois do primeiro acesso, abre e trabalha sem internet.

## 🚀 Tecnologias

O projeto utiliza um stack moderno para garantir performance e manutenibilidade:

- **Core:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build & Dev:** [Vite](https://vitejs.dev/)
- **App Instalável (PWA):** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker com Workbox)
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

> **Windows / outra máquina:** o repositório usa quebras de linha LF (`.gitattributes` e `biome.json`). Se o `pnpm lint` acusar erros de formatação logo após o clone ou o pull, confira com `git ls-files --eol` e renormalize com `git add --renormalize .`.

### 2. Rodando o servidor de desenvolvimento

Para iniciar a aplicação localmente com o HMR do Vite:

```bash
pnpm dev
```

> No modo de desenvolvimento não há service worker: o app não funciona offline nem pode ser instalado. Para isso, use o build de produção (seção [Instalar o App](#-instalar-o-app-pwa)).

### 3. Rodando os Testes (Vitest)

Executa a suíte de testes (com suporte ao Dexie em memória via fake-indexeddb):

```bash
# Execução única (usada no pipeline de validação)
pnpm test:run

# Modo watch, para o dia a dia do TDD
pnpm test
```

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

Cria a versão de build minificada e pronta para deploy (pasta `dist`, já com o service worker e o manifesto do app), executando validação de tipos antes da compilação final:

```bash
pnpm build

# Serve o build localmente em http://localhost:4173
pnpm preview
```

### 6. Pipeline Completo (Autovalidação)

Se você é um contribuidor (ou IA), antes de dar commit na sua feature, sempre rode a validação completa do repositório garantindo que nenhum contrato foi quebrado:

```bash
pnpm validate
```

O comando roda `biome check`, `tsc -b` e `vitest run`, nessa ordem, e falha no primeiro erro. Para corrigir automaticamente o que o Biome souber resolver (formatação, ordem de imports), rode `pnpm biome check --write` antes.

## 📲 Instalar o App (PWA)

### Requisitos

O navegador só oferece a instalação quando as duas condições abaixo são atendidas:

| Requisito | Por quê |
|---|---|
| **Build de produção** (`pnpm build`) | O service worker e o manifesto só existem no build. No `pnpm dev` não há instalação. |
| **Endereço HTTPS ou `localhost`** | Sem conexão segura, o navegador não registra o service worker: não instala e não funciona offline. Um IP de rede (`http://192.168...`) **não** serve. |

O primeiro acesso precisa de internet, porque é nele que o app é baixado para o aparelho. Depois disso, ele abre em modo avião.

### Onde abrir o app

| Situação | Como fazer |
|---|---|
| **No computador de desenvolvimento** | `pnpm build` e `pnpm preview`, depois abrir `http://localhost:4173`. |
| **Celular Android ligado por cabo USB** (teste) | Rodar `pnpm preview --host 127.0.0.1`, abrir `chrome://inspect` no Chrome do computador, ativar *Port forwarding* de `4173` para `127.0.0.1:4173` e abrir `localhost:4173` no Chrome do celular. Sem o `--host`, o servidor pode ouvir só em IPv6 (`::1`) e o celular recebe "conexão recusada". |
| **Qualquer aparelho, teste rápido** | Criar um túnel HTTPS para o `pnpm preview`, por exemplo `cloudflared tunnel --url http://localhost:4173`, e abrir o endereço gerado. |
| **Uso real pelos representantes** | Publicar a pasta `dist` numa hospedagem com HTTPS. Ainda não configurado: veja [`BACKLOG.md`](./BACKLOG.md) seção 2. |

### Como instalar em cada navegador

| Aparelho | Navegador | Passos |
|---|---|---|
| Computador (Windows, macOS, Linux) | Chrome ou Edge | Clicar no ícone de instalar na barra de endereço (monitor com seta) ou no menu **⋮ → Instalar Vinitop RS**. O app abre numa janela própria e ganha atalho no menu Iniciar. |
| Android | Chrome | Menu **⋮ → Instalar app** (ou **Adicionar à tela inicial**). |
| iPhone / iPad | Safari | Botão **Compartilhar → Adicionar à Tela de Início**. Só funciona pelo Safari, e não aparece convite automático para instalar. |
| Computador | Firefox | Não instala o app. Use Chrome ou Edge. |

### Cuidados importantes

- **Cada endereço tem dados separados.** O que foi cadastrado em `localhost:5173` (dev) não aparece em `localhost:4173` nem no endereço publicado. Para levar os dados, use **Dados e backup → Baixar backup** num endereço e **Restaurar backup** no outro.
- **O app instalado começa vazio.** O botão de dados de teste só existe no `pnpm dev`. Para ter dados no app instalado, faça um backup no dev e restaure no app.
- **Atualizações:** cada nova versão publicada aparece dentro do app como **Nova versão disponível**. O botão fica bloqueado enquanto houver um orçamento com alterações não salvas.
- **Proteção dos dados:** depois de instalado, o Chrome costuma proteger os dados contra a limpeza automática. Confira o selo **Protegido** na tela **Dados e backup**. Enquanto não houver sincronização com o servidor, faça backups com frequência; o app lembra a cada 7 dias.

### Ícones do app

Os ícones são gerados a partir de `public/favicon.svg` (iniciais do tenant na cor primária). Depois de editar o SVG, regenere os PNGs com:

```bash
pnpm icones
```
