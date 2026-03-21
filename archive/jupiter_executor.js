// src/executor/jupiter_executor.js
//
// Integração com Jupiter Perpetuals (https://jup.ag/perps)
// API Docs: https://station.jup.ag/docs/perps/trading-api
//
// Jupiter Perps expõe uma API REST + SDK on-chain via programa Solana.
// Este módulo utiliza a API REST pública + @solana/web3.js para assinar
// e enviar as transações.

import fetch from 'node-fetch';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import logger from '../utils/logger.js';
import { config, JUPITER_PERPS } from '../config/index.js';

// ─── Constantes da API Jupiter Perps ─────────────────────────────────────────
const JUPITER_PERPS_API = 'https://perps-api.jup.ag';

// ─── Conexão Solana ───────────────────────────────────────────────────────────
let _connection = null;
function getConnection() {
  if (!_connection) {
    _connection = new Connection(config.solana.rpcUrl, {
      commitment:           'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return _connection;
}

// ─── Keypair ──────────────────────────────────────────────────────────────────
let _keypair = null;
function getKeypair() {
  if (!_keypair) {
    const decoded = bs58.decode(config.solana.privateKey);
    _keypair = Keypair.fromSecretKey(decoded);
    logger.info(`[EXECUTOR] Wallet carregada: ${_keypair.publicKey.toBase58()}`);
  }
  return _keypair;
}

/**
 * Retorna o saldo USDC da wallet em USD
 */
export async function getWalletBalance() {
  if (config.trading.paperMode) {
    return 1000; // Saldo fictício para paper trading
  }

  try {
    const connection = getConnection();
    const keypair    = getKeypair();

    // Jupiter Perps usa USDC como colateral — verificar saldo SOL para fees
    const lamports = await connection.getBalance(keypair.publicKey);
    const sol      = lamports / 1e9;

    // Buscar saldo USDC via API Jupiter
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { mint: new (await import('@solana/web3.js')).PublicKey(usdcMint) }
    );

    let usdcBalance = 0;
    if (tokenAccounts.value.length > 0) {
      usdcBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    }

    logger.info(`[EXECUTOR] Saldo: ${sol.toFixed(4)} SOL | ${usdcBalance.toFixed(2)} USDC`);
    return usdcBalance;

  } catch (err) {
    logger.error(`[EXECUTOR] Erro ao buscar saldo: ${err.message}`);
    return 0;
  }
}

/**
 * Busca o preço de mercado atual de um ativo via Jupiter
 */
async function getMarketPrice(asset) {
  const mint = JUPITER_PERPS.ASSET_MINTS[asset];
  if (!mint) throw new Error(`Ativo não suportado: ${asset}`);

  const url = `https://price.jup.ag/v6/price?ids=${mint}`;
  const res  = await fetch(url, { timeout: 5000 });
  const data = await res.json();

  return data.data[mint]?.price ?? null;
}

/**
 * Abre uma posição PERP (LONG ou SHORT) no Jupiter Perps
 *
 * Fluxo:
 * 1. Buscar cotação (quote) via API
 * 2. Construir transação
 * 3. Assinar com o keypair
 * 4. Enviar e aguardar confirmação
 * 5. Definir TP/SL via ordem limit separada
 */
export async function openPosition(tradeParams) {
  const { asset, direction, entry, tp, sl, leverage,
          positionSizeUSD, slippageBps, signalId } = tradeParams;

  logger.info(`[EXECUTOR] Abrindo posição: ${direction} ${asset} | ` +
    `Entrada: $${entry} | TP: $${tp} | SL: $${sl} | Alavancagem: ${leverage}x`);

  // ─── Paper Trading ────────────────────────────────────────────────────────
  if (config.trading.paperMode) {
    return simulateTrade(tradeParams);
  }

  // ─── Execução Real ────────────────────────────────────────────────────────
  try {
    const keypair    = getKeypair();
    const connection = getConnection();

    // 1. Verificar preço atual vs entrada do sinal
    const currentPrice = await getMarketPrice(asset);
    if (currentPrice) {
      const priceDiff = Math.abs(currentPrice - entry) / entry * 100;
      if (priceDiff > 2) {
        logger.warn(`[EXECUTOR] Preço atual ($${currentPrice}) desviou ${priceDiff.toFixed(2)}% ` +
          `da entrada do sinal ($${entry}) — executando mesmo assim (MARKET ORDER)`);
      }
    }

    // 2. Montar payload para a API Jupiter Perps
    // Documentação: https://station.jup.ag/docs/perps/trading-api
    const collateralUSD = positionSizeUSD; // colateral em USDC
    const side          = direction === 'LONG' ? 'long' : 'short';
    const assetMint     = JUPITER_PERPS.ASSET_MINTS[asset];

    if (!assetMint) {
      throw new Error(`[EXECUTOR] Mint não encontrado para ${asset}`);
    }

    // 3. Buscar instrução de abertura
    const openUrl = `${JUPITER_PERPS_API}/v1/order/open`;
    const openRes = await fetch(openUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        walletAddress:    keypair.publicKey.toBase58(),
        marketSymbol:     asset,        // "ETH", "BTC", "SOL", etc.
        side,                           // "long" | "short"
        collateralUsd:    collateralUSD,
        leverage:         leverage,
        slippageBps:      slippageBps,
        orderType:        'market',
        // TP/SL nativos da API (se suportados)
        takeProfitPrice:  tp,
        stopLossPrice:    sl,
      }),
    });

    if (!openRes.ok) {
      const errBody = await openRes.text();
      throw new Error(`[EXECUTOR] API Jupiter retornou ${openRes.status}: ${errBody}`);
    }

    const { transaction: txBase64 } = await openRes.json();

    // 4. Desserializar, assinar e enviar a transação
    const txBytes      = Buffer.from(txBase64, 'base64');
    const tx           = VersionedTransaction.deserialize(txBytes);
    tx.sign([keypair]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight:         false,
      preflightCommitment:   'processed',
      maxRetries:            3,
    });

    logger.info(`[EXECUTOR] Transação enviada: ${signature}`);

    // 5. Aguardar confirmação
    const confirmation = await connection.confirmTransaction(
      { signature, commitment: 'confirmed' },
      30000
    );

    if (confirmation.value.err) {
      throw new Error(`[EXECUTOR] Transação falhou: ${JSON.stringify(confirmation.value.err)}`);
    }

    const result = {
      success:   true,
      signalId,
      signature,
      asset,
      direction,
      entry,
      tp,
      sl,
      leverage,
      collateralUSD,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      executedAt:  new Date().toISOString(),
    };

    logger.info(`[EXECUTOR] ✅ Posição aberta com sucesso!`, {
      assinatura: signature,
      explorer:   result.explorerUrl,
    });

    return result;

  } catch (err) {
    logger.error(`[EXECUTOR] ❌ Falha ao abrir posição: ${err.message}`, { stack: err.stack });
    throw err;
  }
}

