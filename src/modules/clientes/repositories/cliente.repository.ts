import type { ClienteCompleto, HomonimoCliente } from "../domain/cliente";
import type { Cliente, ClienteInput } from "../domain/cliente.schema";
import type { ClienteContatoInput } from "../domain/cliente-contato.schema";
import type { ClienteEnderecoInput } from "../domain/cliente-endereco.schema";

export interface SalvarClienteDTO {
	cliente: ClienteInput;
	enderecos: ClienteEnderecoInput[];
	contatos: ClienteContatoInput[];
}

export interface ClienteRepository {
	/** Lista clientes ativos do tenant. */
	listar(tenantId: string, termoBusca?: string): Promise<Cliente[]>;
	/** Lista ativos e inativos do tenant (sem excluídos), com inativos ao final. */
	listarTodos(tenantId: string, termoBusca?: string): Promise<Cliente[]>;
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<ClienteCompleto | undefined>;
	/** Clientes com mesma razão social ou nome fantasia (aviso, não bloqueia). */
	buscarHomonimos(
		tenantId: string,
		nomes: Pick<Cliente, "razao_social" | "nome_fantasia">,
		idAtual?: string,
	): Promise<HomonimoCliente[]>;
	criar(tenantId: string, dto: SalvarClienteDTO): Promise<ClienteCompleto>;
	atualizar(
		tenantId: string,
		id: string,
		dto: SalvarClienteDTO,
	): Promise<ClienteCompleto>;
	inativar(tenantId: string, id: string): Promise<void>;
	reativar(tenantId: string, id: string): Promise<void>;
}
