import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { TenantProvider } from "./config/tenant/TenantContext";
import { useTenant } from "./config/tenant/useTenant";
import { ClienteFormView } from "./modules/clientes/components/cliente-form-view";
import { ClientesListView } from "./modules/clientes/components/clientes-list-view";
import { CatalogoView } from "./modules/produtos/components/catalogo-view";
import { ProdutoFormView } from "./modules/produtos/components/produto-form-view";
import { RepresentadaFormView } from "./modules/representadas/components/representada-form-view";
import { RepresentadasListView } from "./modules/representadas/components/representadas-list-view";
import { DevSeedButton } from "./shared/components/dev/DevSeedButton";
import { Header } from "./shared/components/layout/Header";

function AppRoutes() {
	const { config } = useTenant();

	return (
		<div className="flex min-h-svh flex-col">
			<Header />
			<main className="flex-1">
				<Routes>
					<Route path="/" element={<Navigate to="/catalogo" replace />} />
					<Route
						path="/catalogo"
						element={<CatalogoView tenantId={config.id} />}
					/>
					<Route
						path="/produtos"
						element={<Navigate to="/catalogo" replace />}
					/>
					<Route path="/produtos/novo" element={<ProdutoFormView />} />
					<Route path="/produtos/:id/editar" element={<ProdutoFormView />} />
					<Route path="/representadas" element={<RepresentadasListView />} />
					<Route
						path="/representadas/nova"
						element={<RepresentadaFormView />}
					/>
					<Route
						path="/representadas/:id/editar"
						element={<RepresentadaFormView />}
					/>
					<Route path="/clientes" element={<ClientesListView />} />
					<Route path="/clientes/novo" element={<ClienteFormView />} />
					<Route path="/clientes/:id/editar" element={<ClienteFormView />} />
					<Route path="*" element={<Navigate to="/catalogo" replace />} />
				</Routes>
			</main>
			<DevSeedButton tenantId={config.id} />
		</div>
	);
}

export default function App() {
	return (
		<TenantProvider>
			<BrowserRouter>
				<AppRoutes />
			</BrowserRouter>
		</TenantProvider>
	);
}
