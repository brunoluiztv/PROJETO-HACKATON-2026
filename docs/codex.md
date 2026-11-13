# 💻 Manual Técnico & Especificações de Código (Codex)

**Tekó Biotech — Arquitetura de Software & Hardware**  
**Hackathon das Engenharias UERGS 2026**  
**Skills Catalog:** Veja playbooks padronizados em [`skills/`](../skills/README.md) (padrão `sickn33/agentic-awesome-skills`).

---

## 1. Esquema do Banco de Dados SQLite (`backend/phytosense.db`)

O banco SQLite é inicializado automaticamente pelo módulo `backend/database.py` e populado por `backend/seed_demo_data.json`:

```sql
-- Tabela de Perfis Científicos Embrapa
CREATE TABLE perfis_cultura (
    id_perfil TEXT PRIMARY KEY,
    cultura TEXT NOT NULL,
    solo TEXT NOT NULL,
    profundidade_raiz_cm INTEGER NOT NULL,
    tensao_capacidade_campo_kpa REAL NOT NULL,
    tensao_alerta_kpa REAL NOT NULL,
    tensao_critica_manejo_kpa REAL NOT NULL,
    tensao_ponto_murcha_kpa REAL NOT NULL,
    fonte_cientifica TEXT NOT NULL
);

-- Tabela de Leituras Históricas (7 Dias + Leituras ao Vivo)
CREATE TABLE leituras_historicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_id TEXT NOT NULL,
    id_perfil TEXT NOT NULL,
    dia_label TEXT NOT NULL,
    timestamp_iso TEXT NOT NULL,
    tensao_kpa REAL NOT NULL,
    temp_c REAL,
    bateria_mv INTEGER,
    is_simulado INTEGER DEFAULT 1,
    FOREIGN KEY (id_perfil) REFERENCES perfis_cultura (id_perfil)
);

-- Tabela de Alertas Disparados (Telegram Webhooks)
CREATE TABLE alertas_disparados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_iso TEXT NOT NULL,
    no_id TEXT NOT NULL,
    id_perfil TEXT NOT NULL,
    tensao_kpa REAL NOT NULL,
    taxa_secagem_kpa_dia REAL NOT NULL,
    dias_restantes REAL NOT NULL,
    status TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    enviado_telegram INTEGER DEFAULT 0
);
```

---

## 2. Tabela de Referência Científica Embrapa

| `id_perfil` | Cultura | Solo | CC (kPa) | Alerta (kPa) | Manejo Crítico (kPa) | Murcha (kPa) | Fonte Científica |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `olericultura_alface_argissolo` | Alface Crespa | Argissolo Média | 12.0 | 20.0 | **28.0** | 40.0 | Embrapa Hortaliças |
| `olericultura_tomate_argissolo` | Tomate / Morango | Argissolo Média | 15.0 | 30.0 | **38.0** | 60.0 | Embrapa Hortaliças |
| `graos_feijao_textura_media` | Feijão | Textura Média | 20.0 | 35.0 | **45.0** | 70.0 | Embrapa Arroz e Feijão |
| `graos_milho_argissolo` | Milho Vegetativo | Argissolo Média | 18.0 | 35.0 | **50.0** | 80.0 | Embrapa Milho e Sorgo |

### 2.1 Tabela Física do Solo: Estado Hídrico & Água Disponível (AD %)

| Estado Hídrico do Solo | Potencial Matricial ($\Psi_m$) | Água Disponível (AD) | Condição para a Planta |
| :--- | :--- | :--- | :--- |
| **Saturação** | $0\text{ kPa}$ | $100\%$ | Excesso de água e falta de oxigênio nas raízes (anóxia/hipóxia). |
| **Capacidade de Campo (CC)** | $-10\text{ kPa}$ (arenoso) a $-33\text{ kPa}$ (argiloso) | $100\%$ (Limite superior) | Condição ideal de umidade e aeração. |
| **Início do Estresse (Fator $p$)** | $-30\text{ kPa}$ a $-70\text{ kPa}$ | $40\%\text{ a }60\%$ restantes | Ponto crítico para reiniciar a irrigação sem perda produtiva. |
| **Estresse Moderado a Severo** | $-100\text{ kPa}$ a $-500\text{ kPa}$ | $15\%\text{ a }35\%$ restantes | Fechamento estomático, redução da fotossíntese e murcha. |
| **Ponto de Murcha Permanente (PMP)** | $-1.500\text{ kPa}$ ($-1,5\text{ MPa}$) | $0\%$ | Água fortemente retida; a planta não recupera a turgidez. |

---

