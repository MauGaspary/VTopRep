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
			className="fixed right-4 bottom-20 md:bottom-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow-lg transition-colors z-50"
		>
			{isLoading ? "Populando..." : "👾 Popular Banco de Dados"}
		</button>
	);
}
