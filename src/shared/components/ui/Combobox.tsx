import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	calcularIndiceDestacadoCombobox,
	filtrarOpcoesCombobox,
	type OpcaoCombobox,
} from "../../domain/combobox";
import { type FieldSize, fieldClassName } from "./Input";

export type { OpcaoCombobox };

export interface ComboboxFooterAction {
	label: string | ((termoDigitado: string) => string);
	onAction: (termoDigitado: string) => void;
}

export interface ComboboxProps<T = unknown> {
	id?: string;
	name?: string;
	value: string;
	onChange: (value: string) => void;
	options: readonly OpcaoCombobox<T>[];
	placeholder?: string;
	emptyMessage?: string;
	disabled?: boolean;
	hasError?: boolean;
	size?: FieldSize;
	/** Quando verdadeiro, permite digitar texto livre usando as opções apenas como sugestões. */
	allowCustomValue?: boolean;
	/** Renderização opcional customizada para o item na lista. */
	renderOption?: (
		option: OpcaoCombobox<T>,
		state: { selected: boolean; highlighted: boolean },
	) => ReactNode;
	/** Ação fixa exibida no rodapé do menu (ex.: "+ Cadastrar novo cliente"). */
	footerAction?: ComboboxFooterAction;
	className?: string;
}

export function Combobox<T = unknown>({
	id,
	name,
	value,
	onChange,
	options,
	placeholder = "Digite para buscar...",
	emptyMessage = "Nenhuma opção encontrada.",
	disabled = false,
	hasError = false,
	size = "md",
	allowCustomValue = false,
	renderOption,
	footerAction,
	className = "",
}: ComboboxProps<T>) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const listboxId = `${inputId}-listbox`;

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const opcaoSelecionada = useMemo(
		() => options.find((o) => o.id === value),
		[options, value],
	);

	const [aberto, setAberto] = useState(false);
	const [busca, setBusca] = useState("");
	const [indiceDestacado, setIndiceDestacado] = useState(0);

	// Texto exibido no input quando fechado vs aberto
	const valorInput = aberto
		? allowCustomValue
			? value
			: busca
		: allowCustomValue
			? value
			: (opcaoSelecionada?.label ?? "");

	const opcoesFiltradas = useMemo(() => {
		const termo = allowCustomValue ? value : busca;
		return filtrarOpcoesCombobox(options, termo);
	}, [options, allowCustomValue, value, busca]);

	// Fecha ao clicar fora do container
	useEffect(() => {
		if (!aberto) return;
		const handlePointerDown = (e: MouseEvent) => {
			if (
				containerRef.current &&
				e.target instanceof Node &&
				!containerRef.current.contains(e.target)
			) {
				setAberto(false);
				setBusca("");
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [aberto]);

	const abrirMenu = () => {
		if (disabled) return;
		setAberto(true);
		setBusca("");
		setIndiceDestacado(0);
	};

	const selecionarOpcao = (opcao: OpcaoCombobox<T>) => {
		onChange(opcao.id);
		setAberto(false);
		setBusca("");
	};

	const limparSelecao = () => {
		if (disabled) return;
		onChange("");
		setBusca("");
		setAberto(true);
		setIndiceDestacado(0);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!aberto) {
				abrirMenu();
				return;
			}
			setIndiceDestacado((atual) =>
				calcularIndiceDestacadoCombobox(
					atual,
					opcoesFiltradas.length,
					"proximo",
				),
			);
			return;
		}

		if (e.key === "ArrowUp") {
			e.preventDefault();
			if (!aberto) {
				abrirMenu();
				return;
			}
			setIndiceDestacado((atual) =>
				calcularIndiceDestacadoCombobox(
					atual,
					opcoesFiltradas.length,
					"anterior",
				),
			);
			return;
		}

		if (e.key === "Enter" && aberto) {
			const destacada = opcoesFiltradas[indiceDestacado];
			if (destacada) {
				e.preventDefault();
				selecionarOpcao(destacada);
				return;
			}
			if (!allowCustomValue && footerAction) {
				e.preventDefault();
				const termoAtual = busca.trim();
				setAberto(false);
				setBusca("");
				footerAction.onAction(termoAtual);
			}
			return;
		}

		if (e.key === "Escape" && aberto) {
			e.preventDefault();
			setAberto(false);
			setBusca("");
		}
	};

	const termoParaFooter = (allowCustomValue ? value : busca).trim();
	const rotuloFooter = footerAction
		? typeof footerAction.label === "function"
			? footerAction.label(termoParaFooter)
			: footerAction.label
		: null;

	return (
		<div ref={containerRef} className={`relative w-full ${className}`}>
			{name && <input type="hidden" name={name} value={value} />}

			<div className="relative flex items-center">
				<input
					ref={inputRef}
					id={inputId}
					type="text"
					role="combobox"
					aria-expanded={aberto}
					aria-controls={listboxId}
					aria-autocomplete="list"
					autoComplete="off"
					disabled={disabled}
					value={valorInput}
					placeholder={
						aberto && opcaoSelecionada && !allowCustomValue
							? `${opcaoSelecionada.label} (digite para filtrar...)`
							: placeholder
					}
					onFocus={() => {
						if (!aberto) {
							abrirMenu();
						}
					}}
					onChange={(e) => {
						const novoTexto = e.target.value;
						if (!aberto) {
							setAberto(true);
						}
						if (allowCustomValue) {
							onChange(novoTexto);
						} else {
							setBusca(novoTexto);
						}
						setIndiceDestacado(0);
					}}
					onKeyDown={handleKeyDown}
					className={`w-full pr-14 ${fieldClassName(hasError, size)}`}
				/>

				<div className=" absolute right-1.5 flex items-center gap-0.5">
					{value !== "" && !disabled && (
						<button
							type="button"
							tabIndex={-1}
							onClick={limparSelecao}
							title="Limpar seleção"
							aria-label="Limpar seleção"
							className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<X aria-hidden="true" className="size-3.5" />
						</button>
					)}
					<button
						type="button"
						tabIndex={-1}
						disabled={disabled}
						onClick={() => {
							if (aberto) {
								setAberto(false);
								setBusca("");
							} else {
								abrirMenu();
								inputRef.current?.focus();
							}
						}}
						aria-label="Alternar lista de opções"
						className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
					>
						<ChevronsUpDown aria-hidden="true" className="size-3.5" />
					</button>
				</div>
			</div>

			{aberto && !disabled && (
				<div className="absolute top-full left-0 z-40 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
					<div
						id={listboxId}
						role="listbox"
						aria-label={placeholder}
						className="flex-1 overflow-y-auto p-1"
					>
						{opcoesFiltradas.length === 0 ? (
							<p className="px-3 py-3 text-center text-xs text-muted-foreground">
								{emptyMessage}
							</p>
						) : (
							opcoesFiltradas.map((opcao, idx) => {
								const selecionada = opcao.id === value;
								const destacada = idx === indiceDestacado;

								return (
									<div
										key={opcao.id}
										role="option"
										tabIndex={-1}
										aria-selected={selecionada}
										onMouseEnter={() => setIndiceDestacado(idx)}
										onMouseDown={(e) => {
											// Evita que o input perca foco antes da seleção
											e.preventDefault();
											selecionarOpcao(opcao);
										}}
										className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
											destacada
												? "bg-muted text-foreground"
												: "text-foreground hover:bg-muted/60"
										}`}
									>
										{renderOption ? (
											renderOption(opcao, {
												selected: selecionada,
												highlighted: destacada,
											})
										) : (
											<div className="min-w-0 flex-1">
												<div className="truncate font-medium text-foreground">
													{opcao.label}
												</div>
												{opcao.sublabel && (
													<div className="truncate text-[11px] text-muted-foreground">
														{opcao.sublabel}
													</div>
												)}
											</div>
										)}
										{selecionada && (
											<Check
												aria-hidden="true"
												className="size-3.5 shrink-0 text-primary"
											/>
										)}
									</div>
								);
							})
						)}
					</div>

					{footerAction && rotuloFooter && (
						<div className="border-t border-border bg-muted/40 p-1">
							<button
								type="button"
								onMouseDown={(e) => {
									e.preventDefault();
									const termoAtual = termoParaFooter;
									setAberto(false);
									setBusca("");
									footerAction.onAction(termoAtual);
								}}
								className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
							>
								<Plus aria-hidden="true" className="size-3.5 shrink-0" />
								<span className="truncate">{rotuloFooter}</span>
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
