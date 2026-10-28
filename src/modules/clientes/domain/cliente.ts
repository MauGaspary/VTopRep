import { normalizarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import {
	type ConflitoUnicidade,
	detectarConflito,
	detectarHomonimos,
	type Homonimo,
} from "../../../shared/domain/unicidade";
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

export class ClienteInativoExistenteError extends Error {
	readonly clienteInativo: Cliente;

	constructor(clienteInativo: Cliente) {
		super(
			`Existe um cliente inativo com este mesmo CPF/CNPJ: "${clienteInativo.razao_social}". Deseja reativá-lo?`,
		);
		this.name = "ClienteInativoExistenteError";
		this.clienteInativo = clienteInativo;
	}
}

export interface ClienteCompleto {
	cliente: Cliente;
	enderecos: ClienteEndereco[];
	contatos: ClienteContato[];
}

interface RegistroFilho {
	id: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

interface ReconciliarParams<I, T extends RegistroFilho> {
	existentes: readonly T[];
	inputs: readonly I[];
	idDoInput: (input: I) => string | undefined;
	/** Monta o registro a partir do input, preservando a identidade em `base`. */
	montar: (input: I, base: RegistroFilho) => T;
	mesmoConteudo: (a: T, b: T) => boolean;
	agora: string;
	gerarId: () => string;
}

/**
 * Compara a coleção enviada com a gravada (soft delete, nunca exclusão física):
 * - `id` de um filho vivo do cliente: atualiza, ou mantém intacto se nada mudou;
 * - sem `id`, ou `id` desconhecido/repetido: cria com um id novo (impede
 *   sobrescrever registro de outro cliente ou tenant);
 * - filho vivo ausente da coleção: recebe `deleted_at` (tombstone).
 */
function reconciliarFilhos<I, T extends RegistroFilho>({
	existentes,
	inputs,
	idDoInput,
	montar,
	mesmoConteudo,
	agora,
	gerarId,
}: ReconciliarParams<I, T>): { ativos: T[]; gravar: T[] } {
	const vivos = new Map(
		existentes.filter((e) => e.deleted_at === null).map((e) => [e.id, e]),
	);
	const usados = new Set<string>();
	const ativos: T[] = [];
	const gravar: T[] = [];

	for (const input of inputs) {
		const id = idDoInput(input);
		const existente = id !== undefined ? vivos.get(id) : undefined;

		if (existente && !usados.has(existente.id)) {
			usados.add(existente.id);
			const candidato = montar(input, {
				id: existente.id,
				created_at: existente.created_at,
				updated_at: agora,
				deleted_at: null,
			});
			if (mesmoConteudo(existente, candidato)) {
				ativos.push(existente);
			} else {
				ativos.push(candidato);
				gravar.push(candidato);
			}
			continue;
		}

		const novo = montar(input, {
			id: gerarId(),
			created_at: agora,
			updated_at: agora,
			deleted_at: null,
		});
		ativos.push(novo);
		gravar.push(novo);
	}

	for (const existente of vivos.values()) {
		if (!usados.has(existente.id)) {
			gravar.push({ ...existente, deleted_at: agora, updated_at: agora });
		}
	}

	return { ativos, gravar };
}

const mesmoEndereco = (a: ClienteEndereco, b: ClienteEndereco) =>
	a.tipo_endereco === b.tipo_endereco &&
	a.endereco_completo === b.endereco_completo &&
	(a.latitude ?? null) === (b.latitude ?? null) &&
	(a.longitude ?? null) === (b.longitude ?? null);

const mesmoContato = (a: ClienteContato, b: ClienteContato) =>
	a.nome === b.nome &&
	(a.papel ?? null) === (b.papel ?? null) &&
	a.telefone_whatsapp === b.telefone_whatsapp &&
	(a.email ?? null) === (b.email ?? null);

interface SincronizarFilhosParams {
	tenantId: string;
	clienteId: string;
	agora: string;
	enderecosInput?: ClienteEnderecoInput[];
	contatosInput?: ClienteContatoInput[];
	/** Filhos já gravados do cliente (vazio na criação). */
	existentes?: Pick<ClienteCompleto, "enderecos" | "contatos">;
	gerarId?: () => string;
}

export interface FilhosSincronizados {
	/** Coleção viva resultante (o que o cliente passa a ter). */
	enderecos: ClienteEndereco[];
	contatos: ClienteContato[];
	/** Registros a persistir: novos, alterados e excluídos (tombstones). */
	gravar: Pick<ClienteCompleto, "enderecos" | "contatos">;
}

/** Valida endereços e contatos, vincula ao cliente/tenant e reconcilia com os gravados. */
export function sincronizarFilhosCliente({
	tenantId,
	clienteId,
	agora,
	enderecosInput = [],
	contatosInput = [],
	existentes = { enderecos: [], contatos: [] },
	gerarId = () => crypto.randomUUID(),
}: SincronizarFilhosParams): FilhosSincronizados {
	const vinculo = { tenant_id: tenantId, cliente_id: clienteId };

	const enderecos = reconciliarFilhos({
		existentes: existentes.enderecos,
		inputs: enderecosInput.map((e) => ClienteEnderecoInputSchema.parse(e)),
		idDoInput: (e) => e.id,
		montar: (e, base) =>
			ClienteEnderecoSchema.parse({ ...e, ...vinculo, ...base }),
		mesmoConteudo: mesmoEndereco,
		agora,
		gerarId,
	});

	const contatos = reconciliarFilhos({
		existentes: existentes.contatos,
		inputs: contatosInput.map((c) => ClienteContatoInputSchema.parse(c)),
		idDoInput: (c) => c.id,
		montar: (c, base) =>
			ClienteContatoSchema.parse({ ...c, ...vinculo, ...base }),
		mesmoConteudo: mesmoContato,
		agora,
		gerarId,
	});

	return {
		enderecos: enderecos.ativos,
		contatos: contatos.ativos,
		gravar: { enderecos: enderecos.gravar, contatos: contatos.gravar },
	};
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

	const { enderecos, contatos } = sincronizarFilhosCliente({
		tenantId: cliente.tenant_id,
		clienteId: cliente.id,
		agora,
		enderecosInput,
		contatosInput,
		gerarId,
	});

	return { cliente, enderecos, contatos };
}

export function atualizarClienteDados(
	existente: Cliente,
	tenantId: string,
	input: ClienteInput,
	agora: string,
): Cliente {
	garantirMesmoTenant(existente, tenantId);
	const dados = ClienteInputSchema.parse(input);
	return ClienteSchema.parse({
		...existente,
		...dados,
		updated_at: agora,
	});
}

/** Inativação (estado de negócio, reversível): marca `ativo = false`. Idempotente. */
export function inativarCliente(
	existente: Cliente,
	tenantId: string,
	agora: string,
): Cliente {
	garantirMesmoTenant(existente, tenantId);
	if (!existente.ativo) return existente;
	return { ...existente, ativo: false, updated_at: agora };
}

/** Reativação: marca `ativo = true`. Idempotente. */
export function reativarCliente(
	existente: Cliente,
	tenantId: string,
	agora: string,
): Cliente {
	garantirMesmoTenant(existente, tenantId);
	if (existente.ativo) return existente;
	return { ...existente, ativo: true, updated_at: agora };
}

/** Conflito bloqueante: outro cliente (não excluído) com o mesmo CPF/CNPJ. */
export function detectarConflitoDocumento(
	candidatos: readonly Cliente[],
	cnpjCpf: string,
	idAtual?: string,
): ConflitoUnicidade<Cliente> | null {
	const normalizado = normalizarCpfCnpj(cnpjCpf);
	return detectarConflito(
		candidatos,
		(c) => c.cnpj_cpf === normalizado,
		idAtual,
	);
}

export const CAMPOS_NOME_CLIENTE = ["razao_social", "nome_fantasia"] as const;
export type CampoNomeCliente = (typeof CAMPOS_NOME_CLIENTE)[number];
export type HomonimoCliente = Homonimo<Cliente, CampoNomeCliente>;

/** Aviso não bloqueante: clientes com a mesma razão social ou nome fantasia. */
export function detectarHomonimosCliente(
	candidatos: readonly Cliente[],
	nomes: Pick<Cliente, CampoNomeCliente>,
	idAtual?: string,
): HomonimoCliente[] {
	return detectarHomonimos({
		candidatos,
		campos: CAMPOS_NOME_CLIENTE,
		nomes: {
			razao_social: nomes.razao_social,
			nome_fantasia: nomes.nome_fantasia,
		},
		nomesDe: (c) => ({
			razao_social: c.razao_social,
			nome_fantasia: c.nome_fantasia,
		}),
		idAtual,
	});
}

export function correspondeBuscaCliente(
	cliente: Cliente,
	termo: string | undefined,
): boolean {
	const termoNormalizado = normalizarTexto(termo ?? "");
	if (termoNormalizado === "") return true;

	const termoDoc = normalizarCpfCnpj(termoNormalizado);

	return (
		normalizarTexto(cliente.razao_social).includes(termoNormalizado) ||
		(cliente.nome_fantasia !== null &&
			cliente.nome_fantasia !== undefined &&
			normalizarTexto(cliente.nome_fantasia).includes(termoNormalizado)) ||
		(termoDoc !== "" && cliente.cnpj_cpf.includes(termoDoc))
	);
}

export function ordenarClientesComInativosNoFim(lista: Cliente[]): Cliente[] {
	return [...lista].sort((a, b) => {
		if (a.ativo !== b.ativo) {
			return a.ativo ? -1 : 1;
		}

		return a.razao_social.localeCompare(b.razao_social, "pt-BR", {
			sensitivity: "base",
		});
	});
}