/**
 * Simula um trade para paper trading
 */
function simulateTrade(tradeParams) {
  const { signalId, asset, direction, entry, tp, sl, leverage, positionSizeUSD } = tradeParams;

  const fakeSig = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const result = {
    success:      true,
    paperTrade:   true,
    signalId,
    signature:    fakeSig,
    asset,
    direction,
    entry,
    tp,
    sl,
    leverage,
    collateralUSD: positionSizeUSD,
    pnlProjection: {
      maxProfit: parseFloat(((Math.abs(tp - entry) / entry) * positionSizeUSD * leverage).toFixed(2)),
      maxLoss:   parseFloat(((Math.abs(sl - entry) / entry) * positionSizeUSD * leverage).toFixed(2)),
    },
    executedAt: new Date().toISOString(),
  };

  logger.info(`[PAPER] 📝 Trade simulado:`, {
    sinal:       signalId,
    ativo:       `${direction} ${asset}`,
    entrada:     `$${entry}`,
    tp:          `$${tp}`,
    sl:          `$${sl}`,
    alavancagem: `${leverage}x`,
    colateral:   `$${positionSizeUSD.toFixed(2)}`,
    lucroMax:    `$${result.pnlProjection.maxProfit}`,
    perdaMax:    `$${result.pnlProjection.maxLoss}`,
  });

  return result;
}

/**
 * Executa com retry automático
 */
export async function openPositionWithRetry(tradeParams, maxRetries = config.trading.maxRetries) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[EXECUTOR] Tentativa ${attempt}/${maxRetries} para ${tradeParams.signalId}`);
      const result = await openPosition(tradeParams);
      return result;
    } catch (err) {
      lastError = err;
      logger.warn(`[EXECUTOR] Tentativa ${attempt} falhou: ${err.message}`);

      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // backoff linear: 1s, 2s, 3s
        logger.info(`[EXECUTOR] Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`[EXECUTOR] Todas as ${maxRetries} tentativas falharam. Último erro: ${lastError?.message}`);
}
