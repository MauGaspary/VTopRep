/**
 * Enquanto não houver envio da Outbox para o servidor (TODO 2.11), os dados
 * existem só no aparelho e o app lembra o representante de fazer backup.
 * Ligar quando o worker de envio e o pull estiverem em produção.
 */
export const SINCRONIZACAO_REMOTA_ATIVA = false;
