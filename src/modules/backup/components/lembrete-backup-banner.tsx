import { DatabaseBackup } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Button, buttonClassName } from "../../../shared/components/ui";
import { descreverUltimoBackup } from "../domain/lembrete-backup";
import { useLembreteBackup } from "../hooks/use-backup";

/**
 * Lembrete periódico de backup (TODO 2.10.2), enquanto os dados vivem só no
 * aparelho. Some na própria tela de backup e por um dia com "Lembrar amanhã".
 */
export function LembreteBackupBanner() {
	const { config } = useTenant();
	const { pathname } = useLocation();
	const { mostrar, preferencias, adiarLembrete } = useLembreteBackup(config.id);

	if (!mostrar || pathname.startsWith("/dados")) return null;

	return (
		<div
			role="status"
			className="flex flex-col gap-2 border-b border-border bg-muted px-4 py-2.5 text-sm sm:flex-row sm:items-center lg:rounded-t-xl lg:px-6"
		>
			<div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
				<DatabaseBackup
					aria-hidden="true"
					className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0"
				/>
				<p className="min-w-0 text-foreground">
					<span className="font-medium">
						{descreverUltimoBackup(preferencias.ultimo_backup_em, new Date())}.
					</span>{" "}
					<span className="text-muted-foreground">
						Os dados ainda ficam só neste aparelho: baixe um backup e guarde
						fora dele.
					</span>
				</p>
			</div>
			<div className="flex shrink-0 gap-2 pl-6.5 sm:pl-0">
				<Link
					to="/dados"
					className={buttonClassName({ size: "sm", variant: "primary" })}
				>
					Fazer backup
				</Link>
				<Button size="sm" variant="ghost" onClick={adiarLembrete}>
					Lembrar amanhã
				</Button>
			</div>
		</div>
	);
}
