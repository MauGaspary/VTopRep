# Hospedagem e Sincronização: Comparação e Decisões

Levantamento de 2026-11-04 para o `TODO.md` 2.11 (Backend Supabase e Sincronização) e o `BACKLOG.md` 2 (Hospedagem e Publicação do App). **Nada foi implementado.** Os preços e limites foram conferidos nos sites oficiais nessa data (seção 6) e mudam com frequência: confira de novo antes de contratar.

Critérios: barato, fácil de manter e sem limites que atrapalhem o uso real.

---

## Resumo

- **App:** Cloudflare Pages (grátis, sem limite de visitas, uso comercial permitido).
- **Endereço:** domínio próprio (`.com.br` a R$ 40/ano, ou subdomínio de um domínio que a Vinitop já tenha).
- **Servidor:** Supabase na região São Paulo, como o PRD já prevê. Começar no plano Free com as proteções da seção 2.5 e passar ao Pro (~R$ 135/mês) quando entrar uma segunda empresa ou o banco passar de ~300 MB.
- **Ordem:** publicar o app (BACKLOG 2) antes do 2.11.

No servidor, nenhuma opção é ao mesmo tempo grátis, sem manutenção e sem limite. A escolha é entre pagar o Supabase Pro ou configurar uma vez backup e ping no Free.

---

## Decisões pendentes

### Decisão 1: Endereço definitivo do app

Os dados do aparelho (IndexedDB) ficam presos ao endereço em que o app foi aberto. Trocar de endereço depois faz o app abrir vazio no endereço novo (seção 3).

| Opção | Custo | Consequência |
|---|---|---|
| Subdomínio de um domínio que a Vinitop já tem (ex.: `app.vinitop.com.br`) | R$ 0 a mais | Basta um registro CNAME no DNS atual |
| Domínio novo `.com.br` | R$ 40/ano | Da Vinitop, ou do produto com um subdomínio por empresa, se o app for vendido a outros representantes |
| Endereço grátis da Cloudflare (`nome.pages.dev`) | R$ 0 | Muda se trocarmos de serviço, até dentro da Cloudflare (Pages → Workers) |

- **Perguntas:** a Vinitop já tem domínio? O app vai ser vendido a outros representantes?
- **Recomendação:** domínio próprio (uma das duas primeiras opções).
- **Resposta (2026-11-04):** hospedagem na Cloudflare Pages.
  - **Padrão: Modelo B, domínio do produto.** Você registra um domínio (ex.: `vtop.com.br`) e cria um subdomínio por cliente (`vinitop.vtop.com.br`, `outraempresa.vtop.com.br`). O cliente não precisa fazer nada.
  - **Opcional: Modelo A, domínio do cliente.** Quem quiser usa o próprio domínio (`vtop.outraempresa.com`), com um registro CNAME no DNS dele (seção 3.1).
  - Os dois convivem no mesmo projeto.
  - **Falta:** escolher e registrar o domínio do produto antes da primeira instalação real (não bloqueia o 2.11) e definir o subdomínio da Vinitop. Depois da primeira instalação, o endereço de um cliente não deve mudar.

### Decisão 2: Servidor da sincronização

| Opção | Custo | Consequência |
|---|---|---|
| Supabase Free com proteções, depois Pro | R$ 0 no início | Pausa após 7 dias de pouco uso se o ping falhar; o backup fica por nossa conta (seção 2.5) |
| Supabase Pro desde o início | ~R$ 135/mês | Sem pausa; backup diário feito pelo Supabase |
| Dexie Cloud | R$ 0 até 3 usuários; ~R$ 20/mês até 25 | Menos código, mas "pedido emitido não muda" passa a valer só dentro do app, não no servidor; fornecedor pequeno |
| Outras (Neon, PocketBase, Cloudflare D1) | Ver seção 2.2 | Ver seção 2.2 |

