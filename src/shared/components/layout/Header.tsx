import { useTenant } from "../../../config/tenant/useTenant";

export function Header() {
	const { config } = useTenant();

	return (
		<header
			style={{
				padding: "1rem",
				backgroundColor: "#f3f4f6",
				borderBottom: "1px solid #e5e7eb",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<h2>{config.empresa.nomeFantasia}</h2>
				<span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
					CNPJ: {config.empresa.cnpj}
				</span>
			</div>
		</header>
	);
}
