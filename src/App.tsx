import { CatalogoView } from "./modules/produtos/components/catalogo-view";


const tenantIdMock = "11111111-1111-4111-a111-111111111111";

export default function App() {
	return (
		<div>
			<h1>VinitopRS</h1>

			<CatalogoView tenantId={tenantIdMock} />
		</div>
	);
}
