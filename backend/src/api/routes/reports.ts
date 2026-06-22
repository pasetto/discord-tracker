import Router from '@koa/router';

import { reportService } from '../../services/reportService';

import { parseDateString } from '../../utils/timezone';



/** Rotas de relatórios. */

export const reportsRouter = new Router();



/**

 * GET /reports/daily/:date? - Relatório diário agregado.

 * @param date Formato YYYY-MM-DD na timezone configurada (opcional, default hoje)

 */

reportsRouter.get('/reports/daily/:date?', async (ctx) => {

  const dateParam = ctx.params.date;



  try {

    const date = dateParam ? parseDateString(dateParam) : new Date();

    ctx.body = await reportService.getDailyReport(date);

  } catch {

    ctx.status = 400;

    ctx.body = { error: 'Data inválida. Use formato YYYY-MM-DD' };

  }

});



/**

 * GET /reports/monthly/:year?/:month? - Relatório mensal agregado.

 */

reportsRouter.get('/reports/monthly/:year?/:month?', async (ctx) => {

  const year = ctx.params.year ? Number(ctx.params.year) : undefined;

  const month = ctx.params.month ? Number(ctx.params.month) : undefined;



  ctx.body = await reportService.getMonthlyReport(year, month);

});



/**

 * GET /reports/ranking - Ranking por tempo produtivo.

 * Query: date (YYYY-MM-DD), year, month, type (daily|monthly)

 */

reportsRouter.get('/reports/ranking', async (ctx) => {

  const { date, year, month, type } = ctx.query as Record<string, string>;

  const rankingType = type ?? 'daily';



  if (rankingType === 'monthly') {

    ctx.body = await reportService.getMonthlyRanking(

      year ? Number(year) : undefined,

      month ? Number(month) : undefined,

    );

    return;

  }



  try {

    const rankingDate = date ? parseDateString(date) : new Date();

    ctx.body = await reportService.getDailyRanking(rankingDate);

  } catch {

    ctx.status = 400;

    ctx.body = { error: 'Data inválida. Use formato YYYY-MM-DD' };

  }

});


