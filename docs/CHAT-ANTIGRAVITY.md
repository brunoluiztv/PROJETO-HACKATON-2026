# Resumo de Desenvolvimento & Decisões Arquiteturais (Antigravity)

**Hackathon das Engenharias UERGS 2026** — Desafio 02: Água para o Futuro e Drenagem Urbana (Foco em Agricultura Familiar no RS).

---

## 1. Pivô Arquitetural para Tekó Biotech

Por decisão estratégica da equipe e banca do Hackathon, o escopo foi 100% atualizado para **Tekó Biotech**:
- **Problema Central:** A alternância hidroclimática no RS causa perda de lavouras por estiagem e, criticamente, por **hipóxia/asfixia radicular em enchentes** (onde sensores de solo comuns acusam 100% de água e enganam o produtor rural).
- **Substituição Completa:** Removidas quaisquer lógicas e menções de sacos biodegradáveis, casca de arroz e análise colorimétrica por imagem.
- **In-Planta Biomonitoring:**
  1. **Clipe de Caule Biocompatível:** Bioimpedância dupla não invasiva (50 kHz para turgor celular simplástico e 1 kHz para fluxo no xilema) com almofada de bio-hidrogel à base de ágar, glicerol e KCl isotônico.
  2. **Haste Basal na Rizosfera:** Medição de Potencial Redox (ORP < -100 mV indicando colapso de oxigênio e fechamento de aquaporinas), condutividade elétrica e bioenergia via Plant-Microbial Fuel Cell (P-MFC) com consórcios de *Geobacter spp.* (0.45V a 0.65V).
  3. **Autonomia Energética Perpétua:** ESP32-C3 em Deep Sleep (10 µA, 14 mAh/dia) alimentado por geração Bio-Solar (45 mAh/dia).
  4. **Resiliência e Blindagem:** Encapsulamento IP68 em resina vegetal de mamona e armazenamento circular em memória Flash (LittleFS) por até 30 dias offline.
  5. **Laudo Oficial PROAGRO:** Emissão de laudo técnico fundamentado para comprovar perda de safra por asfixia radicular em enchentes.

---

## 2. Automação de Revisão de PRs com Qodo Merge

- **Integração Gratuita:** Workflow `.github/workflows/qodo_review.yml` utilizando a ação oficial `Codium-ai/pr-agent:github_action@main`.
- **Configuração Customizada (`.pr_agent.toml`):**
  - Checagem automática de acessibilidade rural (WCAG 2.2 AA).
  - Verificação de fórmulas bioelétricas (1 kHz, 50 kHz, ORP < -100 mV).
  - Bloqueio de commits com tokens ou segredos expostos.
- **CI Contínua (`.github/workflows/ci.yml`):**
  - Execução de testes unitários (`pytest`) no bot.
  - Verificação de sintaxe de scripts JS (`node --check`).
  - Deploy automático da pasta `web/` no GitHub Pages a cada push/merge na `main`.

---

## 3. Estrutura Atualizada do Repositório

```
PROJETO-HACKATON-2026/
├── .github/
│   ├── workflows/qodo_review.yml     # Revisão de PRs com Qodo Merge
│   ├── workflows/ci.yml              # CI contínua + Deploy GitHub Pages
│   ├── pull_request_template.md      # Checklist de PR (acessibilidade, bio, testes)
│   └── ISSUE_TEMPLATE/               # Templates de Bug e Feature
├── .pr_agent.toml                    # Regras de revisão inteligente do Qodo
├── README.md                         # Documentação executiva de Hackathon
├── firmware/
│   └── esp32_phytosense_node.ino     # Firmware C++ ESP32-C3 (bioimpedância, ORP, LittleFS, Deep Sleep)
├── bot/
│   ├── phytosense_bot.py             # Bot Telegram zero digitação e áudio
│   ├── telemetria.py                 # Modelo eletrofisiológico e economia por hectare
│   ├── conteudo.py                   # Mensagens acolhedoras e laudo PROAGRO
│   ├── roteamento.py                 # Roteamento inteligente de tópicos e atalhos
│   ├── setup_telegram_bot.py         # Configuração automática do BotFather
│   ├── Dockerfile & railway.json     # Deploy 24/7 na Railway
│   └── tests/test_bot.py             # 8 testes unitários passando (pytest)
├── web/
│   ├── index.html                    # 3 abas, Dark Mode campo, voz e canvas
│   ├── css/styles.css                # Dark mode de alto contraste (#0b0b0b, #ff6b00)
│   ├── js/app.js                     # Controlador das abas, voz TTS e simuladores
│   ├── js/canvas_planta.js           # Animação do caule, clipe laranja e onda senoidal
│   ├── js/charts.js                  # Gráficos Chart.js (divergência Dia 6 + consumo log)
│   ├── js/content.js                 # Dicionários de telemetria e FAQs
│   ├── js/telegram.js                # Integração com Telegram WebApp
│   ├── icons/icon.svg                # Ícone Tekó Biotech
│   ├── manifest.webmanifest          # PWA Manifest
│   └── sw.js                         # Service Worker offline (phytosense-v3)
├── extension/                        # Extensão de acessibilidade rural (Manifest V3)
└── docs/
    ├── QODO-AUTOMATION.md            # Guia de comandos do Qodo (/review, /improve, /describe)
    ├── ACESSIBILIDADE-UX.md          # Diretrizes de usabilidade e WCAG
    ├── CONFIGURACAO-TELEGRAM.md      # Manual de configuração do Bot no Telegram
    └── CHAT-ANTIGRAVITY.md           # Este registro de decisões
```
