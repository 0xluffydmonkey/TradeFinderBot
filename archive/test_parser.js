// test_parser.js — Testa o parser com o sinal real do exemplo
// Rodar: node test_parser.js

import { parseSignal, validateSignal } from './src/parser/signal_parser.js';

const EXAMPLES = [
  // ─── Caso real do requisito ───────────────────────────────────────────────
  {
    label: 'SHORT ETH — Exemplo do requisito',
    text: `🧠 BATCH
🚨 NOVO SINAL | #ETH17032604V13
Ativo: ETH
Direção: 🔴 SHORT
Entrada: $2,332.58
🎯 TP: $2,181.90 (6.46%)
🛑 SL: $2,407.92 (3.23%)
📊 R:R = 1:2.0
⚡️ Alavancagem máx: 12.4x
Status: Aguardando confirmação`,
  },

  // ─── LONG BTC ─────────────────────────────────────────────────────────────
  {
    label: 'LONG BTC',
    text: `🧠 BATCH
🚨 NOVO SINAL | #BTC17032605V01
Ativo: BTC
Direção: 🟢 LONG
Entrada: $84,500.00
🎯 TP: $88,200.00 (4.38%)
🛑 SL: $82,800.00 (2.01%)
📊 R:R = 1:2.18
⚡️ Alavancagem máx: 8x
Status: Ativo`,
  },

  // ─── Mensagem sem sinal (deve ser ignorada) ───────────────────────────────
  {
    label: 'Mensagem normal (não é sinal)',
    text: 'Pessoal, amanhã teremos análise ao vivo às 20h! 🎯',
  },

  // ─── Sinal com TP/SL invertidos (deve falhar validação) ──────────────────
  {
    label: 'SHORT com TP > Entrada (inválido)',
    text: `🚨 NOVO SINAL | #SOL_INVALID
Ativo: SOL
Direção: 🔴 SHORT
Entrada: $150.00
🎯 TP: $180.00 (20%)
🛑 SL: $130.00 (13.3%)
⚡️ Alavancagem máx: 10x`,
  },

  // ─── LONG SOL ─────────────────────────────────────────────────────────────
  {
    label: 'LONG SOL',
    text: `🚨 NOVO SINAL | #SOL17032610V02
Ativo: SOL
Direção: 🟢 LONG
Entrada: $148.50
🎯 TP: $162.30 (9.29%)
🛑 SL: $140.00 (5.72%)
📊 R:R = 1:1.62
⚡️ Alavancagem máx: 15x
Status: Aguardando confirmação`,
  },
];

// ─── Execução dos testes ───────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(65));
console.log('  🧪 TESTE DO PARSER DE SINAIS');
console.log('═'.repeat(65) + '\n');

let passed = 0;
let failed = 0;

for (const example of EXAMPLES) {
  console.log(`\n📋 Caso: ${example.label}`);
  console.log('─'.repeat(50));

  const signal = parseSignal(example.text);

  if (!signal) {
    console.log('  ℹ️  Resultado: Não é um sinal — ignorado (comportamento esperado)');
    if (!example.text.includes('🚨 NOVO SINAL')) {
      passed++;
      console.log('  ✅ PASSOU');
    } else {
      failed++;
      console.log('  ❌ FALHOU — Era esperado fazer parsing');
    }
    continue;
  }

  const { valid, errors } = validateSignal(signal);

  console.log('  Parsed:');
  console.log(`    ID:         ${signal.signalId}`);
  console.log(`    Ativo:      ${signal.asset}`);
  console.log(`    Direção:    ${signal.direction}`);
  console.log(`    Entrada:    $${signal.entry}`);
  console.log(`    TP:         $${signal.tp}`);
  console.log(`    SL:         $${signal.sl}`);
  console.log(`    Leverage:   ${signal.leverage}x`);
  console.log(`  Válido:       ${valid ? '✅ SIM' : '❌ NÃO'}`);

  if (!valid) {
    console.log(`  Erros:        ${errors.join(', ')}`);
  }

  const expectValid = !example.label.includes('inválido');
  if (valid === expectValid) {
    passed++;
    console.log('  ✅ PASSOU');
  } else {
    failed++;
    console.log('  ❌ FALHOU — Resultado inesperado');
  }
}

console.log('\n' + '═'.repeat(65));
console.log(`  RESULTADO: ${passed} ✅ passaram | ${failed} ❌ falharam`);
console.log('═'.repeat(65) + '\n');
