import { useRegisterSW } from "virtual:pwa-register/react";
import { CloudOff, RefreshCw, X } from "lucide-react";
import { useHaEdicaoEmAndamento } from "../../hooks/use-edicao-em-andamento";
import { Button } from "../ui";

/** A cada hora o app procura uma versão nova (só com internet). */
const INTERVALO_VERIFICACAO_MS = 60 * 60 * 1000;

/**
 * Avisos do service worker (TODO 2.10.1):
 * - primeira instalação: o app já abre sem internet;
 * - versão nova: botão "Atualizar", bloqueado enquanto houver um orçamento
 *   com alterações não salvas (a atualização recarrega a página).
 */
export function AvisoNovaVersao() {
	const haEdicao = useHaEdicaoEmAndamento();
	const {
		needRefresh: [novaVersao, setNovaVersao],
		offlineReady: [prontoOffline, setProntoOffline],
		updateServiceWorker,
	} = useRegisterSW({
		onRegisteredSW(_url, registro) {
			if (!registro) return;
			setInterval(() => {
				if (navigator.onLine) void registro.update();
			}, INTERVALO_VERIFICACAO_MS);
		},
	});

	if (!novaVersao && !prontoOffline) return null;

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex justify-center px-3 md:inset-x-auto md:right-4 md:bottom-4">
			<div
				role="status"
				className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-input bg-card p-3 text-sm text-card-foreground"
			>
				{novaVersao ? (
					<>
						<RefreshCw
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-primary"
						/>
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<div className="flex flex-col gap-0.5">
								<span className="font-medium">Nova versão disponível</span>
								<span className="text-xs text-muted-foreground">
									{haEdicao
										? "Salve o orçamento em edição para atualizar sem perder o que foi digitado."
										: "Atualize para usar as últimas melhorias. Seus dados continuam no aparelho."}
								</span>
							</div>
							<div className="flex gap-2">
								<Button
									size="sm"
									disabled={haEdicao}
									onClick={() => void updateServiceWorker(true)}
								>
									Atualizar
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setNovaVersao(false)}
								>
									Depois
								</Button>
							</div>
						</div>
					</>
				) : (
					<>
						<CloudOff
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-success"
						/>
						<span className="flex-1">
							Pronto para uso offline: o app abre mesmo sem internet.
						</span>
						<Button
							size="sm"
							variant="ghost"
							aria-label="Fechar aviso"
							onClick={() => setProntoOffline(false)}
						>
							<X aria-hidden="true" />
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
