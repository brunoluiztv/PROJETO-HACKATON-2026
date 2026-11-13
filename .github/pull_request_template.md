## 📌 Descrição do Pull Request

<!-- Descreva de forma clara e objetiva o que este PR altera, corrige ou implementa -->

### 🎯 Motivação & Contexto (Desafio 02 UERGS: Água e Drenagem Rural)
<!-- Explique o problema resolvido ou a melhoria técnica adicionada ao ecossistema Tekó Biotech -->

## 🔬 Componentes Afetados
- [ ] 📱 Frontend / Telegram Mini App PWA (`web/`)
- [ ] 🤖 Bot do Telegram Tekó (`bot/`)
- [ ] ⚡ Backend FastAPI & Banco de Dados (`backend/`)
- [ ] 🔌 Firmware Embarcado ESP32 / Gateway (`firmware/`)
- [ ] 🧩 Extensão de Acessibilidade (`extension/`)
- [ ] 📖 Documentação / CI / GitHub Workflows (`docs/`, `.github/`)

## 🌾 Checklist de Aceite Técnico & Fitoeletrônico (Tekó Biotech)
- [ ] **Acessibilidade Rural WCAG 2.2 AA**: Alvos de toque >= 48px, alto contraste sob luz solar forte (#0b0b0b, #ff6b00) e suporte à síntese de voz.
- [ ] **Rigor Eletrofisiológico**:
  - Bioimpedância dual-frequency validada (50 kHz para turgor celular, 1 kHz para fluxo apoplástico/xilema).
  - Deteção de asfixia radicular na enchente via ORP < -100 mV (P-MFC Geobacter).
- [ ] **Consistência de Manejo e Custos**:
  - Limites críticos calibrados segundo literatura Embrapa.
  - Indicadores de economia de diesel e litros de água coerentes em todos os estados da planta.
- [ ] **Segurança Absoluta**: Nenhum token (`TELEGRAM_TOKEN`), credencial ou segredo foi exposto em commits.
- [ ] **Testes Automatizados**: `pytest` aprovado (100%) e validação sintática do JS (`node --check`) sem erros.

---
> 🤖 **Code Review com IA:** Este repositório conta com revisão automatizada via **CodeRabbit AI** e **Qodo Merge**. Interaja nos comentários do PR com `/review`, `/improve` ou `/ask` para esclarecer dúvidas técnicas com a IA.
