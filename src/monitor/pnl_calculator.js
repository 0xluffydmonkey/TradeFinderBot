// src/monitor/pnl_calculator.js
// Utilitários puros para cálculo e formatação de PnL

/**
 * Calcula PnL % baseado no custo de entrada.
 * @param {number} pnlUSD    - PnL em dólares (pode ser negativo)
 * @param {number} entryPrice
 * @param {number} sizeBase  - Tamanho em tokens
 * @returns {number} PnL em %
 */
export function calcPnlPct(pnlUSD, entryPrice, sizeBase) {
  const cost = Math.abs(entryPrice * sizeBase);
  if (cost === 0) return 0;
  return (pnlUSD / cost) * 100;
}

/**
 * Distância percentual do preço atual até o TP/SL.
 */
export function distancePct(currentPrice, targetPrice) {
  if (!targetPrice || currentPrice === 0) return null;
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}

/**
 * Calcula Risk:Reward de uma posição.
 */
export function calcRR(entryPrice, tp, sl, direction) {
  if (!tp || !sl) return null;
  const risk   = Math.abs(entryPrice - sl);
  const reward = Math.abs(tp - entryPrice);
  if (risk === 0) return null;
  return reward / risk;
}

/**
 * Resumo consolidado de um array de posições.
 */
export function summarizePositions(positions) {
  return positions.reduce(
    (acc, p) => ({
      totalPnlUSD:  acc.totalPnlUSD  + p.pnlUSD,
      totalSizeUSD: acc.totalSizeUSD + p.sizeUSD,
      profitCount:  acc.profitCount  + (p.isProfit ? 1 : 0),
      lossCount:    acc.lossCount    + (p.isProfit ? 0 : 1),
    }),
    { totalPnlUSD: 0, totalSizeUSD: 0, profitCount: 0, lossCount: 0 },
  );
}