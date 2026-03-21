# 🤖 TradeFinderBot — Drift Protocol Perps on Solana

Bot de trading algorítmico que monitora sinais de um canal Telegram e executa
ordens automaticamente no **Drift Protocol** (perps on-chain em Solana).

Inclui dashboard web em tempo real, monitor CLI, bot de controle via Telegram
com interface InlineKeyboard e acompanhamento automático de posições com alertas de PnL.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE EXECUÇÃO                           │
│                                                                      │
│  Canal Telegram (sinais)                                             │
│       │                                                              │
│       ▼  WebSocket MTProto (GramJS)                                  │
│  ┌──────────────────┐                                                │
│  │ telegram_listener│  Monitora canal privado em tempo real          │
│  └────────┬─────────┘                                                │
│           │ texto da mensagem                                         │
│           ▼                                                          │
│  ┌──────────────────┐                                                │
│  │  signal_parser   │  Regex → ID, ativo, direção, entrada,          │
│  └────────┬─────────┘  TP, SL, leverage                             │
│           │ signal object                                             │
│           ▼                                                          │
│  ┌──────────────────┐                                                │
│  │  signal_store    │  Deduplicação por ID (evita double-trade)      │
│  └────────┬─────────┘                                                │
│           ▼                                                          │
│  ┌──────────────────┐   Valida: ativo suportado, R:R, margem,        │
│  │  risk_manager    │   leverage cap, posições abertas, exposição,   │
│  └────────┬─────────┘   step size — dados direto do DriftUser        │
│           │ tradeParams (ajustados)                                   │
│           ▼                                                          │
│  ┌──────────────────┐                                                │
│  │  drift_executor  │  SDK Drift v2 → assina TX → Solana mainnet     │
│  └──────────────────┘                                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │                    STATE STORE (EventEmitter)               │      │
│  │  Compartilhado por: bot, web, monitor, telegram_control    │      │
│  └────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Estrutura de Arquivos

```
TradeFinderBot/
├── src/
│   ├── index.js                         # Orquestrador principal
│   ├── config/
│   │   └── index.js                     # Todas as variáveis de ambiente
│   ├── core/
│   │   └── state.js                     # State store central (EventEmitter)
│   ├── telegram/
│   │   ├── telegram_listener.js         # Listener MTProto (sinais do canal)
│   │   ├── telegram_control.js          # Bootstrap do bot de controle
│   │   ├── sessions.js                  # Sessões por usuário (TP/SL input)
│   │   ├── position_tracker.js          # Cards automáticos de posição + milestones
│   │   ├── handlers/
│   │   │   ├── commands.js              # Slash commands (/start, /positions, ...)
│   │   │   └── callbacks.js            # InlineKeyboard callbacks
│   │   └── ui/
│   │       ├── formatters.js            # fmt, fmtSign, fmtPrice, fmtPct, ...
│   │       ├── screens.js               # Renderizadores HTML das telas
│   │       └── keyboards.js             # Construtores de InlineKeyboard
│   ├── parser/
│   │   └── signal_parser.js             # Regex de parsing de sinais
│   ├── risk/
│   │   └── risk_manager.js             # 7 sistemas de validação de risco
│   ├── executor/
│   │   └── drift_executor.js            # Integração Drift Protocol SDK v2
│   ├── monitor/
│   │   ├── index.js                     # Ponto de entrada do monitor CLI
│   │   ├── monitor_service.js           # Polling do DriftUser
│   │   ├── data_fetcher.js              # Fetch de posições e saldo
│   │   ├── pnl_calculator.js            # Cálculo de PnL
│   │   └── ui.js                        # Dashboard terminal (ANSI)
│   ├── web/
│   │   ├── server.js                    # Express + Socket.IO
│   │   └── public/
│   │       ├── index.html               # Dashboard web
│   │       └── app.js                   # Frontend Socket.IO
│   └── utils/
│       ├── logger.js                    # Winston + rotação diária
│       └── signal_store.js              # Cache de sinais processados
├── test_parser.js                        # Testes do parser
├── .env.example                          # Template de configuração
├── ecosystem.config.cjs                  # PM2 config
└── package.json
```

