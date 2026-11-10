## Roteiro Completo de Testes Manuais (Novos + Antigos Pendentes)

Para testar tudo de uma vez (especialmente no celular Android via cabo USB com pnpm build && pnpm preview --host 127.0.0.1 + Port forwarding em chrome://inspect, ou no desktop em http://localhost:4173):

### Parte A — Novidades implementadas hoje

[ ] 1. Outbox nos Cadastros Mestres:
• Cadastre ou edite manualmente uma Representada (alterando uma tabela de preço) e um Produto (alterando o preço base).
• Verifique no indicador de conexão (ConnectionStatus, no rodapé da barra lateral ou topo) que o contador "X na fila" aumenta a cada alteração.
[ ] 2. Desconto Geral na Sacola:
• Em Novo Orçamento (/pedidos/novo), adicione 2 ou 3 produtos de uma fábrica.
• No campo "Desconto em todos os itens (%)" da sacola, digite 7,5 e toque em Aplicar (ou pressione Enter).
• Confira se todos os itens daquela fábrica receberam 7,50%, se o preço líquido e o subtotal recalcularam na hora e se você ainda consegue editar o desconto de um item específico separado dos demais.
[ ] 3. Compartilhar PDF Individual na Cotação Multi-Fábrica:
• Monte e salve uma cotação com itens de 2 representadas diferentes.
• No painel Cotação unificada, além do PDF unificado, teste os botões Baixar e Compartilhar dentro do bloco de cada fábrica individual (no Android deve abrir a gaveta nativa de compartilhamento com o PDF apenas
daquela fábrica).
[ ] 4. Prévias Responsivas no Celular (Importação CSV e Reajuste):
• Com a tela estreita (celular em pé), abra Catálogo → Importar CSV e carregue um arquivo CSV: confira se a prévia (itens, ausentes e erros/avisos) aparece em cards compactos sem criar rolagem horizontal na página.  
 • Abra Representadas → Editar → Reajustar tabela, digite um percentual (ex.: 5%) e confira se a prévia dos preços atual × novo também aparece em cards compactos no celular e em tabela no desktop.

### Parte B — Testes antigos que já estavam pendentes (TODO.md` 2.10.1 e melhorias.md:48-50)

[ ] 5. Instalação do PWA e Uso em Modo Avião (TODO.md 2.10.1):
• Com o build de produção (pnpm build && pnpm preview), instale o app no Android (Menu ⋮ → Instalar app) e no Desktop (ícone na barra de endereço do Chrome/Edge).
• Ative o Modo Avião (ou desligue o Wi-Fi/dados), feche o app completamente e abra-o pelo ícone instalado.
• Navegue entre abas, crie um orçamento completo, feche o pedido e gere/baixe o Espelho PDF totalmente offline.
[ ] 6. Proteção de Edição contra Atualização do App (AvisoNovaVersao):
• Com um orçamento aberto e itens adicionados (sem salvar), verifique que o app bloqueia a recarga caso surja aviso de nova versão (e pergunta antes de sair da página).
[ ] 7. Fluxo de Backup e Restauração (/dados):
• No ambiente dev (localhost:5173), popule dados se necessário e clique em Dados e backup → Baixar backup (.json).
• No app instalado (localhost:4173), abra Dados e backup → Restaurar backup, selecione o .json, confira o quadro comparativo "Neste aparelho × No backup" e confirme a restauração.
• Verifique se o selo de armazenamento aparece como Protegido após instalar o PWA.
[ ] 8. Ergonomia Mobile e Teclado Virtual (melhorias.md):
• No celular, verifique se a barra inferior fixa permanece firme ao rolar listas longas (Catálogo, Clientes, Orçamentos) e se não há atraso ao tocar repetidamente nos botões + e − de quantidade na sacola.
• Toque nos campos de quantidade, desconto e observações no fim do orçamento com o teclado virtual do celular aberto para conferir se o campo focado fica visível acima da barra.
• Alterne o tema (Claro → Escuro → Sistema) pelo botão da barra superior do celular e confira se a cor da barra de status do Android acompanha a troca.

──────

### Modern Web Guidance

• responsive-table: Replaced horizontal-overflowing preview tables in ReajusteTabelaView and PreviaImportacaoTabela with @container-driven card/table switching (ListaResponsiva) so narrow viewports never overflow
horizontally ("Use @container queries instead of @media queries. This allows the table to adapt based on its own width").
• forms: Implemented deferred validation on blur with immediate error reset on input, disabled text autocorrection (autoCorrect="off", autoCapitalize="off", spellCheck={false}), and guarded Enter submission with !e.  
 nativeEvent.isComposing on the batch discount field ("check KeyboardEvent.isComposing before treating the Enter key as a submit action").
