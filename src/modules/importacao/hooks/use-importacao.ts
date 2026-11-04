import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { ColunasMapeamentoSalvo } from "../domain/importacao.schema";
import type { ImportarProdutosParams } from "../repositories/importacao.repository";
import { importacaoRepository } from "../repositories/importacao-dexie.adapter";

/** Mapeamento de colunas salvo neste aparelho (`null` = nenhum). */
export function useMapeamentoSalvo(
	tenantId: string,
	representadaId: string | undefined,
) {
	const mapeamento = useLiveRepositoryQuery(async () => {
		if (!tenantId || !representadaId) return null;
		return importacaoRepository.obterMapeamento(tenantId, representadaId);
	}, [tenantId, representadaId]);

	return {
		mapeamentoSalvo: mapeamento ?? null,
		isLoading: mapeamento === undefined,
	};
}

/** Ações de escrita com o tenant já injetado. */
export function useImportacaoActions(tenantId: string) {
	return useMemo(
		() => ({
			importar: (params: ImportarProdutosParams) =>
				importacaoRepository.importar(tenantId, params),
			salvarMapeamento: (
				representadaId: string,
				colunas: ColunasMapeamentoSalvo,
			) =>
				importacaoRepository.salvarMapeamento(
					tenantId,
					representadaId,
					colunas,
				),
		}),
		[tenantId],
	);
}
