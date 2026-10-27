import type { ClienteCompleto } from "../domain/cliente";
import type { Cliente, ClienteInput } from "../domain/cliente.schema";
import type { ClienteContatoInput } from "../domain/cliente-contato.schema";
import type { ClienteEnderecoInput } from "../domain/cliente-endereco.schema";

export interface SalvarClienteDTO {
	cliente: ClienteInput;
	enderecos: ClienteEnderecoInput[];
	contatos: ClienteContatoInput[];
}

export interface ClienteRepository {
	listar(tenantId: string, termoBusca?: string): Promise<Cliente[]>;
	listarTodos(tenantId: string, termoBusca?: string): Promise<Cliente[]>;
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<ClienteCompleto | undefined>;
	criar(tenantId: string, dto: SalvarClienteDTO): Promise<ClienteCompleto>;
	atualizar(
		tenantId: string,
		id: string,
		dto: SalvarClienteDTO,
	): Promise<ClienteCompleto>;
	inativar(tenantId: string, id: string): Promise<void>;
	reativar(tenantId: string, id: string): Promise<void>;
}
