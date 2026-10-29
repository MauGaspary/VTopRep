import { Factory } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	cardClassName,
	EmptyState,
	FormField,
	InactiveRecoveryCard,
	Input,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	ProdutoInativoExistenteError,
	SkuDuplicadoError,
} from "../domain/produto";
import { type Produto, UNIDADES_MEDIDA_PADRAO } from "../domain/produto.schema";
import {
	type ProdutoFormErros,
	type ProdutoFormValues,
	validarFormularioProduto,
	valoresIniciaisProdutoForm,
} from "../domain/produto-form";
import { useProduto, useProdutoActions } from "../hooks/use-produtos";

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
			<Page width="narrow">
				<p className="text-foreground">Produto não encontrado.</p>
				<Link to="/catalogo" className="text-sm text-primary underline">
					Voltar para o catálogo
				</Link>
			</Page>
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
		valoresIniciaisProdutoForm(produto, defaultRepId),
	);
	const [erros, setErros] = useState<ProdutoFormErros>({});
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
			setErroGeral(mensagemDeErro(err, "Erro ao reativar produto"));
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setErroGeral(null);
		setInativoConflitante(null);

		const validacao = validarFormularioProduto(valores);
		if (!validacao.success) {
			setErros(validacao.erros);
			setErroGeral(validacao.geral);
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
				setErroGeral(mensagemDeErro(err, "Erro ao salvar produto"));
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Page width="narrow">
			<PageHeader
				title={editando ? "Editar produto" : "Novo produto"}
				back={{ to: "/catalogo", label: "Catálogo" }}
			/>

			{representadas.length === 0 ? (
				<EmptyState
					icon={Factory}
					title="Nenhuma representada ativa cadastrada"
					description="É obrigatório vincular o produto a uma representada."
					action={
						<Link to="/representadas/nova" className={buttonClassName()}>
							Cadastrar representada
						</Link>
					}
				/>
			) : (
				<form
					noValidate
					onSubmit={handleSubmit}
					className={cardClassName({
						className: "flex flex-col gap-5 p-4 md:p-6",
					})}
				>
					<FormField
						id="representada_id"
						label="Representada vinculada"
						error={erros.representada_id}
						required
					>
						<Select
							id="representada_id"
							value={valores.representada_id}
							onChange={(e) => alterar("representada_id", e.target.value)}
							hasError={Boolean(erros.representada_id)}
						>
							<option value="">Selecione a representada...</option>
							{representadas.map((r) => (
								<option key={r.id} value={r.id}>
									{r.nome_fantasia}
								</option>
							))}
						</Select>
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
									{UNIDADES_MEDIDA_PADRAO.map((unidade) => {
										const selecionada =
											valores.unidade_medida.toUpperCase() === unidade;
										return (
											<button
												key={unidade}
												type="button"
												aria-pressed={selecionada}
												onClick={() => alterar("unidade_medida", unidade)}
												className="cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
											>
												<Badge variant={selecionada ? "default" : "outline"}>
													{unidade}
												</Badge>
											</button>
										);
									})}
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
								inputMode="numeric"
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

					<div className="flex justify-end gap-2 border-t border-border pt-4">
						<Link
							to="/catalogo"
							className={buttonClassName({ variant: "ghost" })}
						>
							Cancelar
						</Link>
						<Button type="submit" disabled={salvando}>
							{salvando ? "Salvando..." : "Salvar produto"}
						</Button>
					</div>
				</form>
			)}
		</Page>
	);
}
