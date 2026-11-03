import { z } from "zod";
import { isCnpjValido, normalizarCnpj } from "../../../shared/domain/cnpj";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

const CnpjNormalizadoSchema = z
	.string()
	.regex(/^[A-Z0-9]{12}\d{2}$/, "CNPJ deve conter 14 caracteres")
	.refine(isCnpjValido, "CNPJ inválido");

/** Texto opcional: espaços são removidos e vazio vira `null`. */
const TextoOpcionalSchema = z
	.string()
	.trim()
	.nullish()
	.transform((v) => (v && v.length > 0 ? v : null));

/** Entidade persistida (Dexie / Supabase). */
export const TransportadoraSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		nome_fantasia: z.string().trim().min(1, "Nome fantasia é obrigatório"),
		razao_social: z.string().trim().min(1).nullable(),
		/** Normalizado. Opcional, mas quando informado é único no tenant (bloqueante). */
		cnpj: CnpjNormalizadoSchema.nullable(),
		telefone: z.string().trim().min(1).nullable(),
		/** Praça de atendimento / sede, ex.: `Caxias do Sul/RS`. */
		cidade_uf: z.string().trim().min(1).nullable(),
		/** Estado de negócio (reversível). Inativas aparecem na lista de inativas. */
		ativo: z.boolean(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Transportadora = z.infer<typeof TransportadoraSchema>;

/** Dados editáveis pelo usuário. O CNPJ (se houver) é normalizado antes da validação. */
export const TransportadoraInputSchema = z.object({
	nome_fantasia: TransportadoraSchema.shape.nome_fantasia,
	razao_social: TextoOpcionalSchema,
	cnpj: z
		.string()
		.nullish()
		.transform((v) => {
			const normalizado = normalizarCnpj(v ?? "");
			return normalizado.length > 0 ? normalizado : null;
		})
		.pipe(CnpjNormalizadoSchema.nullable()),
	telefone: TextoOpcionalSchema,
	cidade_uf: TextoOpcionalSchema,
});

export type TransportadoraInput = z.input<typeof TransportadoraInputSchema>;
export type TransportadoraInputValidado = z.output<
	typeof TransportadoraInputSchema
>;
