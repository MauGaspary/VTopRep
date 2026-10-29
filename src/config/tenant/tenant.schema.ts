import { z } from "zod";

export const tenantConfigSchema = z.object({
	id: z.string().uuid(),
	slug: z.string().min(1),
	empresa: z.object({
		nomeFantasia: z.string().min(1),
		razaoSocial: z.string().min(1),
		cnpj: z.string().min(1),
		telefone: z.string().optional(),
	}),
	visual: z.object({
		logoUrl: z.string().url().optional(),
		primaryColorHsl: z.string().optional(),
		secondaryColorHsl: z.string().optional(),
	}),
});

export type TenantConfig = z.infer<typeof tenantConfigSchema>;
