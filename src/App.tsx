import { TenantProvider } from "./config/tenant/TenantContext";
import { CatalogoView } from "./modules/produtos/components/catalogo-view";
import { DevSeedButton } from "./shared/components/dev/DevSeedButton";
import { Header } from "./shared/components/layout/Header";

const tenantIdMock = "11111111-1111-4111-a111-111111111111";

export default function App() {
	return (
		<TenantProvider>
			<div>
				<Header />
				<main style={{ padding: "1rem" }}>
					<CatalogoView tenantId={tenantIdMock} />

					<DevSeedButton tenantId={tenantIdMock} />
				</main>
			</div>
		</TenantProvider>
	);
}
