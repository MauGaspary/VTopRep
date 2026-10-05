import { useContext } from "react";
import { TenantContext } from "./TenantContext";

export function useTenant() {
	const context = useContext(TenantContext);

	if (context === undefined) {
		throw new Error("useTenant must be used within a TenantProvider");
	}

	return context;
}