- **Pergunta complementar:** quantas pessoas devem usar o app nos próximos 12 meses?
- **Recomendação:** Supabase Free com proteções; Pro quando entrar a segunda empresa ou o banco passar de ~300 MB.
- **Resposta (2026-11-04):** Supabase Free, com as proteções da seção 2.5.

### Decisão 3: Publicar o app antes do 2.11

A pergunta é se o app vai para a internet agora, antes de existir a sincronização, ou só quando a sincronização estiver pronta. Publicar agora significa que os representantes já podem instalar e usar, mas os dados ficam só no aparelho de cada um até o 2.11.

| Opção | Consequência |
|---|---|
| Publicar antes | Os representantes instalam já e o teste da 2.10.1 é destravado. O 2.11 vai precisar de uma carga inicial, e até lá o ideal é cadastrar fábricas, produtos e clientes num aparelho só (seção 5) |
| Esperar o 2.11 | Ninguém instala o app até o 2.11 ficar pronto, e o teste no Android continua pendente |

- **Recomendação:** publicar antes.
- **Resposta (2026-11-04):** esperar. O primeiro cliente é da família e não há pressa; a prioridade é deixar o app robusto (inclusive o 2.11) antes de publicar. Assim os dados reais já nascem sincronizados e a carga inicial da seção 5 deixa de ser necessária. O teste no Android da 2.10.1 pode ser feito antes por um túnel temporário (`cloudflared tunnel`, ver `README.md`), só com dados de teste.

---

## 1. Hospedagem do App (BACKLOG 2)

O app é estático: a pasta `dist` tem 2,3 MB em 21 arquivos (o maior, o JavaScript principal, tem ~2 MB). Qualquer serviço aguenta esse tráfego. O que muda entre eles são as regras de uso e o que acontece quando um limite estoura.

### 1.1. Comparação

| Serviço | Custo | Contra | A favor |
|---|---|---|---|
| **Cloudflare Pages** (recomendado) | R$ 0 | 500 builds/mês (o limite é de publicações, não de visitas) | Tráfego dos arquivos ilimitado; uso comercial permitido; `_headers` para o cache do `sw.js`; rota de SPA automática; prévia por branch; HTTPS no domínio próprio |
| Netlify Free | R$ 0 | 300 créditos/mês com corte rígido: cada publicação na `main` gasta 15 (20 publicações esgotam o mês) e cada GB de tráfego gasta 20. Se esgotar, **todos os sites saem do ar** ("Site not available") até o mês seguinte, sem opção de comprar créditos | Simples; prévias de branch não gastam crédito. Personal: US$ 9 (~R$ 48)/mês |
| Vercel Hobby | R$ 0 | **Proíbe uso comercial**, inclusive quando alguém é pago para escrever o código | Pro: US$ 20 (~R$ 108)/mês por desenvolvedor |
| GitHub Pages | R$ 0 | Os termos proíbem uso como SaaS de empresa; não aceita cabeçalhos próprios nem regra de SPA | — |
| Firebase Hosting (Spark) | R$ 0 | 360 MB/dia de tráfego (cerca de 150 instalações completas por dia) | Cabeçalhos e regra de SPA configuráveis, mas sem vantagem sobre a Cloudflare |

### 1.2. Observações

- **Hospedagem fora do ar:** o app já instalado continua abrindo pelo service worker. Param a instalação em aparelho novo e o recebimento de atualizações.
- **Publicação só depois da validação (BACKLOG 2.3):** na integração da Cloudflare com o GitHub, o comando de build fica `pnpm validate && pnpm build`. Se a validação falhar, nada é publicado, e nenhuma chave da Cloudflare precisa ficar guardada no GitHub.
- **Rotas do SPA (BACKLOG 2.2):** quando o build não tem `404.html`, a Cloudflare Pages devolve o `index.html` para qualquer rota, então o `_redirects` não é necessário.
- **Cabeçalhos (BACKLOG 2.2):** um arquivo `public/_headers` cobre o `no-cache` de `sw.js`, `index.html` e `manifest.webmanifest`, o cache longo de `/assets/*` e os cabeçalhos de segurança. Quando o Supabase entrar, a `Content-Security-Policy` precisa liberar o domínio do projeto.
- **Prévias:** cada branch ganha um endereço próprio. Endereço diferente = dados diferentes; usar só para teste.
- **Variáveis do Supabase:** a URL e a chave pública ficam nas variáveis do projeto na Cloudflare, nunca no repositório.

