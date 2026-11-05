import type { ReactNode } from "react";
import { cardClassName } from "./Card";

/**
 * Lista que escolhe o formato pela largura que ela mesma tem (não pela tela):
 * abaixo de 672 px mostra `ListaCards`; a partir disso, `ListaTabela`. Nunca
 * rola para o lado. Dentro da tabela, use variantes `@4xl:`/`@5xl:` para as
 * colunas secundárias, que só aparecem quando cabem.
 *
 * ```tsx
 * <ListaResponsiva>
 *   <ListaCards rotulo="Clientes">{... <CartaoLista> ...}</ListaCards>
 *   <ListaTabela rotulo="Clientes"><table>...</table></ListaTabela>
 * </ListaResponsiva>
 * ```
 */
export function ListaResponsiva({ children }: { children: ReactNode }) {
	return <div className="@container flex flex-col gap-3">{children}</div>;
}

interface ParteListaProps {
	/** Nome da lista para leitores de tela. */
	rotulo: string;
	children: ReactNode;
}

/** Formato card, para quando a lista tem pouco espaço (celular em pé). */
export function ListaCards({ rotulo, children }: ParteListaProps) {
	return (
		<ul aria-label={rotulo} className="flex flex-col gap-2 @2xl:hidden">
			{children}
		</ul>
	);
}

/** Formato tabela, para quando há espaço (celular deitado, tablet, computador). */
export function ListaTabela({ rotulo, children }: ParteListaProps) {
	return (
		<section
			aria-label={`Tabela: ${rotulo}`}
			className="dense-table-region hidden rounded-xl border border-border bg-card @2xl:block"
		>
			{children}
		</section>
	);
}

export interface CartaoListaProps {
	/** Registro inativo: borda tracejada e conteúdo esmaecido. */
	inativo?: boolean;
	children: ReactNode;
}

/** Item de `ListaCards` (borda fina, sem sombra). */
export function CartaoLista({ inativo = false, children }: CartaoListaProps) {
	return (
		<li
			className={cardClassName({
				inactive: inativo,
				className: "flex flex-col gap-2.5 p-3",
			})}
		>
			{children}
		</li>
	);
}

/** Linha de cima do card: título à esquerda e destaque (ex.: valor) à direita. */
export function CartaoListaTopo({
	titulo,
	destaque,
}: {
	titulo: ReactNode;
	destaque?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5">{titulo}</div>
			{destaque && <div className="shrink-0">{destaque}</div>}
		</div>
	);
}

/** Linha de botões no rodapé do card, separada por uma borda fina. */
export function CartaoListaAcoes({ children }: { children: ReactNode }) {
	return (
		<div className="flex items-center gap-2 border-t border-border pt-2.5">
			{children}
		</div>
	);
}
