export class TenantDivergenteError extends Error {
	constructor() {
		super("Operação não permitida: registro pertence a outro tenant");
		this.name = "TenantDivergenteError";
	}
}

/** Lança `TenantDivergenteError` se o registro não pertencer ao tenant informado. */
export function garantirMesmoTenant(
	registro: { tenant_id: string },
	tenantId: string,
): void {
	if (registro.tenant_id !== tenantId) {
		throw new TenantDivergenteError();
	}
}
