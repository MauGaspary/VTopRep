import { describe, expect, it } from "vitest";
import {
	ESTADO_ARMAZENAMENTO_DESCONHECIDO,
	formatarBytes,
	percentualUsado,
} from "./armazenamento";

describe("formatarBytes", () => {
	it("usa base 1024 com uma casa decimal em pt-BR", () => {
		expect(formatarBytes(0)).toBe("0 B");
		expect(formatarBytes(512)).toBe("512 B");
		expect(formatarBytes(1536)).toBe("1,5 KB");
		expect(formatarBytes(3.25 * 1024 * 1024)).toBe("3,3 MB");
		expect(formatarBytes(2 * 1024 ** 3)).toBe("2 GB");
	});

	it("valores inválidos viram 0 B", () => {
		expect(formatarBytes(-1)).toBe("0 B");
		expect(formatarBytes(Number.NaN)).toBe("0 B");
	});
});

describe("percentualUsado", () => {
	it("calcula o uso da cota limitado a 0–100", () => {
		const estado = {
			...ESTADO_ARMAZENAMENTO_DESCONHECIDO,
			suportado: true,
			usadoBytes: 25,
			cotaBytes: 100,
		};
		expect(percentualUsado(estado)).toBe(25);
		expect(percentualUsado({ ...estado, usadoBytes: 150 })).toBe(100);
	});

	it("sem estimativa ou cota zero devolve null", () => {
		expect(percentualUsado(ESTADO_ARMAZENAMENTO_DESCONHECIDO)).toBeNull();
		expect(
			percentualUsado({
				...ESTADO_ARMAZENAMENTO_DESCONHECIDO,
				usadoBytes: 10,
				cotaBytes: 0,
			}),
		).toBeNull();
	});
});
