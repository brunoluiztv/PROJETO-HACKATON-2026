# 🧠 Guia de Contexto & Memória do Agente Antigravity (IA)

**Projeto:** Tekó Biotech — Sistema de Biomonitoramento In-Planta & Drenagem Rural  
**Hackathon das Engenharias UERGS 2026** — Desafio 02: Água para o Futuro e Drenagem Urbana  
**Foco:** Agricultura Familiar e Olericultura no Rio Grande do Sul  
**Padrão de Skills:** [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) (veja a pasta [`skills/`](../skills/README.md))

---

## 0. Playbooks de Agentes & Skills (AAS Standard)
As instruções modulares para os agentes de IA do repositório estão organizadas no padrão `agentic-awesome-skills`:
* [`skills/teko-inplanta-biomonitoring/SKILL.md`](../skills/teko-inplanta-biomonitoring/SKILL.md) — Eletrofisiologia, Bioimpedância (50k/1k), ORP (< -100 mV), Embrapa e PROAGRO.
* [`skills/teko-rural-accessibility-ux/SKILL.md`](../skills/teko-rural-accessibility-ux/SKILL.md) — Zero Digitação, WCAG 2.2 AA, temas escuro/claro e narração TTS.
* [`skills/teko-iot-ninhura-gateway/SKILL.md`](../skills/teko-iot-ninhura-gateway/SKILL.md) — ESP32-C3, ESP-NOW 4ms, Deep Sleep 10 µA, P-MFC e LittleFS.
* [`skills/teko-backend-prediction/SKILL.md`](../skills/teko-backend-prediction/SKILL.md) — FastAPI, SQLite, motor de secagem e outbox de alertas.

---

## 1. Identidade e Missão da IA
Você atua como **Arquiteto de Software Full-Stack Sênior e Especialista em Engenharia de IoT/Biotecnologia**. Sua responsabilidade é manter o repositório organizado, estável e perfeitamente integrado entre hardware ESP32, backend FastAPI (SQLite), Telegram Mini App e Bot do Telegram.

---

## 2. Regras de Ouro do Projeto (Invioláveis)

1. **FOCO ÚNICO EM SECA E ESTRESSE HÍDRICO (TENSÃO EM KPA):**
   - O diferencial tecnológico central é o cálculo da **taxa de secagem ($\Delta \text{kPa}/\text{dia}$)** e da **contagem regressiva de dias até o estresse hídrico**.
   - Sensores de umidade volumétrica (%) convencionais enganam o produtor. O sistema foca no **Potencial Matricial ($\Psi_m$ em kPa)**.
2. **PARÂMETROS DE DOMÍNIO NUNCA SÃO HIPOTÉTICOS:**
   - Limites de manejo e capacidade de campo vêm diretamente da **Embrapa Hortaliças**, **Embrapa Milho e Sorgo** e **Embrapa Clima Temperado**.
   - Nunca inventar valores fisiológicos das culturas.
3. **TELEMETRIA DE DEMONSTRAÇÃO É SIMULADA (MOCKADA):**
   - A dinâmica hídrica do solo opera em dias. Para a banca de 5 minutos, o banco SQLite já inicia com **7 dias de leituras simuladas** mostrando a secagem gradual.
4. **ESTRATÉGIA "90% HISTÓRICO + 10% GATILHO AO VIVO":**
   - 90% dos dados já vêm pré-carregados no banco para alimentar os gráficos do Dashboard desde o primeiro segundo.
   - Os 10% restantes são o **gatilho de bancada do hardware**: o apresentador retira o sensor do vaso de terra molhada para o ar seco $\to$ ADC salta de $1200 \to 3800$ $\to$ tensão sobe para $> 48\text{ kPa}$ $\to$ o Telegram vibra com alerta urgente e o Dashboard fica vermelho ao vivo!
5. **ACESSIBILIDADE RURAL WCAG 2.2 AA / ZERO DIGITAÇÃO:**
   - O produtor rural não precisa digitar nada: botões gigantes ($\ge 48\text{px}$), alto contraste Dark Mode (`#0b0b0b`, `#ff6b00`), narração por voz nativa (`window.speechSynthesis`) e linguagem simples e acolhedora.
