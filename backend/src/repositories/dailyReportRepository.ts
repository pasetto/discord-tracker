import { DailyReport, IDailyReport } from '../db/models/DailyReport';

import { Types } from 'mongoose';

import { getDayBounds, getMonthBounds, normalizeReportDate } from '../utils/timezone';



/**

 * Dados para upsert de relatório diário.

 */

export interface DailyReportData {

  userId: Types.ObjectId;

  date: Date;

  productiveSeconds: number;

  voiceSeconds: number;

  idleSeconds: number;

  offlineSeconds: number;

  afkSeconds: number;

  lunchSeconds: number;

}



/**

 * Repositório de relatórios diários.

 */

export const dailyReportRepository = {

  /**

   * Cria ou atualiza relatório diário de um usuário.

   * @param data Métricas do dia

   * @returns Relatório persistido

   */

  async upsert(data: DailyReportData): Promise<IDailyReport> {

    const dateOnly = normalizeReportDate(data.date);



    return DailyReport.findOneAndUpdate(

      { userId: data.userId, date: dateOnly },

      {

        $set: {

          productiveSeconds: data.productiveSeconds,

          voiceSeconds: data.voiceSeconds,

          idleSeconds: data.idleSeconds,

          offlineSeconds: data.offlineSeconds,

          afkSeconds: data.afkSeconds,

          lunchSeconds: data.lunchSeconds,

        },

      },

      { upsert: true, new: true },

    );

  },



  /**

   * Busca relatórios de um dia específico na timezone configurada.

   * @param date Data de referência

   * @returns Relatórios do dia

   */

  async findByDate(date: Date): Promise<IDailyReport[]> {

    const { start } = getDayBounds(date);

    return DailyReport.find({ date: start }).populate('userId');

  },



  /**

   * Agrega relatórios de um mês na timezone configurada.

   * @param year Ano

   * @param month Mês (1-12)

   * @returns Totais agregados do mês

   */

  async aggregateMonthly(year: number, month: number): Promise<{

    productiveSeconds: number;

    voiceSeconds: number;

    idleSeconds: number;

    offlineSeconds: number;

    afkSeconds: number;

    lunchSeconds: number;

  }> {

    const { start, end } = getMonthBounds(year, month);



    const result = await DailyReport.aggregate([

      { $match: { date: { $gte: start, $lt: end } } },

      {

        $group: {

          _id: null,

          productiveSeconds: { $sum: '$productiveSeconds' },

          voiceSeconds: { $sum: '$voiceSeconds' },

          idleSeconds: { $sum: '$idleSeconds' },

          offlineSeconds: { $sum: '$offlineSeconds' },

          afkSeconds: { $sum: '$afkSeconds' },

          lunchSeconds: { $sum: '$lunchSeconds' },

        },

      },

    ]);



    return (

      result[0] ?? {

        productiveSeconds: 0,

        voiceSeconds: 0,

        idleSeconds: 0,

        offlineSeconds: 0,

        afkSeconds: 0,

        lunchSeconds: 0,

      }

    );

  },



  /**

   * Ranking de usuários por tempo produtivo em um dia.

   * @param date Data do ranking

   * @param limit Quantidade máxima de resultados

   * @returns Relatórios ordenados por productiveSeconds desc

   */

  async rankingByDate(date: Date, limit = 50): Promise<IDailyReport[]> {

    const { start } = getDayBounds(date);



    return DailyReport.find({ date: start })

      .sort({ productiveSeconds: -1 })

      .limit(limit)

      .populate('userId');

  },



  /**

   * Ranking mensal por tempo produtivo.

   * @param year Ano

   * @param month Mês (1-12)

   * @param limit Quantidade máxima

   * @returns Ranking agregado por usuário

   */

  async rankingMonthly(

    year: number,

    month: number,

    limit = 50,

  ): Promise<

    Array<{

      userId: Types.ObjectId;

      productiveSeconds: number;

      voiceSeconds: number;

    }>

  > {

    const { start, end } = getMonthBounds(year, month);



    return DailyReport.aggregate([

      { $match: { date: { $gte: start, $lt: end } } },

      {

        $group: {

          _id: '$userId',

          productiveSeconds: { $sum: '$productiveSeconds' },

          voiceSeconds: { $sum: '$voiceSeconds' },

        },

      },

      { $sort: { productiveSeconds: -1 } },

      { $limit: limit },

      {

        $project: {

          userId: '$_id',

          productiveSeconds: 1,

          voiceSeconds: 1,

          _id: 0,

        },

      },

    ]);

  },

};


