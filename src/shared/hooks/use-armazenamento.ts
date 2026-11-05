import { useCallback, useEffect, useState } from "react";
import {
	ESTADO_ARMAZENAMENTO_DESCONHECIDO,
	type EstadoArmazenamento,
} from "../domain/armazenamento";
import { armazenamentoRepository } from "../repositories/armazenamento.repository";

/** Situação do armazenamento (persistência e espaço usado) com recarga manual. */
export function useArmazenamento() {
	const [estado, setEstado] = useState<EstadoArmazenamento>(
		ESTADO_ARMAZENAMENTO_DESCONHECIDO,
	);
	const [carregando, setCarregando] = useState(true);

	const atualizar = useCallback(async () => {
		setEstado(await armazenamentoRepository.obterEstado());
		setCarregando(false);
	}, []);

	useEffect(() => {
		void atualizar();
	}, [atualizar]);

	const solicitarPersistencia = useCallback(async () => {
		const concedido = await armazenamentoRepository.solicitarPersistencia();
		await atualizar();
		return concedido;
	}, [atualizar]);

	return { estado, carregando, atualizar, solicitarPersistencia };
}

/**
 * Pede o armazenamento persistente uma vez, ao abrir o app. Chrome, Edge e
 * Safari decidem sem perguntar (app instalado ou usado com frequência); o
 * Firefox mostra uma pergunta ao usuário.
 */
export function useSolicitarArmazenamentoPersistente(): void {
	useEffect(() => {
		void armazenamentoRepository.solicitarPersistencia();
	}, []);
}