6. **ZERO TERMOS ANTIGOS:**
   - Não incluir referências a "sacos biodegradáveis", "casca de arroz" ou "leitura óptica colorimétrica de fitas".

---

## 3. Divisão de Papéis da Equipe
- **Dev 1 (Backend & Predição):** API FastAPI (`backend/server.py`), Banco SQLite (`phytosense.db`), motor preditivo (`backend/motor_predicao.py`), rotas REST e webhooks.
- **Dev 2 (Frontend & Chatbot):** Dashboard Web / Mini App (`web/`), integração Chart.js (`web/js/charts.js`), Bot Telegram (`bot/phytosense_bot.py`).
- **Dev 3 (Firmware & Hardware):** Firmware Arduino ESP32 (`firmware/esp32_phytosense_arduino/`), conversão analógica ADC e conectividade Wi-Fi/HTTP.

---

## 4. Contratos de Dados V1

### Payload de Telemetria do Gateway ESP32:
```json
{
  "node_id": "esp32_no_01",
  "tensao_kpa": 25.5,
  "tipo_solo": "franco",
  "resistencia_ohms": 2150.0,
  "z_50k_ohms": 1400.0,
  "z_1k_ohms": 3800.0,
  "orp_mv": 310.0,
  "ce_dsm": 1.2,
  "pmfc_mv": 480.0,
  "bateria_mv": 3300,
  "rssi": -62
}
```

### Payload do Teste de Bancada (Caetano):
```json
{
  "leitura_adc": 3800,
  "no_id": "esp32_no_01",
  "id_perfil": "olericultura_alface_argissolo",
  "temp_c": 25.0,
  "bateria_mv": 3300
}
```

### Payload do Gateway da Ninhura (ESP-NOW -> HTTP):
```json
{
  "gateway_id": "esp32_gateway",
  "no_id": "esp32_no_01",
  "leitura_adc": 1800,
  "id_perfil": "olericultura_alface_argissolo",
  "temp_c": 23.5,
  "bateria_mv": 3300,
  "rssi_espnow": -64
}
```

---

## 5. Arquitetura da Ninhura & Decisão de Engenharia

A topologia de campo divide os dispositivos em:
- **Camada de Aquisição:** Nós Sentinelas 1, 2 e 3 (ESP32 em Deep Sleep coletando tensão matricial $\Psi_m$ e bioimpedância).
- **Protocolo de Campo:** ESP-NOW (transmissão rápida de 4 ms sem handshake de rede, ultra-baixo consumo).
- **ESP32 Gateway:** Receptor centralizado na sede rural que converte os pacotes do rádio ESP-NOW em chamadas REST `POST /api/telemetria/gateway` via Wi-Fi/4G.
- **Backend FastAPI:** Gerencia o banco SQLite, motor preditivo de taxa de secagem da Embrapa e despacha notificações para o WebApp e Bot do Telegram.

> **Princípio Chave:** O ESP32 não se comunica diretamente com o Telegram para não sobrecarregar o microcontrolador, preservar a autonomia da bateria e blindar o token de autenticação no servidor.

---

## 6. Referência: Estado Hídrico do Solo & Água Disponível (AD %)

- **Saturação ($0\text{ kPa}$, $100\%$ AD):** Excesso de água e falta de oxigênio nas raízes (hipóxia/anóxia radicular).
- **Capacidade de Campo ($-10\text{ a }-33\text{ kPa}$, $100\%$ AD):** Condição ideal de umidade e aeração.
- **Início do Estresse / Fator $p$ ($-30\text{ a }-70\text{ kPa}$, $40\%\text{ a }60\%$ AD):** Ponto crítico para irrigação sem perda produtiva.
- **Estresse Moderado a Severo ($-100\text{ a }-500\text{ kPa}$, $15\%\text{ a }35\%$ AD):** Fechamento estomático e murcha.
- **Ponto de Murcha Permanente ($-1.500\text{ kPa}$, $0\%$ AD):** Água retida irreversivelmente; planta não recupera o turgor.

---

## 7. Instruções para Manutenção Futura
- Toda nova funcionalidade deve incluir testes unitários em `backend/tests/` ou `bot/tests/`.
- Ao alterar scripts JS em `web/`, valide com `node --check <arquivo>`.
- Mantenha a documentação centralizada atualizada em `docs/`.
