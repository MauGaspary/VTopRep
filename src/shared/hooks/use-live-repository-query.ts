import { useLiveQuery } from "dexie-react-hooks";

/**
 * Executa uma consulta de repositório e a reexecuta quando os dados locais mudam.
 *
 * Único ponto do app que conhece `dexie-react-hooks`: os hooks dos módulos
 * dependem só deste contrato, e não da infraestrutura. Retorna `undefined`
 * enquanto a primeira execução não termina.
 */
export function useLiveRepositoryQuery<T>(
	consulta: () => Promise<T>,
	dependencias: readonly unknown[],
): T | undefined {
	return useLiveQuery(consulta, [...dependencias]);
}
