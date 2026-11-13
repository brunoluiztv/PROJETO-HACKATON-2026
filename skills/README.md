# 🧠 Agentic Awesome Skills (AAS) — Tekó Biotech

> Repositório oficial de Skills e Playbooks padronizados no formato [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) para o projeto **Tekó Biotech** (Hackathon das Engenharias UERGS 2026).

Este diretório contém os playbooks de instrução, especificações científicas, diretrizes de acessibilidade e engenharia embarcada consumidos por agentes autônomos de IA (Antigravity, Claude Code, Codex, Cursor, Gemini CLI) e desenvolvedores da equipe.

---

## 📚 Catálogo de Skills Instaladas

| Skill | Categoria | Descrição Resumida | Arquivo |
| :--- | :--- | :--- | :--- |
| **`teko-inplanta-biomonitoring`** | `agriculture-iot` | Eletrofisiologia vegetal, bioimpedância (50k/1kHz), ORP de rizosfera (< -100 mV para hipóxia), limites Embrapa e laudo PROAGRO. | [`teko-inplanta-biomonitoring/SKILL.md`](teko-inplanta-biomonitoring/SKILL.md) |
| **`teko-rural-accessibility-ux`** | `accessibility-ux` | Padrão Zero Digitação, WCAG 2.2 AA, temas de alto contraste (Dark Mode e Daylight Rural), alvos $\ge 48\text{px}$ e narração por voz TTS. | [`teko-rural-accessibility-ux/SKILL.md`](teko-rural-accessibility-ux/SKILL.md) |
| **`teko-iot-ninhura-gateway`** | `embedded-iot` | Firmware ESP32-C3, protocolo ESP-NOW de 4ms, Deep Sleep 10 µA, geração bio-solar P-MFC, LittleFS circular e blindagem IP68. | [`teko-iot-ninhura-gateway/SKILL.md`](teko-iot-ninhura-gateway/SKILL.md) |
| **`teko-backend-prediction`** | `backend-prediction` | API FastAPI, persistência SQLite, motor preditivo de taxa de secagem, outbox de mensageria e webhooks do Telegram Bot. | [`teko-backend-prediction/SKILL.md`](teko-backend-prediction/SKILL.md) |

---

## 🛠️ Especificação de Formato AAS

Cada arquivo `SKILL.md` combina:
1. **YAML Frontmatter:**
   * `name`: Identificador único em kebab-case.
   * `description`: Resumo rico em gatilhos para seleção semântica rápida por IAs.
   * `category`, `risk`, `tools`, `platforms`, `license`, `author`.
2. **Markdown Body:**
   * `When to Use`: Condições exatas e gatilhos para carregar a skill.
   * `Core Workflow`: Procedimentos passo a passo e arquitetura.
   * `Rules & Anti-Patterns`: Regras invioláveis (o que NUNCA fazer).
   * `Verification`: Comandos e checklists de validação de qualidade antes de qualquer PR.
