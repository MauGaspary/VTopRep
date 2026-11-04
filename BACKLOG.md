# Backlog de Funcionalidades Futuras

Este documento reúne regras de negócio, travas comerciais e módulos postergados para versões futuras, mantendo o foco atual na **agilidade do representante em campo na elaboração de orçamentos e pedidos**.

---

## 1. Políticas Comerciais e Travas de Bloqueio (Postergadas)

### 1.1. Teto de Desconto Escalonado (Bloqueio Rígido)
- **Contexto:** Bloqueio automático na interface caso o desconto unitário ou global concedido pelo representante ultrapasse o `desconto_maximo_permitido` parametrizado na tabela ou na representada.
- **Motivo da Postergação:** O representante tem autonomia na negociação de orçamentos rápidos em campo e não deve ter a emissão interrompida por validações rígidas neste momento (hoje já exibe alerta visual informativo quando ultrapassa o teto sugerido).
- **Implementação Futura:**
  - Trava configurável por tenant ou fluxo de solicitação de autorização especial.

### 1.2. Trava de Pedido Mínimo (Valor / Volume)
- **Contexto:** Impedir a finalização do pedido caso o subtotal por representada não atinja `valor_pedido_minimo_centavos` ou o volume mínimo exigido pela fábrica.
- **Motivo da Postergação:** Em fase de orçamento e cotação rápida, o representante precisa compor propostas preliminares sem travas impeditivas de fechamento (hoje exibe *badge* informativo de atingimento do mínimo).

### 1.3. Regras Específicas de Fracionamento / Embalagem
- **Contexto:** Conversão ou bloqueio de unidades fracionadas vs caixas fechadas.
- **Definição Atual:** O input de quantidade representa o número de volumes/unidades vendidas diretamente, respeitando o múltiplo de embalagem.
- **Implementação Futura:** Exibição opcional do totalizador de peças avulsas (`quantidade * multiplo_embalagem`) no espelho/PDF apenas para conferência logística.

### 1.4. Importação de Tabelas de Preço em PDF e XLSX
- **Contexto:** A importação por CSV e o reajuste em lote entraram no `TODO.md` 2.9. Algumas fábricas podem enviar a tabela só em PDF ou direto em Excel (`.xlsx`).
- **Motivo da Postergação:** Ainda não se sabe em que formato as fábricas enviam. Extrair tabelas de PDF é frágil (cada fábrica tem um layout) e exige conferência manual. Por ora, o representante pede a planilha à fábrica e exporta para CSV.
- **Implementação Futura:**
  - Leitura direta de `.xlsx`, reaproveitando o mapeamento de colunas e a prévia da 2.9.
  - Extração de tabelas de PDF com conferência obrigatória na prévia antes de gravar.

### 1.5. Preço por Estado e Impostos (ICMS, ST, IPI)
- **Contexto:** O preço final pode mudar conforme o estado de destino e o regime do cliente (alíquota interestadual de ICMS, substituição tributária, IPI). Algumas fábricas publicam tabelas por estado ou região.
- **Definição Atual (MVP):** A tabela pertence à representada e o orçamento sugere a tabela vigente de início mais recente (`TODO.md` 2.7). O representante troca a tabela manualmente quando a fábrica tiver tabelas regionais.
- **Implementação Futura:**
  - Regras de sugestão de tabela por UF de entrega e por `tipo_cliente`.
  - Cálculo e exibição de impostos por item e no total (em centavos, *half-even*), com as alíquotas parametrizadas por representada e UF.
  - Destaque dos impostos no espelho PDF.

### 1.6. Evoluções da Importação CSV (Depende do Formato das Fábricas)
- **Contexto:** A importação da 2.9 foi feita sem exemplos reais de planilhas das fábricas. Antes de evoluir, vale pedir a 2 ou 3 representadas um arquivo real e verificar:
  - Se há **várias colunas de preço** no mesmo arquivo (por estado, à vista/a prazo, revenda/fábrica). Hoje cada importação usa uma coluna; para várias, importa-se uma vez por coluna e tabela.
  - Se vêm campos extras úteis: **IPI, NCM, EAN/código de barras, peso, preço sugerido de revenda e desconto máximo**. Hoje são ignorados; o desconto máximo dos itens novos entra como 0.
  - Se o código do produto da fábrica é estável entre arquivos (a importação casa pelo SKU) e se há zeros à esquerda que o Excel remove ao salvar.
  - Se o arquivo vem com subtotais, linhas de grupo ou células mescladas, que hoje viram erro na prévia.
- **Implementação Futura:**
  - Importar várias colunas de preço de uma vez (uma tabela por coluna).
  - Mapear IPI e desconto máximo, quando houver dado.
  - Sincronizar o mapeamento de colunas (hoje fica só no aparelho, Dexie `mapeamentos_importacao`) se o representante usar vários aparelhos.

### 1.7. Escala do Catálogo
- **Definição Atual:** Com 5.000 SKUs por fábrica, o catálogo abre em menos de 0,5 s navegando no app e busca em cerca de 0,1 s (renderização incremental de 100 em 100).
- **Implementação Futura:** Se algum tenant passar de cerca de 20.000 SKUs, considerar virtualização da lista e índice de busca por prefixo no Dexie, medindo antes no navegador real.

---

## 2. Canal B2B de Autoatendimento do Cliente (Futuro / Pós-Supabase)

### 2.1. Catálogo Compartilhável sem Preços (Solicitação de Orçamento pelo Cliente)
- **Contexto:** Permitir que o próprio cliente final acesse um link de catálogo, monte um carrinho com produtos de uma ou mais representadas **sem visualizar preços** e envie uma solicitação de orçamento para o representante precificar e aprovar.
- **Motivo da Postergação:** Depende de link público autenticado/tokenizado e sincronização ativa com o backend Supabase.

---

## 3. Itens Promovidos para o `TODO.md`

Os itens abaixo saíram do backlog e entraram na fila de implementação do **`TODO.md`**:
- **Importação de Tabelas por CSV e Reajuste em Lote (`TODO.md` 2.9, concluído):** Mapeamento de colunas por fábrica, prévia das mudanças antes de gravar e clonagem de tabela com reajuste percentual.
- **Cotação Multi-Representada pelo Representante (`TODO.md` 2.5.4):** Montar uma única cotação para o cliente contendo produtos de várias representadas, agrupando por fábrica na sacola e gerando automaticamente os pedidos individuais de cada representada vinculados por `cotacao_grupo_id` (com PDF unificado para o cliente e PDF individual por fábrica).
- **Cadastro de Transportadoras e Vínculo no Pedido (`TODO.md` 2.5.3):** Cadastro enxuto de transportadoras, vínculo habitual no cliente e seleção digitável no pedido + exibição no PDF.
- **Cadastro Rápido de Cliente Direto no Orçamento (`TODO.md` 2.5.2):** Criar cliente sem sair da tela de orçamento a partir da própria busca (*Combobox*).
