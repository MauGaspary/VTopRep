import { normalizarTextoComparacao } from "../../representadas/domain/representada";
import {
	type Cliente,
	type ClienteInput,
	ClienteInputSchema,
	ClienteSchema,
} from "./cliente.schema";
import {
	type ClienteContato,
	type ClienteContatoInput,
	ClienteContatoInputSchema,
	ClienteContatoSchema,
} from "./cliente-contato.schema";
import {
	type ClienteEndereco,
	type ClienteEnderecoInput,
	ClienteEnderecoInputSchema,
	ClienteEnderecoSchema,
} from "./cliente-endereco.schema";

export class ClienteNaoEncontradoError extends Error {
	constructor(id: string) {
		super(`Cliente ${id} não encontrado`);
		this.name = "ClienteNaoEncontradoError";
	}
}

export class CpfCnpjDuplicadoError extends Error {
	constructor() {
		super("Já existe um cliente ativo com este CPF/CNPJ");
		this.name = "CpfCnpjDuplicadoError";
	}
}

export class RazaoSocialClienteDuplicadaError extends Error {
	constructor() {
		super("Já existe um cliente ativo com esta Razão Social / Nome");
		this.name = "RazaoSocialClienteDuplicadaError";
	}
}

export class NomeFantasiaClienteDuplicadoError extends Error {
	constructor() {
		super("Já existe um cliente ativo com este Nome Fantasia");
		this.name = "NomeFantasiaClienteDuplicadoError";
	}
}

export class ClienteInativoExistenteError extends Error {
	readonly clienteInativo: Cliente;
	readonly campoConflito: "cnpj_cpf" | "razao_social" | "nome_fantasia";

	constructor(
		clienteInativo: Cliente,
		campoConflito: "cnpj_cpf" | "razao_social" | "nome_fantasia",
	) {
		const rotulo =
			campoConflito === "cnpj_cpf"
				? "CPF/CNPJ"
				: campoConflito === "razao_social"
					? "Razão Social / Nome"
					: "Nome Fantasia";
		super(
			`Existe um cliente inativo com este mesmo ${rotulo}: "${clienteInativo.razao_social}". Deseja reativá-lo?`,
		);
		this.name = "ClienteInativoExistenteError";
		this.clienteInativo = clienteInativo;
		this.campoConflito = campoConflito;
	}
}

export class TenantDivergenteClienteError extends Error {
	constructor() {
		super("Operação não permitida: cliente pertence a outro tenant");
		this.name = "TenantDivergenteClienteError";
	}
}

export interface ClienteCompleto {
	cliente: Cliente;
	enderecos: ClienteEndereco[];
	contatos: ClienteContato[];
}

export interface SalvarClienteParams {
	tenantId: string;
	clienteInput: ClienteInput;
	enderecosInput?: ClienteEnderecoInput[];
	contatosInput?: ClienteContatoInput[];
	clienteId?: string;
	agora: string;
	gerarId?: () => string;
}

export function criarClienteCompleto({
	tenantId,
	clienteInput,
	enderecosInput = [],
	contatosInput = [],
	clienteId = crypto.randomUUID(),
	agora,
	gerarId = () => crypto.randomUUID(),
}: SalvarClienteParams): ClienteCompleto {
	const dadosCliente = ClienteInputSchema.parse(clienteInput);
	const cliente = ClienteSchema.parse({
		...dadosCliente,
		id: clienteId,
		tenant_id: tenantId,
		ativo: true,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});

	const enderecos: ClienteEndereco[] = enderecosInput.map((end) => {
		const parsed = ClienteEnderecoInputSchema.parse(end);
		return ClienteEnderecoSchema.parse({
			...parsed,
			id: parsed.id ?? gerarId(),
			cliente_id: cliente.id,
		});
	});

	const contatos: ClienteContato[] = contatosInput.map((cont) => {
		const parsed = ClienteContatoInputSchema.parse(cont);
		return ClienteContatoSchema.parse({
			...parsed,
			id: parsed.id ?? gerarId(),
			cliente_id: cliente.id,
		});
	});

	return { cliente, enderecos, contatos };
}

export function atualizarClienteDados(
	existente: Cliente,
	tenantId: string,
	input: ClienteInput,
	agora: string,
): Cliente {
	if (existente.tenant_id !== tenantId) {
		throw new TenantDivergenteClienteError();
	}
	const dados = ClienteInputSchema.parse(input);
	return ClienteSchema.parse({
		...existente,
		...dados,
		updated_at: agora,
	});
}

export function inativarCliente(
	existente: Cliente,
	tenantId: string,
	agora: string,
): Cliente {
	if (existente.tenant_id !== tenantId) {
		throw new TenantDivergenteClienteError();
	}
	if (existente.deleted_at !== null) return existente;
	return { ...existente, ativo: false, deleted_at: agora, updated_at: agora };
}

export function reativarCliente(
	existente: Cliente,
	tenantId: string,
	agora: string,
): Cliente {
	if (existente.tenant_id !== tenantId) {
		throw new TenantDivergenteClienteError();
	}
	if (existente.deleted_at === null) return existente;
	return { ...existente, ativo: true, deleted_at: null, updated_at: agora };
}

export function correspondeBuscaCliente(
	cliente: Cliente,
	termo: string | undefined,
): boolean {
	const termoNormalizado = normalizarTextoComparacao(termo ?? "");
	if (termoNormalizado === "") return true;

	const termoDoc = termoNormalizado.replace(/[.\-/\s]/g, "").toUpperCase();

	return (
		normalizarTextoComparacao(cliente.razao_social).includes(
			termoNormalizado,
		) ||
		(cliente.nome_fantasia !== null &&
			cliente.nome_fantasia !== undefined &&
			normalizarTextoComparacao(cliente.nome_fantasia).includes(
				termoNormalizado,
			)) ||
		(termoDoc !== "" && cliente.cnpj_cpf.includes(termoDoc))
	);
}

export function ordenarClientesComInativosNoFim(lista: Cliente[]): Cliente[] {
	return [...lista].sort((a, b) => {
		const aInativo = a.deleted_at !== null;
		const bInativo = b.deleted_at !== null;

		if (aInativo !== bInativo) {
			return aInativo ? 1 : -1;
		}

		return a.razao_social.localeCompare(b.razao_social, "pt-BR", {
			sensitivity: "base",
		});
	});
}
