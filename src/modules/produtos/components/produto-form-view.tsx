import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import {
	Alert,
	Badge,
	Button,
	FormField,
	InactiveRecoveryCard,
	Input,
} from "../../../shared/components/ui";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	ProdutoInativoExistenteError,
	SkuDuplicadoError,
} from "../domain/produto";
import {
	type Produto,
	ProdutoInputSchema,
	UNIDADES_MEDIDA_PADRAO,
} from "../domain/produto.schema";
import { useProduto, useProdutoActions } from "../hooks/use-produtos";

interface ProdutoFormValues {
	representada_id: string;
	sku: string;
	descricao: string;
	unidade_medida: string;
	multiplo_embalagem: string;
}

interface ProdutoFormErrors {
	representada_id?: string;
	sku?: string;
	descricao?: string;
	unidade_medida?: string;
	multiplo_embalagem?: string;
}

function valoresIniciais(
	produto?: Produto,
	defaultRepresentadaId = "",
): ProdutoFormValues {
	if (produto) {
		return {
			representada_id: produto.representada_id,
			sku: produto.sku,
			descricao: produto.descricao,
			unidade_medida: produto.unidade_medida,
			multiplo_embalagem: String(produto.multiplo_embalagem ?? 1),
		};
	}

	return {
		representada_id: defaultRepresentadaId,
		sku: "",
		descricao: "",
		unidade_medida: "UN",
		multiplo_embalagem: "1",
	};
}

export function ProdutoFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { produto, isLoading: carregandoProduto } = useProduto(
		config.id,
		id,
		true,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useRepresentadas(config.id);

	if (id && carregandoProduto) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando produto...
			</p>
		);
	}

	if (id && !produto) {
		return (
			<section className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
				<p className="text-foreground">Produto não encontrado.</p>
				<Link to="/catalogo" className="text-sm text-primary underline">
					Voltar para o catálogo
				</Link>
			</section>
		);
	}

	if (carregandoRepresentadas) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando representadas...
			</p>
		);
	}

	return (
		<ProdutoForm
			key={produto?.id ?? "novo"}
			tenantId={config.id}
			produto={produto ?? undefined}
			representadas={representadas}
		/>
	);
}

interface ProdutoFormProps {
	tenantId: string;
	produto?: Produto;
	representadas: Array<{ id: string; nome_fantasia: string }>;
}

