import { useState } from "react";
import { db } from "../../../db/database";
import { seedDatabase } from "../../../db/seed";

interface DevSeedButtonProps {
	tenantId: string;
}

export function DevSeedButton({ tenantId }: DevSeedButtonProps) {
	const [isLoading, setIsLoading] = useState(false);

	if (!import.meta.env.DEV) {
		return null;
	}

	const handleSeed = async () => {
		setIsLoading(true);
		try {
			await seedDatabase(db, tenantId);
			alert("Banco populado com dados falsos!");
		} catch (error) {
			console.error("Erro ao popular o banco:", error);
			alert("Erro ao popular o banco de dados.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleSeed}
			disabled={isLoading}
			className="fixed top-14 right-2 z-50 rounded bg-purple-600 px-2 py-1 text-xs font-bold text-white shadow-lg transition-colors hover:bg-purple-700 lg:top-auto lg:right-4 lg:bottom-4 lg:px-4 lg:py-2 lg:text-sm"
		>
			{isLoading ? "…" : "👾"}
			<span className="max-lg:sr-only">
				{isLoading ? " Populando..." : " Popular Banco de Dados"}
			</span>
		</button>
	);
}
