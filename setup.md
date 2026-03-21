# 🚀 Trade Bot Infrastructure & Dashboard

## 📌 Overview

Este projeto consiste em um sistema completo para execução, monitoramento e controle de um bot de trade com dashboard web profissional.

A arquitetura foi projetada para:

* Rodar 24/7 na nuvem
* Ser segura (sem exposição direta)
* Ser acessível remotamente (PC + celular)
* Ser escalável no futuro

---

## 🧠 Arquitetura

### Infraestrutura

* **Cloud Provider:** Oracle Cloud (Always Free Tier)
* **VM:** AMD VM.Standard.E2.1.Micro
* **OS:** Ubuntu 22.04 LTS
* **Acesso:** SSH via chave privada
* **Rede:** VCN + Public Subnet + Public IP

### Serviços planejados

* **Backend Bot:** Node.js (TradeFinderBot)
* **Database:** Supabase (PostgreSQL)
* **Acesso seguro:** Tailscale (VPN privada)
* **Frontend:** React + TypeScript + Tailwind (Dashboard)

---

## 🖥️ Informações da VM

* **IP público:** `129.213.63.63`
* **Usuário:** `ubuntu`
* **Chave SSH:** `~/.ssh/oracle-oci`
* **Região:** US East (Ashburn)

### Conexão SSH

```bash
ssh -i ~/.ssh/oracle-oci ubuntu@129.213.63.63
```

---

## ⚙️ Setup inicial (já realizado)

* [x] Criação da VM na Oracle Cloud
* [x] Configuração de rede (VCN + Subnet pública)
* [x] Atribuição de IP público
* [x] Configuração de SSH
* [x] Conexão via WSL estabelecida

---

## 🔧 Setup pendente

### 1. Atualizar sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar dependências básicas

```bash
sudo apt install -y git curl build-essential
```

### 3. Instalar Node.js (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

---

## 🤖 Bot (TradeFinderBot)

### Clonar projeto

```bash
git clone <REPO_URL>
cd TradeFinderBot
npm install
```

### Rodar bot

```bash
npm start
```

---

## 🌐 Dashboard (planejado)

Stack:

* React + TypeScript
* Tailwind CSS
* Socket.IO client
* Charts (Recharts ou similar)

Funcionalidades:

* Status do bot
* Controle (pause/resume/autotrading)
* Monitoramento em tempo real
* Logs
* Métricas

---

## 🗄️ Banco de dados (planejado)

* **Provider:** Supabase
* Armazenamento de:

  * Histórico de trades
  * Logs
  * Métricas
  * Estado do bot

---

## 🔐 Segurança (CRÍTICO)

### Situação atual

* VM acessível via IP público

### Próximos passos

* [ ] Instalar Tailscale
* [ ] Bloquear acesso público direto
* [ ] Usar VPN privada para acesso
* [ ] Implementar variáveis de ambiente (.env)
* [ ] Configurar RLS no Supabase

---

## 📡 Acesso remoto (planejado)

* Acesso via Tailscale:

  * PC
  * Celular (4G/5G)
* Dashboard acessível via rede privada

---

## 🚀 Roadmap

### Curto prazo

* [ ] Instalar Node.js
* [ ] Subir bot
* [ ] Validar execução contínua

### Médio prazo

* [ ] Integrar Supabase
* [ ] Criar dashboard
* [ ] Implementar logs persistentes

### Longo prazo

* [ ] Métricas avançadas
* [ ] Alertas
* [ ] Automação inteligente
* [ ] Deploy multi-node

---

## 🧠 Boas práticas

* Nunca expor credenciais
* Usar `.env` para secrets
* Não subir keys no Git
* Monitorar uso da VM
* Manter backups

---

## 🆘 Troubleshooting

### SSH não conecta

* Verificar permissão da key:

```bash
chmod 600 ~/.ssh/oracle-oci
```

### IP público não aparece

* Verificar VNIC → IP administration

### Bot não inicia

* Verificar logs
* Conferir Node instalado

---

## 👊 Observações finais

Esse setup foi construído para evoluir de um ambiente gratuito para uma infraestrutura profissional.

A arquitetura permite:

* crescimento
* segurança
* manutenção fácil
* expansão futura

---

**Status atual:** 🔥 VM pronta + SSH funcionando
**Próximo passo:** instalar Node + subir bot
