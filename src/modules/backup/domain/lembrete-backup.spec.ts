import { describe, expect, it } from "vitest";
import {
	adiarLembreteBackup,
	descreverUltimoBackup,
	deveLembrarBackup,
	diasDesdeUltimoBackup,
	INTERVALO_LEMBRETE_DIAS,
	lerPreferenciasBackup,
	PREFERENCIAS_BACKUP_PADRAO,
	type PreferenciasBackup,
	registrarBackupFeito,
} from "./lembrete-backup";

/** Datas em horário local, como o aparelho do representante. */
const local = (dia: number, hora = 12, minuto = 0) =>
	new Date(2026, 10, dia, hora, minuto);

const comBackupEm = (instante: Date | null): PreferenciasBackup => ({
	ultimo_backup_em: instante ? instante.toISOString() : null,
	lembrete_adiado_ate: null,
});

const lembrar = (
	preferencias: PreferenciasBackup,
	agora: Date,
	extras: { temDados?: boolean; sincronizacaoAtiva?: boolean } = {},
) =>
	deveLembrarBackup({
		preferencias,
		agora,
		temDados: extras.temDados ?? true,
		sincronizacaoAtiva: extras.sincronizacaoAtiva ?? false,
	});

describe("lerPreferenciasBackup", () => {
	it("lê o JSON salvo e cai no padrão se ausente ou inválido", () => {
		const salvo = comBackupEm(local(1));
		expect(lerPreferenciasBackup(JSON.stringify(salvo))).toEqual(salvo);
		expect(lerPreferenciasBackup(null)).toEqual(PREFERENCIAS_BACKUP_PADRAO);
		expect(lerPreferenciasBackup("{quebrado")).toEqual(
			PREFERENCIAS_BACKUP_PADRAO,
		);
		expect(
			lerPreferenciasBackup(JSON.stringify({ ultimo_backup_em: "ontem" })),
		).toEqual(PREFERENCIAS_BACKUP_PADRAO);
	});
});

describe("diasDesdeUltimoBackup", () => {
	it("conta dias de calendário no fuso do aparelho", () => {
		expect(diasDesdeUltimoBackup(null, local(4))).toBeNull();
		expect(
			diasDesdeUltimoBackup(local(4, 0, 5).toISOString(), local(4, 23, 50)),
		).toBe(0);
		// 23h30 de ontem → 0h10 de hoje: já é "ontem", embora < 24 h.
		expect(
			diasDesdeUltimoBackup(local(3, 23, 30).toISOString(), local(4, 0, 10)),
		).toBe(1);
		expect(diasDesdeUltimoBackup(local(1).toISOString(), local(10))).toBe(9);
	});

	it("relógio voltando no tempo não gera dias negativos", () => {
		expect(diasDesdeUltimoBackup(local(10).toISOString(), local(4))).toBe(0);
	});
});

describe("deveLembrarBackup", () => {
	it("lembra quando nunca houve backup e há dados", () => {
		expect(lembrar(comBackupEm(null), local(4))).toBe(true);
	});

	it("não lembra sem dados no aparelho ou com sincronização ativa", () => {
		expect(lembrar(comBackupEm(null), local(4), { temDados: false })).toBe(
			false,
		);
		expect(
			lembrar(comBackupEm(null), local(4), { sincronizacaoAtiva: true }),
		).toBe(false);
	});

	it(`lembra a partir de ${INTERVALO_LEMBRETE_DIAS} dias desde o último backup`, () => {
		const backup = comBackupEm(local(1, 18));
		expect(lembrar(backup, local(7, 23))).toBe(false);
		expect(lembrar(backup, local(8, 8))).toBe(true);
	});

	it("respeita o adiamento até a data marcada", () => {
		const adiado = adiarLembreteBackup(comBackupEm(null), local(4, 10));

		expect(lembrar(adiado, local(4, 18))).toBe(false);
		expect(lembrar(adiado, local(5, 9, 59))).toBe(false);
		expect(lembrar(adiado, local(5, 10, 1))).toBe(true);
	});

	it("registrar backup zera o adiamento e cala o lembrete", () => {
		const adiado = adiarLembreteBackup(comBackupEm(null), local(1));
		const feito = registrarBackupFeito(adiado, local(4, 15));

		expect(feito).toEqual({
			ultimo_backup_em: local(4, 15).toISOString(),
			lembrete_adiado_ate: null,
		});
		expect(lembrar(feito, local(4, 16))).toBe(false);
	});
});

describe("descreverUltimoBackup", () => {
	it("descreve nunca, hoje, ontem e dias", () => {
		expect(descreverUltimoBackup(null, local(4))).toBe(
			"Nenhum backup feito neste aparelho",
		);
		expect(descreverUltimoBackup(local(4, 8).toISOString(), local(4))).toBe(
			"Último backup hoje",
		);
		expect(descreverUltimoBackup(local(3).toISOString(), local(4))).toBe(
			"Último backup ontem",
		);
		expect(descreverUltimoBackup(local(1).toISOString(), local(4))).toBe(
			"Último backup há 3 dias",
		);
	});
});