---

## 2. Servidor da Sincronização (TODO 2.11)

### 2.1. Volume Esperado (Estimativa)

Estimativa minha, não medição; confirmar com dados reais. Considerei de 300 a 400 bytes por linha no PostgreSQL, contando os índices.

| Cenário | Crescimento do banco |
|---|---|
| Pequeno: 1 a 2 representantes, catálogos pequenos | ~20 MB/ano |
| Grande: 5 representantes, 10 fábricas com 5 mil itens cada, 4 reajustes por ano e ~10 pedidos de 20 itens por representante por dia útil | ~160 MB/ano |

- O que mais pesa são as **tabelas de preço novas**: cada reajuste ou importação como nova tabela copia todos os preços da fábrica (no cenário grande, ~65 MB/ano). Depois vêm os **itens de pedido** (~70 MB/ano no cenário grande).
- **Primeira sincronização de um aparelho novo:** é o que mais gasta tráfego. No cenário grande, de algumas dezenas a ~100 MB sem compressão, se descerem todas as tabelas e todo o histórico. Uma ideia para o 2.11.4: não baixar tabelas encerradas para aparelho novo, já que os pedidos guardam o preço no item.

### 2.2. Comparação

| Opção | Custo/mês | A favor | Contra |
|---|---|---|---|
| **Supabase Free**, região São Paulo (recomendado para começar) | R$ 0 | Segue o plano atual do 2.11; 500 MB duram anos para uma empresa; 5 GB de tráfego por mês | **Pausa após 7 dias de pouco uso** (avisa por e-mail antes; reativa pelo painel). **Sem backup automático.** O e-mail embutido só envia para a equipe do projeto, 2 por hora. Logs de 1 dia; suporte só pela comunidade |
| **Supabase Pro** | US$ 25 (~R$ 135) | Sem pausa; backup diário guardado por 7 dias; 8 GB; 250 GB de tráfego; teto de gasto ligado por padrão; suporte por e-mail. Sobe a partir do Free no mesmo projeto, sem migrar | Preço |
| Neon Free (PostgreSQL) | R$ 0 | Não precisa ser reativado à mão (desliga após 5 min parado e religa sozinho na próxima consulta); 1 GB; login e API HTTP inclusos; o SQL do 2.11 seria o mesmo | Login (Better Auth) e API HTTP mais novos e com pouca documentação; só 6 h de histórico para restaurar; troca o cliente e o login do app |
| Dexie Cloud | R$ 0 até 3 usuários; €3 por 25 usuários (~R$ 20) | Sincronização e login prontos: os itens 2.11.3 e 2.11.4 deixam de existir; quase nenhuma manutenção | Joga fora a Outbox e as regras de conflito do PRD 3.2. Não roda regra no servidor, então "pedido emitido não muda" passa a valer só dentro do app (o TODO 2.11 exige isso no servidor, como pré-requisito da Fase 3). Fornecedor pequeno; não achei em que país ficam os servidores. Os 100 MB do Free não comportam um catálogo grande |
| PocketBase em VPS | ~€4 a €6 (~R$ 25 a R$ 40) | Sem pausa nem cota; login, painel e backup embutidos; servidor leve (um único programa com SQLite) | Você administra o servidor (atualizações, disco, monitoramento); versão 0.41, sem compatibilidade garantida antes da 1.0; a API de sincronização e as regras ficam por nossa conta |
| Cloudflare Workers + D1 | R$ 0 ou US$ 5 (~R$ 27) | Mesmo fornecedor do app; barato em qualquer escala | No grátis, 100 mil linhas gravadas por dia, e cada índice conta como mais uma linha: um reajuste grande passa disso, e o banco recusa consultas até a meia-noite UTC. Sem login de app; a API seria toda escrita por nós |