function ProdutoForm({ tenantId, produto, representadas }: ProdutoFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useProdutoActions(tenantId);

	const defaultRepId = representadas.length > 0 ? representadas[0].id : "";

	const [valores, setValores] = useState<ProdutoFormValues>(() =>
		valoresIniciais(produto, defaultRepId),
	);
	const [erros, setErros] = useState<ProdutoFormErrors>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativoConflitante, setInativoConflitante] = useState<Produto | null>(
		null,
	);
	const [salvando, setSalvando] = useState(false);

	const editando = produto !== undefined;

	const alterar = (campo: keyof ProdutoFormValues, valor: string) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		setErros((atual) => ({ ...atual, [campo]: undefined }));
		setInativoConflitante(null);
	};

	const handleReativar = async () => {
		if (!inativoConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativoConflitante.id);
			navigate("/catalogo");
		} catch (err) {
			setErroGeral(
				err instanceof Error ? err.message : "Erro ao reativar produto",
			);
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setErroGeral(null);
		setInativoConflitante(null);

		const multiploNumero =
			valores.multiplo_embalagem.trim() === ""
				? 1
				: Number.parseInt(valores.multiplo_embalagem, 10);

		const validacao = ProdutoInputSchema.safeParse({
			representada_id: valores.representada_id,
			sku: valores.sku,
			descricao: valores.descricao,
			unidade_medida: valores.unidade_medida,
			multiplo_embalagem: Number.isNaN(multiploNumero) ? 1 : multiploNumero,
		});

		if (!validacao.success) {
			const novosErros: ProdutoFormErrors = {};
			for (const issue of validacao.error.issues) {
				const campo = issue.path[0] as keyof ProdutoFormErrors;
				if (campo && !novosErros[campo]) {
					novosErros[campo] = issue.message;
				}
			}
			setErros(novosErros);
			return;
		}

		setSalvando(true);
		try {
			if (editando) {
				await atualizar(produto.id, validacao.data);
			} else {
				await criar(validacao.data);
			}
			navigate("/catalogo");
		} catch (err) {
			if (err instanceof ProdutoInativoExistenteError) {
				setInativoConflitante(err.produtoInativo);
				setErros((atual) => ({ ...atual, sku: err.message }));
			} else if (err instanceof SkuDuplicadoError) {
				setErros((atual) => ({ ...atual, sku: err.message }));
			} else {
				setErroGeral(
					err instanceof Error ? err.message : "Erro ao salvar produto",
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
					to="/catalogo"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Catálogo
				</Link>
				<h1 className="mt-1 text-2xl font-semibold text-foreground">
					{editando ? "Editar produto" : "Novo produto"}
				</h1>
			</div>

			{representadas.length === 0 ? (
				<Alert variant="warning">
					<div className="flex flex-col gap-2">
						<span>
							Nenhuma representada ativa cadastrada. É obrigatório vincular o
							produto a uma representada.
						</span>
						<div>
							<Link to="/representadas/nova">
								<Button size="sm">Cadastrar Representada</Button>
							</Link>
						</div>
					</div>
				</Alert>
			) : (
				<form
					noValidate
					onSubmit={handleSubmit}
					className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
				>
					<FormField
						id="representada_id"
						label="Representada vinculada"
						error={erros.representada_id}
						required
					>
						<select
							id="representada_id"
							value={valores.representada_id}
							onChange={(e) => alterar("representada_id", e.target.value)}
							className={`w-full rounded-lg border bg-background px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-sm ${
								erros.representada_id ? "border-destructive" : "border-input"
							}`}
						>
							<option value="">Selecione a representada...</option>
							{representadas.map((r) => (
								<option key={r.id} value={r.id}>
									{r.nome_fantasia}
								</option>
							))}
						</select>
					</FormField>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="sm:col-span-1">
							<FormField
								id="sku"
								label="Código / SKU"
								error={erros.sku}
								required
							>
								<Input
									id="sku"
									value={valores.sku}
									onChange={(e) => alterar("sku", e.target.value)}
									placeholder="Ex: PROD-001"
									autoComplete="off"
									hasError={Boolean(erros.sku)}
									className="font-mono uppercase"
								/>
							</FormField>
						</div>

						<div className="sm:col-span-2">
							<FormField
								id="descricao"
								label="Descrição do produto"
								error={erros.descricao}
								required
							>
								<Input
									id="descricao"
									value={valores.descricao}
									onChange={(e) => alterar("descricao", e.target.value)}
									placeholder="Ex: Parafuso Sextavado Aço Inox 1/2"
									autoComplete="off"
									hasError={Boolean(erros.descricao)}
								/>
							</FormField>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="unidade_medida"
							label="Unidade de medida"
							error={erros.unidade_medida}
							required
						>
							<div className="flex flex-col gap-2">
								<Input
									id="unidade_medida"
									value={valores.unidade_medida}
									onChange={(e) => alterar("unidade_medida", e.target.value)}
									placeholder="Ex: UN, CX, KG"
									autoComplete="off"
									hasError={Boolean(erros.unidade_medida)}
									className="uppercase"
								/>
								<div className="flex flex-wrap gap-1">
									{UNIDADES_MEDIDA_PADRAO.map((unidade) => (
										<button
											key={unidade}
											type="button"
											onClick={() => alterar("unidade_medida", unidade)}
											className="cursor-pointer"
										>
											<Badge
												variant={
													valores.unidade_medida.toUpperCase() === unidade
														? "default"
														: "outline"
												}
											>
												{unidade}
											</Badge>
										</button>
									))}
								</div>
							</div>
						</FormField>

						<FormField
							id="multiplo_embalagem"
							label="Múltiplo de embalagem"
							error={erros.multiplo_embalagem}
							help="Quantidade mínima de venda por fardo/caixa (padrão: 1)"
						>
							<Input
								id="multiplo_embalagem"
								type="number"
								min={1}
								step={1}
								value={valores.multiplo_embalagem}
								onChange={(e) => alterar("multiplo_embalagem", e.target.value)}
								hasError={Boolean(erros.multiplo_embalagem)}
							/>
						</FormField>
					</div>

					{inativoConflitante && (
						<InactiveRecoveryCard
							title="Produto inativo encontrado com este SKU:"
							entityName={`${inativoConflitante.sku} - ${inativoConflitante.descricao}`}
							onReativar={handleReativar}
							isLoading={salvando}
						/>
					)}

					{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

					<div className="flex justify-end gap-2 pt-2">
						<Link to="/catalogo">
							<Button variant="ghost">Cancelar</Button>
						</Link>
						<Button type="submit" disabled={salvando}>
							{salvando ? "Salvando..." : "Salvar Produto"}
						</Button>
					</div>
				</form>
			)}
		</section>
	);
}