---

## ⚙️ Stack

| Componente | Tecnologia | Por quê |
|---|---|---|
| Runtime | **Node.js 20** | async nativo, GramJS, baixa latência |
| Telegram sinais | **GramJS (MTProto)** | User client — monitora canais privados sem ser admin |
| Telegram controle | **node-telegram-bot-api** | Bot API com polling e InlineKeyboard |
| Blockchain | **Drift Protocol SDK v2** | DEX de perps on-chain em Solana, mainnet |
| Web | **Express + Socket.IO** | Dashboard em tempo real |
| Logs | **Winston + rotate** | Structured logging, rotação diária |
| Process | **PM2** | Restart automático, monitoramento |

---

## 🚀 Setup Completo

### 1. Pré-requisitos

```bash
node --version   # >= 18.0.0
npm --version    # >= 9.0.0
```

### 2. Instalar dependências

```bash
cd TradeFinderBot
npm install
```

### 3. Configurar o `.env`

```bash
cp .env.example .env
```

Edite o `.env` preenchendo as variáveis descritas nas seções abaixo.

---

## 🔑 Configuração: Telegram (Listener de Sinais)

O listener usa **MTProto** (user client) para monitorar um canal privado em tempo real.

### Obter API ID e Hash

1. Acesse [https://my.telegram.org/apps](https://my.telegram.org/apps)
2. Faça login com seu número de telefone
3. Clique em **"API development tools"**
4. Crie um novo app (nome e plataforma são livres)
5. Copie o **App api_id** e **App api_hash**

### Descobrir o ID do canal

Encaminhe qualquer mensagem do canal para `@userinfobot` no Telegram.
Ele retorna algo como: `Forwarded from channel id: -1001234567890`

### Variáveis no `.env`

```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_PHONE=+5511999999999
TELEGRAM_SESSION=                # Preenchido automaticamente após o 1º login
TELEGRAM_CHANNEL_ID=-1001234567890
```

### Primeira autenticação

Na primeira execução o terminal pedirá:
1. Código SMS enviado pelo Telegram
2. Senha 2FA (se configurada)

A sessão é salva em `telegram_session.txt`. Para evitar re-autenticar, copie
o conteúdo do arquivo para `TELEGRAM_SESSION` no `.env`:

```bash
cat telegram_session.txt
# cole o valor em TELEGRAM_SESSION=...
```

---

## 🤖 Configuração: Bot de Controle Telegram

O bot de controle permite monitorar e operar o bot via Telegram com interface
InlineKeyboard (botões clicáveis, sem spam de mensagens).

### Criar o bot

1. Abra o Telegram e fale com `@BotFather`
2. Envie `/newbot`
3. Escolha um nome e um username (ex: `MeuTradeBot`)
4. Copie o **token** fornecido (formato: `123456789:ABCdef...`)

### Descobrir seu User ID

Envie qualquer mensagem para `@userinfobot`. Ele retorna seu **ID numérico**.

### Variáveis no `.env`

```env
ENABLE_CONTROL_BOT=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CONTROL_ALLOWED_IDS=123456789,987654321   # Seu ID (e de outros admins)
PNL_REFRESH_INTERVAL_MS=30000                       # Atualização do card (ms)
```

> **Segurança:** Só os IDs listados em `TELEGRAM_CONTROL_ALLOWED_IDS` podem usar o bot.
> Qualquer outro usuário recebe `⛔ Acesso não autorizado`.

---

## 📱 Interface do Bot de Controle

### Menu Principal

Ao enviar `/start` ou `/help`, o bot exibe o **Menu Principal** com todos os botões:

```
🤖 TradeFinderBot  📝 PAPER

🟢 Status: Ativo
⚡ Auto-trading: ✅ ON
⏱ Uptime: 2h 15m

💰 Equity: $109.25  |  Livre: $87.40
📊 Posições abertas: 2
📩 Sinais processados: 7

[📡 Status]   [📊 Posições]
[💰 Saldo]    [📈 P&L]
[📩 Sinais]   [⚙️ Config]
[⏸️ Pausar]   [🔊 AT: OFF → ON]
[⚠️ Fechar Tudo]
```

### Slash Commands (retrocompatível)

| Comando | Descrição |
|---|---|
| `/start` ou `/help` | Abre o menu principal com botões |
| `/status` | Status detalhado do bot |
| `/balance` | Saldo: equity, free collateral, margem usada |
| `/positions` | Lista de posições abertas com botões de detalhes |
| `/pnl` | PnL ao vivo por posição + botão de fechar |
| `/last_signal` | Último sinal recebido |
| `/executed` | Últimos sinais executados |
| `/ignored` | Últimos sinais ignorados (com motivo) |
| `/errors` | Erros recentes |
| `/mode` | Configurações de modo e auto-trading |
| `/pause` | Pausa a execução de trades |
| `/resume` | Retoma a execução |
| `/autotrading on\|off` | Ativa/desativa auto-trading |
| `/close ATIVO` | Inicia fechamento de posição (com confirmação) |
| `/close_all` | Fecha todas as posições (com confirmação) |

### Navegação por Botões

Todos os comandos acima têm equivalentes em botão no menu. A navegação edita
a mensagem existente (sem spam no chat):

- **📊 Posições** → lista de posições com botões individuais
  - Cada posição → tela de detalhes com **Atualizar**, **Fechar**, **Mod TP**, **Mod SL**
- **📈 P&L** → PnL ao vivo com botão **🔄 Atualizar** e botão de fechar
- **⚙️ Config** → toggle de auto-trading, pausar/retomar
- **⚠️ Fechar Tudo** → tela de confirmação antes de executar

### Modificar TP / SL

1. Vá em **📊 Posições** → selecione uma posição
2. Clique em **🎯 Mod TP** ou **🛑 Mod SL**
3. O bot pedirá o novo preço em texto
4. Digite o valor numérico (ex: `95000`) e pressione Enter

### Acompanhamento Automático de Posições

Quando uma posição é aberta pelo bot, é enviado automaticamente um **card** no chat:

```
📋 Posição #ETH17032604V13

🔴 ETH SHORT  ⚡ 12.40x
Entrada: $2,332.58
Atual:   $2,298.10

✅ PnL: +$41.25  (+3.52%)
🎯 TP: $2,181.90
🛑 SL: $2,407.92

🕐 14:32:05

[🔴 Fechar a Mercado]  [🔄 Atualizar]
```

O card é **editado automaticamente** a cada `PNL_REFRESH_INTERVAL_MS` (padrão: 30s).

**Alertas de milestone** são enviados como mensagens separadas quando o PnL
cruza ±10%, ±20%, ±30%, etc. (cada milestone dispara uma única vez):

```
🎉 Milestone: +20%

🔴 ETH SHORT
PnL: +$82.50  (+7.05%)
Atual: $2,165.00
```

Quando a posição é fechada, o card é editado para:
```
✅ Posição fechada: ETH
Use /pnl para ver o resultado final da sessão.
```

---

## 🌐 Dashboard Web

O dashboard web exibe o estado do bot em tempo real via Socket.IO.

### Ativar

```env
ENABLE_WEB=true
WEB_PORT=3000
```

Ou via CLI (sem alterar o `.env`):

```bash
npm run web          # Bot + dashboard web
npm run full         # Bot + web + bot de controle Telegram
npm run full:paper   # Idem em modo paper
```

### Acessar

```
http://localhost:3000
```

O dashboard atualiza automaticamente via WebSocket. Exibe posições, PnL,
sinais, status e controles de pause/resume/close.

---

## 💻 Monitor CLI

Dashboard em tempo real no terminal (sem precisar do bot principal rodando).
Conecta diretamente ao DriftUser via SDK.

```bash
npm run monitor          # Live trading
npm run monitor:paper    # Paper trading
```

Exibe (atualiza a cada `MONITOR_REFRESH_MS`):
- Status da conexão Drift
- Equity, free collateral, margem usada
- Posições abertas com entrada, preço atual, PnL, leverage
- Erros recentes

---

## 🛡️ Sistema de Risco

O `risk_manager.js` valida todo sinal antes de enviar ao executor com **7 sistemas**:

| # | Sistema | O que faz |
|---|---|---|
| 0 | **Ativo suportado** | Rejeita ativos fora do `DRIFT_MARKET_INDEX` |
| 1 | **Leverage cap** | Usa o menor entre: sinal / plataforma / `MAX_LEVERAGE` |
| 2 | **R:R mínimo** | Rejeita se risco:recompensa for menor que 1:1 |
| 3 | **Snapshot ao vivo** | Consulta DriftUser diretamente (não usa cache do state) |
| 4 | **Max posições** | Rejeita se já há `MAX_POSITIONS` posições abertas |
| 5 | **Buffer de margem** | Rejeita se free collateral < `MIN_FREE_MARGIN_PCT` do total |
| 6 | **Max exposição** | Limita nocional total a `MAX_TOTAL_EXPOSURE_PCT` do equity |
| 7 | **Step size** | Arredonda base amount para o step do mercado; rejeita se abaixo do mínimo |

---

## 📊 Ativos Suportados (Drift Protocol)

| Ativo | Market Index | Observações |
|---|---|---|
| SOL | 0 | |
| BTC | 1 | |
| ETH | 2 | |
| APT | 3 | |
| 1MBONK / BONK | 4 | Drift usa 1M multiplier |
| POL / MATIC | 5 | MATIC renomeado para POL |
| ARB | 6 | |
| DOGE | 7 | |
| BNB | 8 | |
| SUI | 9 | |
| WIF | 23 | |
| JUP | 24 | |

Sinais com ativos fora desta lista são rejeitados com log explícito.

---

## 🏃 Scripts NPM

| Comando | Descrição |
|---|---|
| `npm start` | Bot principal (listener + executor) |
| `npm run dev` | Bot com hot-reload (`--watch`) |
| `npm run paper` | Bot em modo paper trading |
| `npm run full` | Bot + dashboard web + bot de controle Telegram |
| `npm run full:paper` | Idem em modo paper |
| `npm run web` | Bot + dashboard web (sem controle Telegram) |
| `npm run monitor` | Monitor CLI standalone |
| `npm run monitor:paper` | Monitor CLI em modo paper |
| `npm run test:parser` | Testa o parser de sinais |

---

## ☁️ Deploy em Produção (PM2)

```bash
npm install -g pm2

# Subir o bot
pm2 start ecosystem.config.cjs --env production

# Ver logs em tempo real
pm2 logs perps-bot

# Status
pm2 status

# Restart automático no boot do servidor
pm2 startup
pm2 save
```

Para rodar com web + controle Telegram em produção, edite `ecosystem.config.cjs`
para usar o script `full` ou passe as flags diretamente:

```bash
pm2 start "node src/index.js --web --control-bot" --name perps-bot
```

---

## 🔐 Segurança

**Nunca** versione o `.env` ou `telegram_session.txt` no Git.

```bash
# Permissões restritas
chmod 600 .env
chmod 600 telegram_session.txt

# Confirmar .gitignore
cat .gitignore | grep -E '\.env|session'
```

**Private key:** Para uso em produção com grandes volumes, substitua
`getKeypair()` em `drift_executor.js` por integração com vault (ex: HashiCorp Vault,
AWS Secrets Manager) ou hardware wallet.

---

## ⚠️ Variáveis de Ambiente — Referência Completa

```env
# ── Telegram (Listener de sinais) ─────────────────────────────────────────
TELEGRAM_API_ID=            # Obtido em my.telegram.org/apps
TELEGRAM_API_HASH=          # Obtido em my.telegram.org/apps
TELEGRAM_PHONE=             # Ex: +5511999999999
TELEGRAM_SESSION=           # Preenchido automaticamente após 1º login
TELEGRAM_CHANNEL_ID=        # ID do canal a monitorar (ex: -1001234567890)

# ── Solana ─────────────────────────────────────────────────────────────────
SOLANA_RPC_URL=             # Default: mainnet Helius público
WALLET_PRIVATE_KEY=         # Base58 — obrigatório para live trading

# ── Trading ────────────────────────────────────────────────────────────────
PAPER_TRADING=true          # true = simulação, false = live
POSITION_SIZE_PCT=0.05      # % do equity por trade (0.05 = 5%)
MAX_SLIPPAGE_BPS=100        # Slippage máximo (100 = 1%)
MAX_LEVERAGE=20             # Teto de alavancagem (independente do sinal)
EXECUTION_DELAY_MS=0        # Delay antes de executar (ms)
MAX_RETRIES=3               # Tentativas em caso de falha

# ── Limites de portfólio ───────────────────────────────────────────────────
MAX_POSITIONS=5             # Máximo de posições simultâneas
MIN_FREE_MARGIN_PCT=0.10    # Reserva mínima de free collateral (10%)
MAX_TOTAL_EXPOSURE_PCT=0.80 # Exposição nocional máxima (80% do equity)

# ── Bot de controle Telegram ───────────────────────────────────────────────
ENABLE_CONTROL_BOT=false    # true para ativar
TELEGRAM_BOT_TOKEN=         # Token do @BotFather
TELEGRAM_CONTROL_ALLOWED_IDS=  # IDs autorizados separados por vírgula
PNL_REFRESH_INTERVAL_MS=30000  # Intervalo de atualização dos cards (ms)

# ── Dashboard web ──────────────────────────────────────────────────────────
ENABLE_WEB=false            # true para ativar
WEB_PORT=3000               # Porta HTTP

# ── Monitor CLI ────────────────────────────────────────────────────────────
MONITOR_REFRESH_MS=10000    # Intervalo de atualização do terminal (ms)

# ── Logs ───────────────────────────────────────────────────────────────────
LOG_LEVEL=info              # debug | info | warn | error
LOG_DIR=./logs
```

---

## 🚨 Riscos e Advertências

### Técnicos
- **Latência de RPC:** Use nó premium (Helius, QuickNode, Triton) em produção
- **Sessão Telegram expirando:** Renove `TELEGRAM_SESSION` periodicamente
- **Mudanças de API Drift:** Monitorar changelogs do SDK `@drift-labs/sdk`
- **Market indices:** Se o Drift adicionar mercados, atualizar `DRIFT_MARKET_INDEX`

### Financeiros
- **Alavancagem** pode resultar em liquidação total da posição
- **Slippage** em alta volatilidade pode exceder o configurado
- **Qualidade do sinal:** O bot executa qualquer sinal válido do canal — você é responsável pela fonte
- **Múltiplas posições:** Dependendo do `MAX_POSITIONS`, podem abrir simultaneamente

### Boas práticas
- Comece com `POSITION_SIZE_PCT=0.01` (1%) até validar o comportamento
- Use `PAPER_TRADING=true` por pelo menos 24h antes de ir a live
- Monitore os logs (`pm2 logs perps-bot`) nas primeiras horas em live
- Mantenha SOL na wallet para pagar taxas de gas (~0.1 SOL por muitas transações)
- **Nunca invista mais do que pode perder**