### 2.3. Descartadas

- **Supabase em servidor próprio:** uma dezena de serviços em Docker (banco, login, API, painel etc.) para atualizar, proteger e fazer backup. Contraria o "fácil de manter".
- **Firebase / Firestore:** exigiria reescrever o banco para NoSQL. O plano grátis libera 50 mil leituras e 20 mil gravações por dia; um aparelho novo baixando um catálogo grande, ou uma importação de CSV grande, passa disso.
- **PowerSync / ElectricSQL:** o PowerSync troca o Dexie por SQLite no navegador; o ElectricSQL soma mais um serviço e não cuida do envio. Muito retrabalho sobre o que já está pronto.

### 2.4. Por Que Supabase

- **Aproveita o que já existe:** a Outbox (`src/modules/sync/`), as regras de conflito do PRD 3.2 já testadas, o `supabase/config.toml` e o Docker já instalado para o `supabase start`.
- **PostgreSQL de verdade:** imutabilidade dos pedidos por trigger e isolamento por tenant com RLS no servidor, SQL para relatórios e integrações futuras, e saída fácil com `pg_dump`.
- **Dados em São Paulo:** menos latência a partir do RS e LGPD mais simples, já que há CPF de clientes pessoa física.
- **Começa grátis** e sobe de plano no mesmo projeto, sem migrar.

### 2.5. Supabase Free com Proteções

Para o plano grátis ser seguro, configurar uma vez:

- **Backup diário criptografado** num bucket grátis (Cloudflare R2 ou Backblaze B2, 10 GB). Nunca como artefato do GitHub Actions: o repositório `MauGaspary/VTopRep` é público, e qualquer pessoa logada no GitHub baixa os artefatos e lê os logs.
- **Ping diário** para o projeto não pausar quando ninguém usa, como nas férias coletivas de fim de ano.
- **Onde agendar (detalhe para a implementação):** o GitHub Actions roda o `pg_dump` sem custo num repositório público, mas desliga agendamentos depois de 60 dias sem atividade no repositório. O Cron da Cloudflare não tem essa regra, mas não roda `pg_dump`; ali o backup seria uma exportação das tabelas em JSON.
- **Login:** como o e-mail embutido só envia para a equipe do projeto, ou os usuários são criados no painel (sem e-mail automático; senha esquecida é redefinida por você), ou ligamos o Resend (grátis até 100 e-mails por dia e 3 mil por mês), que precisa do domínio.
- **Lembrete de backup local:** mantê-lo ligado nas primeiras semanas de sincronização. Hoje `SINCRONIZACAO_REMOTA_ATIVA` o desliga (`deveLembrarBackup`, em `src/modules/backup/domain/lembrete-backup.ts`). É o período em que um erro de sincronização poderia se espalhar para todos os aparelhos.

**Com o servidor pausado:** o app continua funcionando offline e a Outbox acumula as mudanças. Param a troca de dados entre aparelhos e o login em aparelho novo; quem já está logado continua trabalhando.

**Quando passar ao Pro:** quando entrar uma segunda empresa, quando o banco passar de ~300 MB, ou se o backup ou o ping falharem com gente usando.

---

## 3. Domínio (BACKLOG 2.1)

