import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { CnpjDuplicadoError } from "../domain/representada";
import type { Representada } from "../domain/representada.schema";
import { REGRAS_FRETE } from "../domain/representada.schema";
import {
	type RepresentadaFormErros,
	type RepresentadaFormValues,
	ROTULOS_FRETE,
	validarFormularioRepresentada,
	valoresIniciaisFormulario,
} from "../domain/representada-form";
import {
	useRepresentada,
	useRepresentadaActions,
} from "../hooks/use-representadas";

/** Rota /representadas/nova e /representadas/:id/editar */
export function RepresentadaFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { representada, isLoading } = useRepresentada(config.id, id);

	if (id && isLoading) {
		return (
			<p className="p-6 text-center text-muted-foreground">Carregando...</p>
		);
	}

	if (id && !representada) {
		return (
			<section className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
				<p className="text-foreground">Representada não encontrada.</p>
				<Link to="/representadas" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</section>
		);
	}

	// `key` reinicia o estado do formulário ao trocar de registro.
	return (
		<RepresentadaForm
			key={representada?.id ?? "nova"}
			tenantId={config.id}
			representada={representada ?? undefined}
		/>
	);
}

interface RepresentadaFormProps {
	tenantId: string;
	representada?: Representada;
}

function RepresentadaForm({ tenantId, representada }: RepresentadaFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar } = useRepresentadaActions(tenantId);
	const [valores, setValores] = useState<RepresentadaFormValues>(() =>
		valoresIniciaisFormulario(representada),
	);
	const [erros, setErros] = useState<RepresentadaFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [salvando, setSalvando] = useState(false);

	const editando = representada !== undefined;

	const alterar = (campo: keyof RepresentadaFormValues, valor: string) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		setErros((atual) => ({ ...atual, [campo]: undefined }));
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErroGeral(null);

		const resultado = validarFormularioRepresentada(valores);
		if (!resultado.success) {
			setErros(resultado.erros);
			return;
		}

		setSalvando(true);
		try {
			if (representada) {
				await atualizar(representada.id, resultado.data);
			} else {
				await criar(resultado.data);
			}
			navigate("/representadas");
		} catch (err) {
			if (err instanceof CnpjDuplicadoError) {
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else {
				setErroGeral(
					err instanceof Error ? err.message : "Erro ao salvar representada",
				);
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<section className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
			<div>
				<Link
					to="/representadas"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Representadas
				</Link>
				<h1 className="mt-1 text-2xl font-semibold text-foreground">
					{editando ? "Editar representada" : "Nova representada"}
				</h1>
			</div>

			<form
				noValidate
				onSubmit={handleSubmit}
				className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
			>
				<Campo
					id="nome_fantasia"
					label="Nome fantasia"
					erro={erros.nome_fantasia}
				>
					<input
						id="nome_fantasia"
						value={valores.nome_fantasia}
						onChange={(e) => alterar("nome_fantasia", e.target.value)}
						autoComplete="off"
						className={classeInput(erros.nome_fantasia)}
					/>
				</Campo>

				<Campo id="razao_social" label="Razão social" erro={erros.razao_social}>
					<input
						id="razao_social"
						value={valores.razao_social}
						onChange={(e) => alterar("razao_social", e.target.value)}
						autoComplete="off"
						className={classeInput(erros.razao_social)}
					/>
				</Campo>

				<Campo id="cnpj" label="CNPJ" erro={erros.cnpj}>
					<input
						id="cnpj"
						value={valores.cnpj}
						onChange={(e) => alterar("cnpj", e.target.value)}
						placeholder="00.000.000/0000-00"
						autoComplete="off"
						maxLength={18}
						className={`${classeInput(erros.cnpj)} font-mono uppercase`}
					/>
				</Campo>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Campo
						id="percentual_comissao"
						label="Comissão padrão (%)"
						erro={erros.percentual_comissao}
					>
						<input
							id="percentual_comissao"
							value={valores.percentual_comissao}
							onChange={(e) => alterar("percentual_comissao", e.target.value)}
							inputMode="decimal"
							placeholder="5,00"
							className={classeInput(erros.percentual_comissao)}
						/>
					</Campo>

					<Campo
						id="valor_pedido_minimo"
						label="Pedido mínimo (R$)"
						erro={erros.valor_pedido_minimo}
						ajuda="Informativo. Deixe vazio se não houver."
					>
						<input
							id="valor_pedido_minimo"
							value={valores.valor_pedido_minimo}
							onChange={(e) => alterar("valor_pedido_minimo", e.target.value)}
							inputMode="decimal"
							placeholder="0,00"
							className={classeInput(erros.valor_pedido_minimo)}
						/>
					</Campo>
				</div>

				<Campo
					id="regras_frete_padrao"
					label="Frete padrão"
					erro={erros.regras_frete_padrao}
				>
					<select
						id="regras_frete_padrao"
						value={valores.regras_frete_padrao}
						onChange={(e) => alterar("regras_frete_padrao", e.target.value)}
						className={classeInput(erros.regras_frete_padrao)}
					>
						{REGRAS_FRETE.map((regra) => (
							<option key={regra} value={regra}>
								{ROTULOS_FRETE[regra]}
							</option>
						))}
					</select>
				</Campo>

				{erroGeral && (
					<p
						role="alert"
						className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						{erroGeral}
					</p>
				)}

				<div className="flex justify-end gap-2 pt-2">
					<Link
						to="/representadas"
						className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						Cancelar
					</Link>
					<button
						type="submit"
						disabled={salvando}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{salvando ? "Salvando..." : "Salvar"}
					</button>
				</div>
			</form>
		</section>
	);
}

function classeInput(erro: string | undefined): string {
	return `w-full rounded-lg border bg-background px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${
		erro ? "border-destructive" : "border-input"
	}`;
}

interface CampoProps {
	id: string;
	label: string;
	erro?: string;
	ajuda?: string;
	children: React.ReactNode;
}

function Campo({ id, label, erro, ajuda, children }: CampoProps) {
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-sm font-medium text-foreground">
				{label}
			</label>
			{children}
			{erro ? (
				<span role="alert" className="text-xs text-destructive">
					{erro}
				</span>
			) : (
				ajuda && <span className="text-xs text-muted-foreground">{ajuda}</span>
			)}
		</div>
	);
}
