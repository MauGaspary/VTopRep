import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";

/** Centésimos de % (1500 = 15,00%). Informativo nesta fase (trava no BACKLOG). */
const DescontoMaximoPermitidoSchema = z
	.number()
	.int("Desconto máximo deve ser um inteiro em centésimos de percentual")
	.min(0, "Desconto máximo não pode ser negativo")
	.max(CEM_POR_CENTO_CENTESIMOS, "Desconto máximo não pode exceder 100%");

const PrecoBaseCentavosSchema = z
	.number()
	.int("Preço deve ser um inteiro em centavos")
	.nonnegative("Preço não pode ser negativo");

export const ItemPrecoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		tabela_id: z.string().uuid(),
		produto_id: z.string().uuid(),
		preco_base_centavos: PrecoBaseCentavosSchema,
		desconto_maximo_permitido: DescontoMaximoPermitidoSchema.default(0),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ItemPreco = z.infer<typeof ItemPrecoSchema>;

/** Preço de um produto numa tabela, como informado no cadastro do produto. */
export const PrecoProdutoInputSchema = z.object({
	tabela_id: z.string().uuid("Tabela de preço inválida"),
	/** `null` = produto sem preço nesta tabela (remove o preço existente). */
	preco_base_centavos: PrecoBaseCentavosSchema.nullable(),
	desconto_maximo_permitido: DescontoMaximoPermitidoSchema.default(0),
});

export type PrecoProdutoInput = z.input<typeof PrecoProdutoInputSchema>;
export type PrecoProdutoInputValidado = z.output<
	typeof PrecoProdutoInputSchema
>;