- Os dados do aparelho ficam presos ao endereço (origem) em que o app foi aberto. Um domínio próprio continua o mesmo se trocarmos de serviço de hospedagem.
- Um `.com.br` custa R$ 40/ano no Registro.br (Pix, cartão ou boleto).
- O endereço grátis (`nome.pages.dev`) muda até numa migração dentro da própria Cloudflare (Pages → Workers, que usa `*.workers.dev`). Cada aparelho abriria vazio no endereço novo até sincronizar ou restaurar o backup. Depois do 2.11, o que já estiver no servidor volta pela sincronização, mas o que estiver só na Outbox do endereço antigo fica preso lá.
- O domínio também permite enviar e-mails de login com o nome da empresa (Resend).
- **Um endereço para todos ou um por empresa** (BACKLOG 2.1 e 1.8) pode esperar: o projeto da Cloudflare aceita até 100 domínios, desde que o endereço da Vinitop seja definitivo desde a primeira instalação.
- Se o domínio já existe e outra empresa cuida do DNS, basta um registro CNAME para o subdomínio do app.

### 3.1. Endereço de Cada Cliente (Decisão 1)

**Padrão (Modelo B):** `<cliente>.<domínio-do-produto>` (ex.: `vinitop.vtop.com.br`).

- **Custo:** um domínio só (R$ 40/ano se for `.com.br`); subdomínios não custam nada.
- **Quem configura:** você, no DNS do seu domínio (de preferência na própria Cloudflare). Um cliente novo ganha endereço em minutos, sem depender dele.
- **E-mails de login:** saem todos do domínio do produto (o Resend grátis aceita 3 domínios, e aqui basta um).
- **Limite:** cada subdomínio conta como um domínio no projeto da Cloudflare Pages, que aceita até 100. Acima disso, o Workers atende todos os subdomínios com uma regra só, porque o domínio é seu.

**Opcional (Modelo A):** `vtop.<domínio-do-cliente>` (ex.: `vtop.outraempresa.com`).

- **O cliente precisa ter domínio e mexer no DNS dele:** um registro CNAME de `vtop` apontando para o projeto na Cloudflare, que ativa o HTTPS sozinha depois disso. Conta no mesmo limite de 100 domínios.
- **O endereço fica nas mãos do cliente:** se ele perder o domínio ou apagar o registro, o app sai do ar para aquela empresa, e um endereço novo abre vazio. Depois do 2.11, os dados voltam pela sincronização, menos o que estiver só na Outbox do endereço antigo.
- **E-mails de login:** continuam saindo do domínio do produto.

**Nos dois modelos:**

- **Marca por endereço:** como cada empresa tem um endereço, o app pode escolher nome, cor e ícones pelo endereço antes do login, com um único build (BACKLOG 1.8), em vez de um build por cliente.
- **Endereço definitivo:** escolher o endereço de cada cliente antes da primeira instalação dele. Trocar depois exige reinstalar o app.

---

## 4. Custo Total

| Cenário | Custo |
|---|---|
| Recomendado para começar: Cloudflare Pages + domínio + Supabase Free + Resend Free | **R$ 40/ano** |
| Sem limites práticos: o mesmo com Supabase Pro | ~R$ 135/mês + R$ 40/ano (~R$ 1.660/ano) |

Conversões: dólar a ~R$ 5,20 (cotação de set–out/2026; não achei a de novembro), euro a ~R$ 6,10 (aproximado), mais 3,5% de IOF em compras internacionais no cartão. O banco do cartão ainda pode cobrar spread sobre a cotação.

---

## 5. Publicar o App Antes do 2.11

Recomendado: o BACKLOG 2 é pouco trabalho, não depende do servidor e destrava o Teste Manual da 2.10.1 (instalar no Android e no desktop e gerar o PDF em modo avião). Consequências para o 2.11:

