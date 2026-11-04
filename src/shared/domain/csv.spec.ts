import { describe, expect, it } from "vitest";
import {
	BOM,
	decodificarCsv,
	detectarSeparadorCsv,
	lerCsv,
	parseCsv,
} from "./csv";

const utf8 = (texto: string) => new TextEncoder().encode(texto);

describe("decodificarCsv", () => {
	it("lê UTF-8 e remove o BOM", () => {
		const { texto, encoding } = decodificarCsv(utf8(`${BOM}Código;Descrição`));
		expect(encoding).toBe("utf-8");
		expect(texto).toBe("Código;Descrição");
	});

	it("cai para Windows-1252 quando o arquivo não é UTF-8 válido", () => {
		// "Preço;Ação" em Windows-1252: ç = 0xE7, ã = 0xE3
		const bytes = new Uint8Array([
			0x50, 0x72, 0x65, 0xe7, 0x6f, 0x3b, 0x41, 0xe7, 0xe3, 0x6f,
		]);
		const { texto, encoding } = decodificarCsv(bytes);
		expect(encoding).toBe("windows-1252");
		expect(texto).toBe("Preço;Ação");
	});

	it("aceita arquivo vazio", () => {
		expect(decodificarCsv(new Uint8Array()).texto).toBe("");
	});
});

describe("detectarSeparadorCsv", () => {
	it("detecta ponto e vírgula mesmo com vírgula decimal nos valores", () => {
		const texto = "SKU;Descrição;Preço\nA1;Parafuso;1,50\nA2;Porca;2,75\n";
		expect(detectarSeparadorCsv(texto)).toBe(";");
	});

	it("detecta vírgula com valores decimais entre aspas", () => {
		const texto = 'SKU,Descrição,Preço\nA1,Parafuso,"1,50"\nA2,Porca,"2,75"\n';
		expect(detectarSeparadorCsv(texto)).toBe(",");
	});

	it("detecta tabulação", () => {
		expect(detectarSeparadorCsv("SKU\tPreço\nA1\t1,50\n")).toBe("\t");
	});

	it("ignora separadores dentro de aspas", () => {
		const texto = 'SKU;Descrição\nA1;"Caixa, 10 un, azul"\nA2;"Tampa, preta"\n';
		expect(detectarSeparadorCsv(texto)).toBe(";");
	});

	it("usa ponto e vírgula quando não há separador", () => {
		expect(detectarSeparadorCsv("SKU\nA1\n")).toBe(";");
	});
});

describe("parseCsv", () => {
	it("separa linhas e células com CRLF, LF e CR", () => {
		expect(parseCsv("a;b\r\nc;d\ne;f\rg;h", ";")).toEqual([
			["a", "b"],
			["c", "d"],
			["e", "f"],
			["g", "h"],
		]);
	});

	it("trata aspas, aspas duplicadas e quebra de linha dentro de aspas", () => {
		const texto = 'SKU;Descrição\nA1;"Tubo 1/2"" PVC"\nA2;"Linha 1\nLinha 2"\n';
		expect(parseCsv(texto, ";")).toEqual([
			["SKU", "Descrição"],
			["A1", 'Tubo 1/2" PVC'],
			["A2", "Linha 1\nLinha 2"],
		]);
	});

	it("mantém células vazias e linhas vazias no meio, mas descarta as do fim", () => {
		expect(parseCsv("a;;c\n\nd;e;\n\n;;\n", ";")).toEqual([
			["a", "", "c"],
			[""],
			["d", "e", ""],
		]);
	});

	it("mantém aspas no meio de um campo sem aspas", () => {
		expect(parseCsv('Tubo 1/2" PVC;2', ";")).toEqual([['Tubo 1/2" PVC', "2"]]);
	});

	it("retorna lista vazia para texto vazio", () => {
		expect(parseCsv("", ";")).toEqual([]);
	});
});

describe("lerCsv", () => {
	it("decodifica, detecta o separador e lê as linhas", () => {
		const csv = lerCsv(utf8(`${BOM}SKU;Preço\r\nA1;1,50\r\n`));
		expect(csv).toEqual({
			separador: ";",
			encoding: "utf-8",
			linhas: [
				["SKU", "Preço"],
				["A1", "1,50"],
			],
		});
	});

	it("respeita o separador informado", () => {
		expect(lerCsv(utf8("a,b;c"), ",").linhas).toEqual([["a", "b;c"]]);
	});
});
