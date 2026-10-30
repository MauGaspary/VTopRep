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

### 1.4. Reajuste em Massa e Importação de Tabelas de Preço (CSV / Planilha)
- **Contexto:** Atualização percentual em lote ou importação de planilha da fábrica para popular centenas de SKUs de uma vez.
- **Implementação Futura:**
  - Ferramenta de clonagem de tabela com reajuste percentual em lote.
  - Importação de preços via arquivo CSV/XLSX enviado pela representada.

---

## 2. Canal B2B de Autoatendimento do Cliente (Futuro / Pós-Supabase)

### 2.1. Catálogo Compartilhável sem Preços (Solicitação de Orçamento pelo Cliente)
- **Contexto:** Permitir que o próprio cliente final acesse um link de catálogo, monte um carrinho com produtos de uma ou mais representadas **sem visualizar preços** e envie uma solicitação de orçamento para o representante precificar e aprovar.
- **Motivo da Postergação:** Depende de link público autenticado/tokenizado e sincronização ativa com o backend Supabase.

---

## 3. Itens Promovidos para a Fase 2.5 (`TODO.md`)

Os itens abaixo saíram do backlog e entraram na fila imediata de implementação na **Fase 2.5 do `TODO.md`**:
- **Cotação Multi-Representada pelo Representante (`TODO.md` 2.5.4):** Montar uma única cotação para o cliente contendo produtos de várias representadas, agrupando por fábrica na sacola e gerando automaticamente os pedidos individuais de cada representada vinculados por `cotacao_grupo_id` (com PDF unificado para o cliente e PDF individual por fábrica).
- **Cadastro de Transportadoras e Vínculo no Pedido (`TODO.md` 2.5.3):** Cadastro enxuto de transportadoras, vínculo habitual no cliente e seleção digitável no pedido + exibição no PDF.
- **Cadastro Rápido de Cliente Direto no Orçamento (`TODO.md` 2.5.2):** Criar cliente sem sair da tela de orçamento a partir da própria busca (*Combobox*).
