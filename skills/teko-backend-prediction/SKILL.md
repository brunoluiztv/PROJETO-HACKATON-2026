---
name: teko-backend-prediction
description: Backend FastAPI, banco de dados relacional SQLite e motor preditivo da dinâmica hídrica e alerta de secagem da Tekó Biotech. Usar sempre que alterar rotas de API REST (`backend/server.py`), esquema de banco de dados (`backend/database.py`), catálogo de perfis científicos Embrapa, motor preditivo de taxa de secagem, outbox de notificações ou despachadores de webhooks do Telegram Bot.
category: backend-prediction
risk: safe
tools:
  - python
  - bash
platforms:
  - antigravity
  - claude
  - codex
  - cursor
  - gemini
license: MIT
author: Teko Biotech Team
---

# ⚙️ Tekó Backend: FastAPI, Predição Embrapa & Notificações

Este playbook estabelece os padrões da arquitetura de backend do **Tekó Biotech**, responsável pela ingestão de telemetria, persistência relacional local e cálculo preditivo da dinâmica hídrica do solo.

---

## 📌 When to Use (Quando Acionar)

Carregue e aplique esta skill quando:
- Modificar ou estender endpoints da API FastAPI (`backend/server.py` e `backend/app/`).
- Atualizar modelos relacionais SQLite (`phytosense.db`).
- Alterar o algoritmo preditivo de secagem e contagem regressiva em dias (`backend/motor_predicao.py`).
- Implementar tarefas de mensageria assíncrona e outbox pattern (`backend/app/domain/outbox.py`).
- Escrever testes unitários e de integração com `pytest` e `httpx.AsyncClient`.

---

## 🏗️ Core Workflow & Arquitetura de Dados

### 1. Ingestão e Processamento
* Endpoint de Gateway: `POST /api/telemetria/gateway`
* Validação de payload via Pydantic (`TelemetryPayload`).
* Cálculo imediato de:
  1. Estado fisiológico (`hidratada`, `sede`, `hipoxia`).
  2. Taxa de secagem nas últimas $N$ leituras ($\Delta \text{kPa}/\text{dia}$).
  3. Previsão de dias até o Limite Crítico de Manejo da cultura ativa.
* Emissão de evento de outbox para alertas críticos:
  * $\text{Tensão} \ge \text{Limite Crítico Embrapa}$ (Risco de quebra de safra).
  * $\text{ORP} < -100\text{ mV}$ (Alerta emergencial de asfixia radicular pós-enchente).

### 2. Estratégia de Demonstração ("90% Histórico + 10% Gatilho ao Vivo")
* Para apresentações e bancas rápidas (pitch de 3 a 5 minutos):
  * O banco já inicia com 7 dias de dados históricos pré-carregados (`seed_demo_data.json`).
  * O gatilho de bancada do sensor físico (puxar o sensor do vaso para o ar seco) eleva o ADC de $1200 \to 3800$, disparando o alerta em tempo real no Dashboard e no bot do Telegram.

---

## 🚫 Rules & Anti-Patterns (Regras Invioláveis)

> [!CAUTION]
> 1. **NUNCA travar a API caso o Telegram esteja offline:** O envio de mensagens deve ser não-bloqueante (fila outbox ou background tasks) com retry exponencial.
> 2. **NUNCA usar chamadas HTTP síncronas pesadas dentro dos handlers:** Manter latência de resposta $< 50\text{ ms}$.
> 3. **NUNCA sobrescrever parâmetros da Embrapa por valores estáticos arbitrários:** Consultar sempre o catálogo `perfis_cultura`.

---

## 🧪 Testes e Validação Obrigatória

Qualquer alteração neste módulo deve manter **100% de aprovação** na suíte de testes:
```powershell
pytest
```
* **Metas de Teste:**
  * `test_alerts.py`: Garantir acionamento dos limiares de hipóxia e seca.
  * `test_api.py`: Validar contratos JSON e status HTTP 200/201.
  * `test_ingestion.py`: Validar idempotência de ingestão de telemetria.
