const express = require('express');
const router = express.Router();
const { daysUntil } = require('../lib/dateHelpers');
const {
  getActiveClientsCount,
  getActiveServersCount,
  getMonthlyRecurringRevenue,
  getMonthlyServerCost,
  getAllActiveClients,
  getCancelledLast30Days,
  getExpiredClients,
  getExpiredCount,
  getExpiredRevenue,
  getServerRanking,
  getPlanDistribution,
  getMonthSalesTotals,
  getMonthlyProfitHistory
} = require('../db/queries/dashboard');

function parseMonthParam(req) {
  const monthParam = req.query.month;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) return monthParam;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthEndStrFrom(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const endDay = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(endDay).padStart(2, '0')}`;
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/', (req, res) => {
  const selectedMonth = parseMonthParam(req);
  const monthStartStr = `${selectedMonth}-01`;
  const isCurrentMonth = selectedMonth === currentMonthStr();

  const monthlyServerCost = getMonthlyServerCost();
  const salesTotals = getMonthSalesTotals(selectedMonth);

  // ===== ESTADO ATUAL (independente do mês selecionado) =====
  const totalActive = getActiveClientsCount();
  const mrr = getMonthlyRecurringRevenue();
  const allActive = getAllActiveClients();
  const expiringSoonCount = allActive.filter(c => { const d = daysUntil(c.due_date); return d >= 0 && d <= 7; }).length;
  const overdueCount = allActive.filter(c => daysUntil(c.due_date) < 0).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cancelledLast30 = getCancelledLast30Days(thirtyDaysAgo.toISOString().slice(0, 10));
  const activeAtStart = totalActive + cancelledLast30;
  const churnRate = activeAtStart > 0 ? ((cancelledLast30 / activeAtStart) * 100).toFixed(1) : '0.0';

  const expiredClients = getExpiredClients();
  const expiredCount = getExpiredCount();
  const expiredRevenue = getExpiredRevenue();
  const serverRanking = getServerRanking();
  const planDistribution = getPlanDistribution();

  const revenueAtRisk = allActive
    .filter(c => { const d = daysUntil(c.due_date); return d >= 0 && d <= 7; })
    .reduce((sum, c) => sum + (c.price - (c.discount || 0)), 0);

  const projectionByPeriod = [];
  const upcoming = [];
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
  upcoming.push(...allActive
    .map(c => ({ ...c, days_until_due: daysUntil(c.due_date), server_cost: (c.server_cost_raw || 0) }))
    .filter(c => c.days_until_due <= 15)
    .slice(0, 15));

  // ===== MÊS SELECIONADO — dados realizados (só financeiro) =====
  const monthlyRevenue = salesTotals.totalSales;
  const netProfit = monthlyRevenue - monthlyServerCost;
  const profitMargin = monthlyRevenue > 0 ? ((netProfit / monthlyRevenue) * 100).toFixed(1) : '0.0';
  const totalSalesCount = salesTotals.totalCount;
  const avgTicket = totalSalesCount > 0 ? (monthlyRevenue / totalSalesCount) : 0;

  const newClientsMonth = salesTotals.countNew;
  const renewalsCount = salesTotals.countRenewals;
  const renewalsRevenue = Math.round(salesTotals.totalRenewals * 100) / 100;

  const profitHistory = getMonthlyProfitHistory(6);

  res.json({
    selectedMonth,
    isCurrentMonth,
    // Estado atual
    totalActive,
    totalServers: getActiveServersCount(),
    mrr: Math.round(mrr * 100) / 100,
    monthlyServerCost,
    churnRate,
    expiringSoonCount, overdueCount,
    expiredCount,
    expiredRevenue: Math.round(expiredRevenue * 100) / 100,
    expiredClients,
    serverRanking, planDistribution,
    revenueAtRisk: Math.round(revenueAtRisk * 100) / 100, upcoming, projectionByPeriod,
    // Realizado no mês selecionado
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin,
    avgTicket: Math.round(avgTicket * 100) / 100,
    newClientsMonth,
    renewalsCount,
    renewalsRevenue,
    totalSalesCount,
    totalClientsMonth: salesTotals.totalClients,
    profitHistory
  });
});

module.exports = router;

module.exports = router;
