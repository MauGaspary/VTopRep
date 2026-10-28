import { useMemo } from "react";
import { useDebouncedValue } from "../../../shared/hooks/use-debounced-value";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { HomonimoCliente } from "../domain/cliente";
import type { Cliente } from "../domain/cliente.schema";
import type { SalvarClienteDTO } from "../repositories/cliente.repository";
import { clienteRepository } from "../repositories/cliente-dexie.adapter";

export function useClientes(tenantId: string, termoBusca?: string) {
	const clientes = useLiveRepositoryQuery(
		() => clienteRepository.listar(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		clientes: clientes ?? [],
		isLoading: clientes === undefined,
	};
}

export function useTodosClientes(tenantId: string, termoBusca?: string) {
	const clientes = useLiveRepositoryQuery(
		() => clienteRepository.listarTodos(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		clientes: clientes ?? [],
		isLoading: clientes === undefined,
	};
}

export function useCliente(
	tenantId: string,
	id: string | undefined,
	permitirInativo = false,
) {
	const dados = useLiveRepositoryQuery(async () => {
		if (!id) return null;
		return (
			(await clienteRepository.obterPorId(tenantId, id, permitirInativo)) ??
			null
		);
	}, [tenantId, id, permitirInativo]);

	return {
		dados,
		isLoading: dados === undefined,
	};
}

/** Espera entre a última tecla e a consulta de homônimos. */
const ATRASO_HOMONIMOS_MS = 400;

/**
 * Clientes com a mesma razão social ou nome fantasia (aviso não bloqueante).
 * Só consulta depois que o usuário para de digitar, e nunca com nomes vazios.
 */
export function useHomonimosCliente(
	tenantId: string,
	nomes: Pick<Cliente, "razao_social" | "nome_fantasia">,
	idAtual?: string,
): HomonimoCliente[] {
	const razaoSocial = useDebouncedValue(
		nomes.razao_social.trim(),
		ATRASO_HOMONIMOS_MS,
	);
	const nomeFantasia = useDebouncedValue(
		nomes.nome_fantasia?.trim() ?? "",
		ATRASO_HOMONIMOS_MS,
	);

	const homonimos = useLiveRepositoryQuery(async () => {
		if (razaoSocial === "" && nomeFantasia === "") return [];
		return clienteRepository.buscarHomonimos(
			tenantId,
			{ razao_social: razaoSocial, nome_fantasia: nomeFantasia },
			idAtual,
		);
	}, [tenantId, razaoSocial, nomeFantasia, idAtual]);
	return homonimos ?? [];
}

export function useClienteActions(tenantId: string) {
	return useMemo(
		() => ({
			criar: (dto: SalvarClienteDTO) => clienteRepository.criar(tenantId, dto),
			atualizar: (id: string, dto: SalvarClienteDTO) =>
				clienteRepository.atualizar(tenantId, id, dto),
			inativar: (id: string) => clienteRepository.inativar(tenantId, id),
			reativar: (id: string) => clienteRepository.reativar(tenantId, id),
		}),
		[tenantId],
	);
}