## 3. Fórmulas Matemáticas & Conversão de Hardware

### Conversão ADC para Potencial Matricial Simulado ($\text{kPa}$):
Sensor resistivo básico do kit conectado ao GPIO 34 (ADC 12 bits: $0\text{ a }4095$):
```python
def adc_para_kpa_simulado(leitura_adc: int) -> float:
    adc_min, adc_max = 1200, 4095  # 1200 = terra molhada (10 kPa), 4095 = ar seco (80 kPa)
    leitura_limitada = max(adc_min, min(leitura_adc, adc_max))
    proporcao_seca = (leitura_limitada - adc_min) / (adc_max - adc_min)
    return round(10.0 + (proporcao_seca * 70.0), 1)
```

### Taxa de Secagem do Solo ($\Delta \text{kPa}/\text{dia}$):
$$\Delta \text{kPa}/\text{dia} = \frac{\text{kPa}_{\text{última}} - \text{kPa}_{\text{primeira}}}{N - 1}$$

### Contagem Regressiva até o Estresse Hídrico:
$$\text{Dias Restantes} = \frac{\text{kPa}_{\text{limite\_Embrapa}} - \text{kPa}_{\text{atual}}}{\Delta \text{kPa}/\text{dia}}$$

---

## 4. Catálogo de Rotas da API FastAPI (`backend/server.py`)

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Uptime do servidor e status de integridade. |
| `GET` | `/api/perfis-cultura` | Lista perfis Embrapa cadastrados no SQLite. |
| `GET` | `/api/historico` | Retorna série temporal de 7 dias para gráficos. |
| `GET` | `/api/predicao` | Taxa de secagem, dias restantes e diagnóstico. |
| `GET` | `/api/telemetria/atual` | Leitura mais recente (física ou simulada). |
| `POST` | `/api/telemetria` | Ingestão padrão de telemetria completa do ESP32. |
| `POST` | `/api/telemetria/adc` | **Gatilho de bancada do Caetano** (converte ADC bruto e alerta). |
| `POST` | `/api/telemetria/gateway` | Ingestão de pacotes roteados pelo **ESP32 Gateway da Ninhura** (ESP-NOW). |
| `GET` | `/api/ninhura/nos` | Topologia da Ninhura (Nós 1, 2, 3 + Gateway) e status de link. |
| `POST` | `/api/config/solo` | Altera calibração do solo (arenoso, franco, argiloso). |
| `POST` | `/api/demo/reset` | Restaura os 7 dias simulados originais do pitch. |

---

## 5. Arquitetura da Ninhura (Mesh ESP-NOW + Gateway Centralizador)

```
[Nó 1 (ESP32 + Sensor)] ---\
[Nó 2 (ESP32 + Sensor)] ----+--> (ESP-NOW 2.4 GHz) --> [ESP32 Gateway]
[Nó 3 (ESP32 + Sensor)] ---/                                  |
                                                 (Wi-Fi / 4G + HTTP POST)
                                                               v
                                                      [Backend FastAPI]
                                                               |
                                                 +-------------+-------------+
                                                 |                           |
                                          [Dashboard Web]             [Telegram Bot]
```

### Decisão Arquitetural Crítica: Por que o ESP32 NÃO fala direto com o Telegram?
1. **Consumo Energético (Deep Sleep):** Uma conexão TLS/HTTPS direta com a API do Telegram exige handshake SSL/TLS pesado, mantendo o rádio ligado por 3 a 5 segundos (consumo de pico > 150 mA). Com o protocolo proprietário **ESP-NOW**, a transmissão do pacote binário de telemetria dura apenas **4 milissegundos**. O nó de campo retorna imediatamente ao modo Deep Sleep (10 µA), consumindo apenas 14 mAh/dia e operando por anos com bioenergia P-MFC e micro-painel solar.
2. **Topologia e Conectividade Rural:** O sinal de telefonia 4G ou Wi-Fi costuma estar restrito à sede da propriedade rural ou ao galpão principal. Instalar modems celulares em cada planta sentinela encareceria a solução e inviabilizaria a agricultura familiar. Com a Ninhura, múltiplos nós cobrem os talhões via rádio ESP-NOW de longo alcance e baixo custo, convergindo para um único Gateway centralizador na sede com Wi-Fi/4G.
3. **Desacoplamento e Segurança de Software:** O token secreto do Bot do Telegram, a persistência no SQLite e os motores preditivos de física do solo (Embrapa) rodam com segurança no servidor FastAPI, blindando as credenciais e evitando que falhas de rede no microcontrolador corrompam o fluxo de notificações para o agricultor.

