import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { TemaProvider } from "./config/tema/TemaContext";
import { TenantProvider } from "./config/tenant/TenantContext";
import { useTenant } from "./config/tenant/useTenant";
import { ClienteFormView } from "./modules/clientes/components/cliente-form-view";
import { ClientesListView } from "./modules/clientes/components/clientes-list-view";
import { ImportarCsvView } from "./modules/importacao/components/importar-csv-view";
import { HistoricoClienteView } from "./modules/pedidos/components/historico-cliente-view";
import { OrcamentoFormView } from "./modules/pedidos/components/orcamento-form-view";
import { PedidosListView } from "./modules/pedidos/components/pedidos-list-view";
import { CatalogoView } from "./modules/produtos/components/catalogo-view";
import { ProdutoFormView } from "./modules/produtos/components/produto-form-view";
import { ReajusteTabelaView } from "./modules/produtos/components/reajuste-tabela-view";
import { RepresentadaFormView } from "./modules/representadas/components/representada-form-view";
import { RepresentadasListView } from "./modules/representadas/components/representadas-list-view";
import { TransportadoraFormView } from "./modules/transportadoras/components/transportadora-form-view";
import { TransportadorasListView } from "./modules/transportadoras/components/transportadoras-list-view";
import { DevSeedButton } from "./shared/components/dev/DevSeedButton";
import { AppShell } from "./shared/components/layout/AppShell";

function AppRoutes() {
	const { config } = useTenant();

	return (
		<AppShell>
			<Routes>
				<Route path="/" element={<Navigate to="/catalogo" replace />} />
				<Route path="/pedidos" element={<PedidosListView />} />
				<Route path="/pedidos/novo" element={<OrcamentoFormView />} />
				<Route path="/pedidos/:id" element={<OrcamentoFormView />} />
				<Route
					path="/catalogo"
					element={<CatalogoView tenantId={config.id} />}
				/>
				<Route path="/catalogo/novo" element={<ProdutoFormView />} />
				<Route path="/catalogo/importar" element={<ImportarCsvView />} />
				<Route path="/catalogo/:id/editar" element={<ProdutoFormView />} />
				<Route path="/produtos" element={<Navigate to="/catalogo" replace />} />
				<Route path="/produtos/novo" element={<ProdutoFormView />} />
				<Route path="/produtos/:id/editar" element={<ProdutoFormView />} />
				<Route path="/representadas" element={<RepresentadasListView />} />
				<Route path="/representadas/nova" element={<RepresentadaFormView />} />
				<Route
					path="/representadas/:id/editar"
					element={<RepresentadaFormView />}
				/>
				<Route
					path="/representadas/:id/reajuste"
					element={<ReajusteTabelaView />}
				/>
				<Route path="/transportadoras" element={<TransportadorasListView />} />
				<Route
					path="/transportadoras/nova"
					element={<TransportadoraFormView />}
				/>
				<Route
					path="/transportadoras/:id/editar"
					element={<TransportadoraFormView />}
				/>
				<Route path="/clientes" element={<ClientesListView />} />
				<Route path="/clientes/novo" element={<ClienteFormView />} />
				<Route path="/clientes/:id/editar" element={<ClienteFormView />} />
				<Route
					path="/clientes/:id/pedidos"
					element={<HistoricoClienteView />}
				/>
				<Route path="*" element={<Navigate to="/catalogo" replace />} />
			</Routes>
			<DevSeedButton tenantId={config.id} />
		</AppShell>
	);
}

export default function App() {
	return (
		<TemaProvider>
			<TenantProvider>
				<BrowserRouter>
					<AppRoutes />
				</BrowserRouter>
			</TenantProvider>
		</TemaProvider>
	);
}
