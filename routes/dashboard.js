const express = require('express');
const router = express.Router();
const { daysUntil, formatDate, formatMonth } = require('../lib/dateHelpers');
const {
  getActiveClientsCount,
  getActiveServersCount,
  getMonthlyRecurringRevenue,
  getMonthlyServerCost,
  getAllActiveClients,
  getCancelledLast30Days,
  getMonthlySales,
  getExpiredClients,
  getExpiredCount,
  getExpiredRevenue,
  getServerRanking,
  getPlanDistribution,
  getNewClientsCount,
  getRenewalsCount
} = require('../db/queries/dashboard');

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

router.get('/', (req, res) => {
  const now = new Date();

  const totalActive = getActiveClientsCount();
  const totalServers = getActiveServersCount();
  const mrr = getMonthlyRecurringRevenue();
  const monthlyServerCost = getMonthlyServerCost();

  const netProfit = mrr - monthlyServerCost;
  const profitMargin = mrr > 0 ? ((netProfit / mrr) * 100).toFixed(1) : '0.0';
  const avgTicket = totalActive > 0 ? (mrr / totalActive) : 0;

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cancelledLast30 = getCancelledLast30Days(formatDate(thirtyDaysAgo));
  const activeAtStart = totalActive + cancelledLast30;
  const churnRate = activeAtStart > 0 ? ((cancelledLast30 / activeAtStart) * 100).toFixed(1) : '0.0';

  const allActive = getAllActiveClients();

  const expiringSoonCount = allActive.filter(c => { const d = daysUntil(c.due_date); return d >= 0 && d <= 7; }).length;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthEndDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(monthEndDay).padStart(2, "0")}`;

  const monthlySales = getMonthlySales(monthStartStr, monthEndStr);

  const projectionByPeriod = [];
  const periods = [
    { label: 'Próximos 3 dias', days: 3 },
    { label: '4–7 dias', days: 7 },
    { label: '8–15 dias', days: 15 },
    { label: '16–30 dias', days: 30 }
  ];
  let prevDays = 0;
  for (const period of periods) {
    const clientsInPeriod = allActive.filter(c => {
      const d = daysUntil(c.due_date);
      return d > prevDays && d <= period.days;
    });
    const totalValue = clientsInPeriod.reduce((sum, c) => sum + (c.price - (c.discount || 0)), 0);
    projectionByPeriod.push({
      label: period.label,
      clientCount: clientsInPeriod.length,
      totalValue: Math.round(totalValue * 100) / 100
    });
    prevDays = period.days;
  }
  const overdueCount = allActive.filter(c => daysUntil(c.due_date) < 0).length;

  const upcoming = allActive
    .map(c => ({ ...c, days_until_due: daysUntil(c.due_date), server_cost: (c.server_cost_raw || 0) }))
    .filter(c => c.days_until_due <= 15)
    .slice(0, 15);

  const projection6Months = [];
  for (let i = 0; i < 6; i++) {
    const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const projEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const monthStr = formatMonth(projDate);
    const startStr = `${monthStr}-01`;
    const endStr = `${monthStr}-${String(projEnd.getDate()).padStart(2, '0')}`;

    const expiringInMonth = allActive.filter(c => c.due_date >= startStr && c.due_date <= endStr);
    const atRiskRevenue = expiringInMonth.reduce((sum, c) => sum + (c.mrr_per_client || 0), 0);
    const safeRevenue = mrr - atRiskRevenue;

    let safeRevenueFinal = safeRevenue;
    let atRiskRevenueFinal = atRiskRevenue;

    if (i === 0) {
      const overdueClients = allActive.filter(c => daysUntil(c.due_date) < 0);
      const overdueMRR = overdueClients.reduce((sum, c) => sum + (c.mrr_per_client || 0), 0);
      safeRevenueFinal = mrr - overdueMRR;
      atRiskRevenueFinal = overdueMRR;
    }

    projection6Months.push({
      month: monthStr,
      label: `${MONTH_NAMES[projDate.getMonth()]} ${projDate.getFullYear()}`,
      safeRevenue: Math.round(safeRevenueFinal * 100) / 100,
      atRiskRevenue: Math.round(atRiskRevenueFinal * 100) / 100,
      serverCost: monthlyServerCost,
      netExpected: Math.round((safeRevenueFinal - monthlyServerCost) * 100) / 100,
      expiringCount: expiringInMonth.length
    });
  }

  const expiredClients = getExpiredClients();
  const expiredCount = getExpiredCount();
  const expiredRevenue = getExpiredRevenue();
  const serverRanking = getServerRanking();
  const planDistribution = getPlanDistribution();
  const newClientsMonth = getNewClientsCount();
  const renewalsMonth = getRenewalsCount();

  const revenueAtRisk = allActive
    .filter(c => { const d = daysUntil(c.due_date); return d >= 0 && d <= 7; })
    .reduce((sum, c) => sum + (c.price - (c.discount || 0)), 0);

  res.json({
    totalActive, totalServers,
    mrr: Math.round(mrr * 100) / 100,
    monthlyServerCost,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin,
    avgTicket: Math.round(avgTicket * 100) / 100,
    churnRate,
    expiringSoonCount, overdueCount,
    expiredCount,
    expiredRevenue: Math.round(expiredRevenue * 100) / 100,
    expiredClients,
    serverRanking, planDistribution,
    newClientsMonth, renewalsMonth, revenueAtRisk: Math.round(revenueAtRisk * 100) / 100, upcoming, projection6Months, monthlySales: Math.round(monthlySales * 100) / 100, projectionByPeriod
  });
});

module.exports = router;
