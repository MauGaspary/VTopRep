import { z } from "zod";

/** Modalidades de frete aceitas tanto na representada (padrão) quanto no pedido. */
export const TIPOS_FRETE = ["CIF", "FOB", "FOB_REDESPACHO"] as const;

export const TipoFreteSchema = z.enum(TIPOS_FRETE, {
	error: "Selecione um tipo de frete válido",
});

export type TipoFrete = z.infer<typeof TipoFreteSchema>;

export const ROTULOS_FRETE: Record<TipoFrete, string> = {
	CIF: "CIF (frete pago pela fábrica)",
	FOB: "FOB (frete pago pelo cliente)",
	FOB_REDESPACHO: "FOB Redespacho",
};
