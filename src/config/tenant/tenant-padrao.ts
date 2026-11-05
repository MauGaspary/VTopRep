/**
 * Tenant fixo enquanto não há login (TODO 2.11.2). Sem importações: o
 * `vite.config.ts` também lê este arquivo para montar o manifesto do PWA
 * (nome e cor). O `TenantProvider` valida o objeto com `tenantConfigSchema`.
 */
export const TENANT_PADRAO = {
	id: "11111111-1111-4111-a111-111111111111",
	slug: "exemplo",
	empresa: {
		nomeFantasia: "Vinitop RS",
		razaoSocial: "Vinitop RS Ltda",
		cnpj: "00.000.000/0001-00",
		telefone: "(00) 0000-0000",
	},
	visual: {
		primaryColorHsl: "228, 60%, 34%",
		secondaryColorHsl: "214, 26%, 53%",
	},
};
