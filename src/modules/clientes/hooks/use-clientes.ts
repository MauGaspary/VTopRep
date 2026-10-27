import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import type { SalvarClienteDTO } from "../repositories/cliente.repository";
import { clienteRepository } from "../repositories/cliente-dexie.adapter";

export function useClientes(tenantId: string, termoBusca?: string) {
	const clientes = useLiveQuery(
		() => clienteRepository.listar(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		clientes: clientes ?? [],
		isLoading: clientes === undefined,
	};
}

export function useTodosClientes(tenantId: string, termoBusca?: string) {
	const clientes = useLiveQuery(
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
	const dados = useLiveQuery(async () => {
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
