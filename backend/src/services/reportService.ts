import { dailyReportRepository } from '../repositories/dailyReportRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { userRepository } from '../repositories/userRepository';
import { getDayBounds, formatDateString, getCurrentYearMonth, zonedDateTimeToUtc } from '../utils/timezone';
import { secondsToHours } from './channelClassifier';
import { config } from '../config/env';
import { Types } from 'mongoose';

/**
 * Resumo de horas agregadas para relatórios.
 */
export interface HoursReport {
  date?: string;
  year?: number;
  month?: number;
  timezone: string;
  productiveHours: number;
  voiceHours: number;
  idleHours: number;
  offlineHours: number;
  afkHours: number;
  lunchHours: number;
}

/**
 * Item de ranking por tempo produtivo.
 */
export interface RankingItem {
  userId: string;
  username: string;
  displayName: string;
  productiveHours: number;
  voiceHours: number;
}

/**
 * Serviço de geração e agregação de relatórios.
 */
export const reportService = {
  /**
   * Gera/atualiza relatórios diários para todos os usuários com sessões no dia.
   * @param date Data de referência
   */
  async generateDailyReports(date: Date): Promise<void> {
    const { start, end } = getDayBounds(date);

    const [voiceAgg, presenceAgg] = await Promise.all([
      voiceSessionRepository.aggregateByPeriod(start, end),
      presenceSessionRepository.aggregateByPeriod(start, end),
    ]);

    const userIds = new Set<string>();
    voiceAgg.forEach((v) => userIds.add(v._id.toString()));
    presenceAgg.forEach((p) => userIds.add(p._id.toString()));

    for (const userIdStr of userIds) {
      const userId = new Types.ObjectId(userIdStr);
      const voice = voiceAgg.find((v) => v._id.toString() === userIdStr);
      const presence = presenceAgg.find((p) => p._id.toString() === userIdStr);

      await dailyReportRepository.upsert({
        userId,
        date: start,
        productiveSeconds: voice?.productiveSeconds ?? 0,
        voiceSeconds: voice?.voiceSeconds ?? 0,
        idleSeconds: presence?.idleSeconds ?? 0,
        offlineSeconds: presence?.offlineSeconds ?? 0,
        afkSeconds: voice?.afkSeconds ?? 0,
        lunchSeconds: voice?.lunchSeconds ?? 0,
      });
    }
  },

  /**
   * Retorna relatório diário agregado (todos os usuários).
   * @param date Data do relatório (default: hoje na timezone configurada)
   * @returns Totais em horas
   */
  async getDailyReport(date: Date = new Date()): Promise<HoursReport> {
    await this.generateDailyReports(date);
    const reports = await dailyReportRepository.findByDate(date);

    const totals = reports.reduce(
      (acc, r) => ({
        productiveSeconds: acc.productiveSeconds + r.productiveSeconds,
        voiceSeconds: acc.voiceSeconds + r.voiceSeconds,
        idleSeconds: acc.idleSeconds + r.idleSeconds,
        offlineSeconds: acc.offlineSeconds + r.offlineSeconds,
        afkSeconds: acc.afkSeconds + r.afkSeconds,
        lunchSeconds: acc.lunchSeconds + r.lunchSeconds,
      }),
      {
        productiveSeconds: 0,
        voiceSeconds: 0,
        idleSeconds: 0,
        offlineSeconds: 0,
        afkSeconds: 0,
        lunchSeconds: 0,
      },
    );

    const dateOnly = getDayBounds(date).start;

    return {
      date: formatDateString(dateOnly),
      timezone: config.timezone,
      productiveHours: secondsToHours(totals.productiveSeconds),
      voiceHours: secondsToHours(totals.voiceSeconds),
      idleHours: secondsToHours(totals.idleSeconds),
      offlineHours: secondsToHours(totals.offlineSeconds),
      afkHours: secondsToHours(totals.afkSeconds),
      lunchHours: secondsToHours(totals.lunchSeconds),
    };
  },

  /**
   * Retorna relatório mensal agregado.
   * @param year Ano (default: atual)
   * @param month Mês 1-12 (default: atual)
   * @returns Totais em horas
   */
  async getMonthlyReport(year?: number, month?: number): Promise<HoursReport> {
    const current = getCurrentYearMonth();
    const y = year ?? current.year;
    const m = month ?? current.month;

    await regenerateMonthlyDailyReports(y, m);
    const totals = await dailyReportRepository.aggregateMonthly(y, m);

    return {
      year: y,
      month: m,
      timezone: config.timezone,
      productiveHours: secondsToHours(totals.productiveSeconds),
      voiceHours: secondsToHours(totals.voiceSeconds),
      idleHours: secondsToHours(totals.idleSeconds),
      offlineHours: secondsToHours(totals.offlineSeconds),
      afkHours: secondsToHours(totals.afkSeconds),
      lunchHours: secondsToHours(totals.lunchSeconds),
    };
  },

  /**
   * Ranking diário por tempo produtivo.
   * @param date Data do ranking
   * @param limit Máximo de resultados
   * @returns Lista ordenada
   */
  async getDailyRanking(date: Date = new Date(), limit = 50): Promise<RankingItem[]> {
    await this.generateDailyReports(date);
    const reports = await dailyReportRepository.rankingByDate(date, limit);

    return reports.map((r) => {
      const user = r.userId as unknown as { discordId: string; username: string; displayName: string };
      return {
        userId: user?.discordId ?? String(r.userId),
        username: user?.username ?? 'unknown',
        displayName: user?.displayName ?? 'unknown',
        productiveHours: secondsToHours(r.productiveSeconds),
        voiceHours: secondsToHours(r.voiceSeconds),
      };
    });
  },

  /**
   * Ranking mensal por tempo produtivo.
   * @param year Ano
   * @param month Mês
   * @param limit Máximo de resultados
   * @returns Lista ordenada
   */
  async getMonthlyRanking(year?: number, month?: number, limit = 50): Promise<RankingItem[]> {
    const current = getCurrentYearMonth();
    const y = year ?? current.year;
    const m = month ?? current.month;

    await regenerateMonthlyDailyReports(y, m);
    const ranking = await dailyReportRepository.rankingMonthly(y, m, limit);
    const users = await userRepository.findAll();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return ranking.map((r) => {
      const user = userMap.get(r.userId.toString());
      return {
        userId: user?.discordId ?? r.userId.toString(),
        username: user?.username ?? 'unknown',
        displayName: user?.displayName ?? 'unknown',
        productiveHours: secondsToHours(r.productiveSeconds),
        voiceHours: secondsToHours(r.voiceSeconds),
      };
    });
  },
};

/**
 * Regenera os relatórios diários persistidos de todos os dias de um mês.
 *
 * Mantém os agregados mensais consistentes quando a lógica de cálculo diário é
 * corrigida, evitando que documentos antigos inflados continuem impactando o
 * mês e o ranking mensal.
 * @param year Ano civil
 * @param month Mês civil (1-12)
 * @returns void
 */
async function regenerateMonthlyDailyReports(year: number, month: number): Promise<void> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    await reportService.generateDailyReports(zonedDateTimeToUtc(year, month, day, 12));
  }
}
