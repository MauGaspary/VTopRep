import { Alert } from "./Alert";
import { Badge } from "./Badge";

export interface HomonymWarningItem {
	id: string;
	nome: string;
	detalhe?: string;
	inativo?: boolean;
}

export interface HomonymWarningProps {
	title: string;
	description?: string;
	items: HomonymWarningItem[];
}

/** Aviso não bloqueante de cadastros com nomes iguais (ex.: filiais). */
export function HomonymWarning({
	title,
	description,
	items,
}: HomonymWarningProps) {
	if (items.length === 0) return null;

	return (
		<Alert variant="warning">
			<p className="font-semibold">{title}</p>
			<ul className="mt-1 flex flex-col gap-0.5">
				{items.map((item) => (
					<li key={item.id} className="flex flex-wrap items-center gap-2">
						<span>{item.nome}</span>
						{item.detalhe && (
							<span className="font-mono text-xs">{item.detalhe}</span>
						)}
						{item.inativo && <Badge variant="secondary">Inativo</Badge>}
					</li>
				))}
			</ul>
			{description && <p className="mt-1 text-xs">{description}</p>}
		</Alert>
	);
}
