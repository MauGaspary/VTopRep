# Backlog de Funcionalidades Futuras

Este documento reúne regras de negócio, travas comerciais e módulos postergados para versões futuras, mantendo o foco atual na **agilidade do representante em campo na elaboração de orçamentos e pedidos**.

---

## 1. Políticas Comerciais e Travas de Bloqueio (Postergadas)

### 1.1. Teto de Desconto Escalonado
- **Contexto:** Bloqueio automático na interface caso o desconto unitário ou global concedido pelo representante ultrapasse o `desconto_maximo_permitido` parametrizado na tabela ou na representada.
- **Motivo da Postergação:** O representante tem autonomia na negociação de orçamentos rápidos em campo e não deve ter a emissão interrompida por validações rígidas neste momento.
- **Implementação Futura:**
  - Validador puro confrontando percentual/centavos de desconto com tabela ativa.
  - Alerta visual ou solicitação de autorização gerencial.

### 1.2. Trava de Pedido Mínimo (Valor / Volume)
- **Contexto:** Impedir a finalização do pedido caso o subtotal por representada não atinja `valor_pedido_minimo_centavos` ou o volume mínimo exigido pela fábrica.
- **Motivo da Postergação:** Em fase de orçamento e cotação rápida, o representante precisa compor propostas preliminares sem travas impeditivas de fechamento.
- **Implementação Futura:**
  - Checagem por representada no carrinho.
  - Alerta informativo (*badge* de aviso) em vez de bloqueio rígido, ou trava configurável por tenant.

### 1.3. Regras Específicas de Fracionamento / Embalagem
- **Contexto:** Conversão ou bloqueio de unidades fracionadas vs caixas fechadas.
- **Definição Atual:** O input de quantidade representa o número de volumes/unidades vendidas diretamente (ex.: se a embalagem é caixa com 6 e o representante digita 7, entende-se 7 caixas de 6). Travas restritivas de divisão de lote não são necessárias.
- **Implementação Futura:** Exibição opcional do totalizador de peças avulsas (`quantidade * multiplo_embalagem`) no espelho/PDF apenas para conferência logística.

### 1.4. Reajuste em Massa e Importação de Tabelas de Preço (CSV / Planilha)
- **Contexto:** Atualização percentual em lote ou importação de planilha da fábrica para popular centenas de SKUs de uma vez.
- **Definição Atual:** As tabelas de preço são gerenciadas dentro do cadastro da representada (nascendo com uma *Tabela Padrão* automática) e os preços por tabela são preenchidos no cadastro do produto.
- **Implementação Futura:**
  - Ferramenta de clonagem de tabela com reajuste percentual em lote.
  - Importação de preços via arquivo CSV/XLSX enviado pela representada.

---

## 2. Pós-Venda, Conciliação e CRM Avançado (Fases Posteriores)

### 2.1. Conciliação Fina de Notas Fiscais e Faturamento Parcial (Fase 3)
- Entrada de NF e controle de cortes de itens pela fábrica.
- Extrato financeiro cruzando comissão faturada vs recebida.

### 2.2. Inteligência de Recompra e Curva ABC Preditiva (Fase 4)
- Algoritmo de cálculo de ciclo médio de recompra por cliente.
- Ficha Raio-X pré-visita com histórico de itens não explorados.