- **Carga inicial:** os cadastros manuais de produtos, preços, tabelas e representadas ainda não registram nada na Outbox (TODO 2.11.3). O que for cadastrado antes do 2.11 precisa ir ao servidor numa primeira carga, antes dos pedidos que dependem desses cadastros.
- **Cadastros duplicados:** se a mesma fábrica, produto ou cliente for cadastrado em dois aparelhos, a primeira sincronização vai acusar duplicidade de CNPJ, SKU ou CPF/CNPJ (unicidade por tenant, PRD 2.1). Até lá, o ideal é cadastrar num aparelho só e levar aos outros por backup (**Dados e backup**).
- **Backups:** o lembrete de 7 dias continua valendo enquanto a sincronização não estiver ligada.

---

## 6. Números Conferidos em 2026-11-04

**Supabase**
- Free: US$ 0; 500 MB de banco; 5 GB de tráfego + 5 GB em cache; 1 GB de arquivos; 50 mil usuários ativos/mês; 2 projetos ativos; CPU compartilhada com 500 MB de RAM; logs de 1 dia; suporte da comunidade.
- Pausa do Free: após 7 dias de pouca atividade no banco ("algumas requisições por dia" bastam para evitar). Dois e-mails: um aviso antes e uma confirmação. Os dados ficam guardados e a reativação é pelo painel (a documentação fala em até 1 ano, mas uma versão da página diz 90 dias).
- Backup no Free: não há automático; a documentação recomenda `supabase db dump` ou `pg_dump` guardados fora do Supabase.
- Pro: a partir de US$ 25/mês; 8 GB de disco por projeto (depois US$ 0,125/GB); 250 GB de tráfego + 250 GB em cache; 100 GB de arquivos; 100 mil usuários ativos/mês; US$ 10 de crédito de computação (cobre uma instância Micro); backup diário por 7 dias (PITR é adicional de US$ 100/mês); teto de gasto ligado por padrão; logs de 7 dias; suporte por e-mail.
- Team: a partir de US$ 599/mês.
- E-mail embutido: só para endereços da equipe da organização, 2 mensagens por hora; a documentação recomenda SMTP próprio em produção (cita Resend, AWS SES, Postmark, SendGrid, ZeptoMail e Brevo).

**Cloudflare**
- Pages Free: 500 builds/mês; 1 build por vez; 20 min por build; 20 mil arquivos; 25 MiB por arquivo; 100 domínios por projeto; 100 regras em `_headers`; 2.100 redirecionamentos.
- Arquivos estáticos (Pages e Workers): requisições grátis e ilimitadas.
- Workers Free: 100 mil requisições/dia; 10 ms de CPU por requisição. Workers Paid: mínimo de US$ 5/mês, com 10 milhões de requisições inclusas.
- D1 Free: 5 milhões de linhas lidas/dia; 100 mil gravadas/dia; 5 GB. Gravar numa coluna indexada conta uma linha a mais. Passado o limite, as consultas falham até 00:00 UTC. D1 Paid: 25 bilhões de linhas lidas e 50 milhões gravadas por mês inclusas.
- Migração Pages → Workers: `_headers` e `_redirects` funcionam nos dois; no Workers, a regra de SPA é configurada à mão. A Cloudflare não declara o Pages como descontinuado.

**Netlify**
- Free: 300 créditos/mês, limite rígido, sem compra de créditos. Publicação em produção: 15 créditos; tráfego: 20 créditos/GB; requisições: 2 créditos a cada 10 mil; computação: 10 créditos/GB-hora. Prévias de deploy e de branch não gastam. Ao esgotar, todos os projetos ficam pausados até o próximo ciclo.
- Personal: US$ 9/mês (1.000 créditos). Pro: US$ 20/mês (3.000 créditos).

**Vercel**
- Hobby: só uso pessoal e não comercial, inclusive quando há "a paid employee or consultant writing the code"; 100 GB de tráfego; não permite comprar uso adicional.
- Pro: US$ 20/mês por desenvolvedor.

**Neon**
- Free: US$ 0; 1 GB por projeto (20 GB na conta); 100 CU-hora por projeto; desliga após 5 min parado; 6 h de histórico; 5 GB de tráfego por projeto; login (Better Auth) até 60 mil usuários/mês; Data API inclusa.
- Launch: cobrança por uso (US$ 0,106 por CU-hora e US$ 0,35 por GB-mês; a Neon estima ~US$ 15/mês para um banco pequeno).

**Dexie Cloud**
- Free: €0; 3 usuários de produção; 100 MB; 10 conexões simultâneas. A página tem números conflitantes para quantidade de bancos e limite de requisições.
- Pro: €0,12 por usuário/mês (pacote de 25 por €3/mês); 1 GB de armazenamento de objetos para 25 usuários.
- Business (servidor próprio): €3.495, pagamento único, com 5 anos de atualizações.

**PocketBase:** v0.41.1; o README avisa que a compatibilidade não é garantida antes da v1.0.0.

**Hetzner CX23 (VPS para o PocketBase):** 2 vCPU e 4 GB de RAM; entre €3,99 e €5,99/mês conforme a fonte (a Hetzner mudou preços em 2026), mais o IPv4.

**Firebase (Spark):** Firestore com 50 mil leituras, 20 mil gravações e 20 mil exclusões por dia e 1 GiB armazenado; Hosting com 10 GB armazenados e 360 MB/dia de tráfego.

**Resend:** Free com 3 mil e-mails/mês, 100 por dia e 3 domínios; Pro a US$ 20/mês (50 mil e-mails).

**Registro.br:** `.com.br` a R$ 40 por 1 ano (R$ 76 por 2 anos, R$ 364 por 10 anos).

**GitHub (repositório público):** Actions sem custo; artefatos baixáveis por qualquer pessoa logada; agendamentos desligados após 60 dias sem atividade no repositório.

**Câmbio e impostos:** dólar a ~R$ 5,20 (set–out/2026); IOF de 3,5% em compras internacionais com cartão desde 2025.

---

## 7. Fontes

- Supabase: [preços](https://supabase.com/pricing), [pausa do Free](https://supabase.com/docs/guides/platform/free-project-pausing), [backups](https://supabase.com/docs/guides/platform/backups), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- Cloudflare: [limites do Pages](https://developers.cloudflare.com/pages/platform/limits/), [preços do Workers](https://developers.cloudflare.com/workers/platform/pricing/), [arquivos estáticos no Workers](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [preços do D1](https://developers.cloudflare.com/d1/platform/pricing/), [migração Pages → Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- Netlify: [preços](https://www.netlify.com/pricing/), [créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [projetos pausados](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/)
- Vercel: [uso comercial](https://vercel.com/docs/limits/fair-use-guidelines), [preços](https://vercel.com/pricing)
- [Neon: preços](https://neon.com/pricing), [Neon: Data API](https://neon.com/docs/data-api/get-started)
- [Dexie Cloud: preços](https://dexie.org/cloud/pricing), [Dexie Cloud: consistência](https://dexie.org/cloud/docs/consistency)
- [PocketBase](https://github.com/pocketbase/pocketbase), [Hetzner CX23](https://www.vpsbenchmarks.com/hosters/hetzner/plans/cx23)
- [Firebase: preços](https://firebase.google.com/pricing)
- [Resend: preços](https://resend.com/pricing), [Registro.br: valores](https://registro.br/ajuda/pagamento-de-dominio/)
- GitHub: [download de artefatos](https://docs.github.com/en/actions/managing-workflow-runs/downloading-workflow-artifacts), [agendamentos desativados](https://docs.github.com/en/actions/using-workflows/disabling-and-enabling-a-workflow)
- [Dólar (set/2026)](https://renovainvest.com.br/dolar-hoje/), [IOF de 3,5%](https://investnews.com.br/economia/fechou-o-cerco-iof-vai-a-35-para-cambio-com-cartoes-de-credito-debito-e-pre-pagos-internacionais/amp/)
