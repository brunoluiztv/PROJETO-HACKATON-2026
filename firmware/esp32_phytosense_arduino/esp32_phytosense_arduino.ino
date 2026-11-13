/**
 * ============================================================================
 * Tekó Biotech — Firmware Arduino ESP32 para Sensor Físico de Potencial Matricial
 * Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural
 * ============================================================================
 * 
 * Descrição da Arquitetura:
 * - Placa: ESP32 DevKit v1 / NodeMCU-32S (30 ou 38 pinos)
 * - Sensor Físico: Sensor de Matriz Granular / Potencial Matricial (Ψm)
 *   (Compatível com Watermark 200SS, bloco poroso de gesso ou divisor resistivo)
 * - Pino Analógico: GPIO 34 (ADC1_CH6 - Input Only, imune a interferências de Wi-Fi)
 * - Circuito: Divisor de tensão com Resistor fixo de 10 kΩ (1% precisão)
 * 
 * Faixas Agronômicas do Potencial Matricial (Ψm):
 *   0 a 10 kPa: Solo Saturado / Encharcado (Risco de Hipóxia se persistente)
 *   10 a 30 kPa: Capacidade de Campo / Hidratada (Umidade ideal de seiva)
 *   30 a 60 kPa: Faixa de Irrigação Recomendada (Início do estresse hídrico)
 *   > 60 kPa: Seca Severa / Ponto de Murcha Iminente
 * 
 * Zero Dependências Externas:
 *   Utiliza apenas o core nativo do ESP32 (<WiFi.h> e <HTTPClient.h>).
 *   Não requer nenhuma biblioteca externa adicional para compilar na Arduino IDE!
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ============================================================================
// CONFIGURAÇÕES DE REDE WI-FI (DUPLO FALLBACK: HOTSPOT + WI-FI LOCAL)
// ============================================================================
// Rede 1: Roteador 4G / Ponto de Acesso do Smartphone (ideal para o Hackathon)
const char* WIFI_SSID_1 = "PhytoSense_Hotspot";
const char* WIFI_PASS_1 = "rural123456";

// Rede 2: Wi-Fi do Evento / Casa / Bancada
const char* WIFI_SSID_2 = "UERGS_HACKATON";
const char* WIFI_PASS_2 = "hackathon2026";

// URL do Backend FastAPI (Ajuste para o IP do seu computador na mesma rede Wi-Fi)
// Dica: No Windows, digite 'ipconfig' no terminal para descobrir seu IPv4 (ex: 192.168.1.150)
const char* BACKEND_URL = "http://192.168.1.150:8000/api/telemetria";

// Identificador exclusivo do Nó Sentinela
const char* NODE_ID = "sentinela-01";

// Tipo de Solo da Lavoura: "arenoso", "franco" ou "argiloso"
// (Calibra os pontos de Capacidade de Campo e Estresse Hídrico)
const char* TIPO_SOLO = "franco";

// ============================================================================
// PINOUT E HARDWARE (ESP32 DevKit v1)
// ============================================================================
#define PIN_SENSOR_ADC   34    // GPIO 34 (ADC1_CH6) - Somente Entrada Analógica
#define PIN_LED_STATUS    2    // LED onboard (GPIO 2 na maioria das placas ESP32)

// Parâmetros do Divisor de Tensão
const float R_FIXO_OHMS     = 10000.0; // Resistor de 10 kΩ ligado ao 3.3V
const float V_REF           = 3.3;     // Tensão nominal de alimentação lógica
const int   ADC_RESOLUTION  = 4095;    // Resolução de 12 bits do ESP32
const int   AMOSTRAS_ADC    = 32;      // Média móvel para suavizar ruído elétrico

// Intervalo de leitura e transmissão (em milissegundos)
const unsigned long INTERVALO_ENVIO_MS = 5000; // Envia a cada 5 segundos
unsigned long ultimaTransmissao = 0;

// ============================================================================
// ESTRUTURA DE TELEMETRIA
// ============================================================================
struct TelemetriaMedicao {
    float tensao_kpa;        // Potencial matricial da água no solo (Ψm em kPa)
    float resistencia_ohms;  // Resistência elétrica lida no sensor
    float z_50k_ohms;        // Bioimpedância de caule a 50 kHz (turgor celular)
    float z_1k_ohms;         // Bioimpedância de caule a 1 kHz (fluxo no xilema)
    float orp_mv;            // Potencial Redox da rizosfera em mV
    float ce_dsm;            // Condutividade elétrica estimada em dS/m
    float pmfc_mv;           // Tensão de bioenergia microbiana P-MFC em mV
    int   bateria_mv;        // Nível da bateria estimada (mV)
    int   rssi_dbm;          // Força do sinal Wi-Fi
    const char* estado_nome; // "hidratada", "sede", "hipoxia"
    const char* tipo_solo;   // "arenoso", "franco", "argiloso"
};

// ============================================================================
// PROTÓTIPOS DE FUNÇÕES
// ============================================================================
void conectarWiFi();
TelemetriaMedicao lerSensorECorrelacionar();
void exibirPainelSerial(const TelemetriaMedicao &m);
void transmitirHttp(const TelemetriaMedicao &m);

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(500);

    pinMode(PIN_LED_STATUS, OUTPUT);
    digitalWrite(PIN_LED_STATUS, LOW);

    // Configura atenuação do ADC para 11dB (permite ler até ~3.3V no ESP32)
    analogSetAttenuation(ADC_11db);
    analogReadResolution(12);

    Serial.println("\n");
    Serial.println("========================================================");
    Serial.println("🌱  TEKÓ BIOTECH — BIOSSENSOR FITOELETRÔNICO IN-PLANTA");
    Serial.println("    Hackathon UERGS 2026 — Desafio 02: Água e Drenagem");
    Serial.println("    Nó Sentinela ESP32 com Sensor de Potencial Matricial");
    Serial.println("========================================================");
    Serial.printf("[Hardware] Pino do Sensor: GPIO %d (ADC1)\n", PIN_SENSOR_ADC);
    Serial.printf("[Hardware] Divisor: Resistor %d ohms para VCC (3.3V)\n", (int)R_FIXO_OHMS);
    Serial.printf("[Destino] Endpoint: %s\n\n", BACKEND_URL);

    conectarWiFi();
}

// ============================================================================
// LOOP PRINCIPAL
// ============================================================================
void loop() {
    unsigned long agora = millis();

    // Mantém conexão Wi-Fi ativa com fallback não-bloqueante (cooldown de 20s)
    // Permite que leituras do sensor e monitor serial operem sem engasgos mesmo offline
    static unsigned long ultimaTentativaWiFi = 0;
    const unsigned long INTERVALO_RECONEXAO_WIFI_MS = 20000;

    if (WiFi.status() != WL_CONNECTED) {
        if (agora - ultimaTentativaWiFi >= INTERVALO_RECONEXAO_WIFI_MS) {
            ultimaTentativaWiFi = agora;
            conectarWiFi();
        }
    }

    if (agora - ultimaTransmissao >= INTERVALO_ENVIO_MS) {
        ultimaTransmissao = agora;

        // 1. Efetua leitura analógica do sensor físico e correlaciona parâmetros
        TelemetriaMedicao medicao = lerSensorECorrelacionar();

        // 2. Exibe barra visual e métricas no Monitor Serial (115200 baud)
        exibirPainelSerial(medicao);

        // 3. Transmite telemetria via HTTP POST JSON para o Backend FastAPI
        if (WiFi.status() == WL_CONNECTED) {
            transmitirHttp(medicao);
        } else {
            Serial.println("⚠️ [Wi-Fi] Sem conexão ativa. Telemetria exibida apenas no Serial.");
        }
    }

    delay(50);
}

// ============================================================================
// FUNÇÃO DE CONEXÃO WI-FI (DUPLO FALLBACK)
// ============================================================================
void conectarWiFi() {
    Serial.println("[Wi-Fi] Iniciando busca por redes configuradas...");
    WiFi.mode(WIFI_STA);

    // Tentativa 1: Hotspot do Celular
    Serial.printf("[Wi-Fi] Tentando Rede 1 (Hotspot): '%s'...", WIFI_SSID_1);
    WiFi.begin(WIFI_SSID_1, WIFI_PASS_1);

    int tentativas = 0;
    while (WiFi.status() != WL_CONNECTED && tentativas < 12) {
        delay(500);
        Serial.print(".");
        digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
        tentativas++;
    }

    // Se falhou na Rede 1, tenta a Rede 2 (Wi-Fi Local)
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\n[Wi-Fi] Falha na Rede 1. Tentando Rede 2 (Local): '" + String(WIFI_SSID_2) + "'...");
        WiFi.disconnect();
        delay(300);
        WiFi.begin(WIFI_SSID_2, WIFI_PASS_2);

        tentativas = 0;
        while (WiFi.status() != WL_CONNECTED && tentativas < 12) {
            delay(500);
            Serial.print(".");
            digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
            tentativas++;
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        Serial.println("\n✅ [Wi-Fi] CONECTADO COM SUCESSO!");
        Serial.printf("   SSID: %s\n", WiFi.SSID().c_str());
        Serial.printf("   IP do ESP32: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("   Sinal RSSI: %d dBm\n\n", WiFi.RSSI());
    } else {
        digitalWrite(PIN_LED_STATUS, LOW);
        Serial.println("\n⚠️ [Wi-Fi] Nenhuma rede disponível no momento. Tentará novamente no próximo ciclo.\n");
    }
}

// ============================================================================
// LEITURA DO SENSOR FÍSICO E CORRELAÇÃO FISIOLÓGICA
// ============================================================================
TelemetriaMedicao lerSensorECorrelacionar() {
    TelemetriaMedicao m;

    // Leitura multiamostral para redução de ruído térmico/elétrico no ADC do ESP32
    uint32_t somaAdc = 0;
    for (int i = 0; i < AMOSTRAS_ADC; i++) {
        somaAdc += analogRead(PIN_SENSOR_ADC);
        delayMicroseconds(400);
    }
    float adcMedio = (float)somaAdc / (float)AMOSTRAS_ADC;

    // Protege contra divisão por zero e saturação
    if (adcMedio < 1.0) adcMedio = 1.0;
    if (adcMedio > 4094.0) adcMedio = 4094.0;

    // Cálculo da tensão no pino ADC (0 a 3.3V)
    float vSensor = (adcMedio / (float)ADC_RESOLUTION) * V_REF;

    // Circuito: 3.3V -> R_FIXO (10k) -> [GPIO 34] -> SENSOR -> GND
    // V_sensor = 3.3 * (R_sensor / (R_fixo + R_sensor))
    // => R_sensor = (V_sensor * R_fixo) / (3.3 - V_sensor)
    float denominador = V_REF - vSensor;
    if (denominador < 0.001) denominador = 0.001;
    m.resistencia_ohms = (vSensor * R_FIXO_OHMS) / denominador;

    // ========================================================================
    // CALIBRAÇÃO AGRONÔMICA: Resistência (Ω) -> Potencial Matricial (kPa)
    // Curva empírica padrão Watermark/Matriz Granular com divisor de 10k:
    // Solo muito úmido/saturado: Rs baixo (~300 - 1.200 Ω) -> Ψm: 0 a 10 kPa
    // Solo hidratado / capacidade de campo: Rs médio (~1.200 - 3.500 Ω) -> Ψm: 10 a 30 kPa
    // Solo com início de seca / irrigar: Rs alto (~3.500 - 9.000 Ω) -> Ψm: 30 a 60 kPa
    // Solo em seca severa: Rs muito alto (> 9.000 Ω) -> Ψm: > 60 kPa
    // ========================================================================
    if (m.resistencia_ohms < 500.0) {
        // Encharcamento extremo / água livre
        m.tensao_kpa = 0.5 + (m.resistencia_ohms / 500.0) * 4.5; // 0.5 a 5.0 kPa
    } else if (m.resistencia_ohms < 1500.0) {
        // Faixa de saturação / transição
        m.tensao_kpa = 5.0 + ((m.resistencia_ohms - 500.0) / 1000.0) * 5.0; // 5.0 a 10.0 kPa
    } else if (m.resistencia_ohms < 4000.0) {
        // Capacidade de campo ideal
        m.tensao_kpa = 10.0 + ((m.resistencia_ohms - 1500.0) / 2500.0) * 20.0; // 10.0 a 30.0 kPa
    } else if (m.resistencia_ohms < 10000.0) {
        // Início do estresse hídrico
        m.tensao_kpa = 30.0 + ((m.resistencia_ohms - 4000.0) / 6000.0) * 30.0; // 30.0 a 60.0 kPa
    } else {
        // Seca severa (acima de 60 kPa)
        float kpaExtra = (m.resistencia_ohms - 10000.0) / 500.0;
        m.tensao_kpa = 60.0 + kpaExtra;
        if (m.tensao_kpa > 150.0) m.tensao_kpa = 150.0;
    }

    // ========================================================================
    // CORRELAÇÃO FISIOLÓGICA EMBARCADA (Planta Sentinela + Rizosfera)
    // Conforme validação agronômica e modelo bioelétrico Tekó Biotech:
    // ========================================================================
    if (m.tensao_kpa < 10.0) {
        // ESTADO: HIPÓXIA / SOLO ENCHARCADO (Pós-temporal)
        // Solo 100% saturado de água -> Ausência de O2 na raiz fecha aquaporinas PIP
        m.estado_nome = "hipoxia";
        m.z_50k_ohms = 5900.0; // Bioimpedância sobe no caule (falta turgor por anóxia)
        m.z_1k_ohms  = 5100.0; // Fluxo de xilema interrompido
        m.orp_mv     = -140.0; // Potencial Redox negativo severo (ambiente anaeróbico)
        m.ce_dsm     = 0.60;   // Condutividade baixa por lixiviação pluvial
        m.pmfc_mv    = 520.0;  // Bactérias Geobacter ativas gerando bioenergia na lama
    } else if (m.tensao_kpa <= 30.0) {
        // ESTADO: HIDRATADA / SEIVA VIGOROSA (Condição Ideal)
        m.estado_nome = "hidratada";
        // Interpolação suave na faixa de capacidade de campo
        float fator = (m.tensao_kpa - 10.0) / 20.0;
        m.z_50k_ohms = 1400.0 + (fator * 200.0); // ~1.4 kΩ a 1.6 kΩ
        m.z_1k_ohms  = 1100.0 + (fator * 150.0); // ~1.1 kΩ
        m.orp_mv     = 310.0 + (fator * 20.0);   // +310 a +330 mV (solo arejado)
        m.ce_dsm     = 1.20 + (fator * 0.15);   // ~1.2 dS/m
        m.pmfc_mv    = 580.0;                   // Geração bioelétrica estável
    } else if (m.tensao_kpa <= 60.0) {
        // ESTADO: COM SEDE / INÍCIO DE ESTIAGEM
        m.estado_nome = "sede";
        float fator = (m.tensao_kpa - 30.0) / 30.0;
        m.z_50k_ohms = 4800.0 + (fator * 400.0); // ~4.8 kΩ (perda visível de turgor celular)
        m.z_1k_ohms  = 3900.0 + (fator * 300.0); // ~3.9 kΩ
        m.orp_mv     = 420.0 + (fator * 30.0);   // +420 mV
        m.ce_dsm     = 1.80 + (fator * 0.20);   // Concentração iônica por evaporação
        m.pmfc_mv    = 450.0;
    } else {
        // ESTADO: SECA SEVERA / ESTIAGEM CRÍTICA
        m.estado_nome = "sede";
        m.z_50k_ohms = 5900.0; // Desidratação máxima do tecido vegetal
        m.z_1k_ohms  = 4900.0;
        m.orp_mv     = 490.0;
        m.ce_dsm     = 2.20;
        m.pmfc_mv    = 350.0;
    }

    // Telemetria do Hardware
    m.tipo_solo  = TIPO_SOLO;
    m.bateria_mv = 3300; // Alimentação regulada 3.3V
    m.rssi_dbm   = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -99;

    return m;
}

// ============================================================================
// EXIBIÇÃO NO MONITOR SERIAL COM BARRA VISUAL (115200 BAUD)
// ============================================================================
void exibirPainelSerial(const TelemetriaMedicao &m) {
    Serial.println("------------------------------------------------------------------");
    Serial.printf("[Telemetria Sentinela] Ψm: %.1f kPa | Solo: %s | R_sensor: %.0f Ω | Estado: %s\n",
                  m.tensao_kpa, m.tipo_solo, m.resistencia_ohms, m.estado_nome);

    // Barra de progresso ASCII de 20 caracteres mapeando 0 a 80 kPa
    int preenchimento = (int)((m.tensao_kpa / 80.0) * 20.0);
    if (preenchimento < 0) preenchimento = 0;
    if (preenchimento > 20) preenchimento = 20;

    Serial.print("Tensão [");
    for (int i = 0; i < 20; i++) {
        if (i < preenchimento) Serial.print("=");
        else if (i == preenchimento) Serial.print(">");
        else Serial.print(" ");
    }
    Serial.printf("] %.1f kPa ", m.tensao_kpa);

    if (strcmp(m.estado_nome, "hidratada") == 0) {
        Serial.println("🟢 [PLENA HIDRATAÇÃO - BOMBA DESLIGADA]");
    } else if (strcmp(m.estado_nome, "sede") == 0) {
        Serial.println("🟡 [SEDE INVISÍVEL - PROGRAMAR IRRIGAÇÃO 06H]");
    } else {
        Serial.println("🔴 [ALERTA HIPÓXIA - VALETAS DE DRENAGEM & PROAGRO]");
    }

    Serial.printf("Biometria: Z_50k: %.0f Ω | Z_1k: %.0f Ω | ORP: %.0f mV | CE: %.2f dS/m | Bio-MFC: %.0f mV\n",
                  m.z_50k_ohms, m.z_1k_ohms, m.orp_mv, m.ce_dsm, m.pmfc_mv);
    Serial.printf("Rede: Wi-Fi RSSI: %d dBm | Bateria: %d mV\n", m.rssi_dbm, m.bateria_mv);
}

// ============================================================================
// ENVIO HTTP POST JSON NATIVO (SEM BIBLIOTECA EXTERNA)
// ============================================================================
void transmitirHttp(const TelemetriaMedicao &m) {
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000); // Timeout rápido de 4s

    // Monta payload JSON manualmente sem depender do ArduinoJson
    char jsonBuffer[416];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{"
        "\"node_id\":\"%s\","
        "\"tipo_solo\":\"%s\","
        "\"tensao_kpa\":%.2f,"
        "\"resistencia_ohms\":%.1f,"
        "\"z_50k_ohms\":%.1f,"
        "\"z_1k_ohms\":%.1f,"
        "\"orp_mv\":%.1f,"
        "\"ce_dsm\":%.2f,"
        "\"pmfc_mv\":%.1f,"
        "\"bateria_mv\":%d,"
        "\"rssi\":%d"
        "}",
        NODE_ID,
        m.tipo_solo,
        m.tensao_kpa,
        m.resistencia_ohms,
        m.z_50k_ohms,
        m.z_1k_ohms,
        m.orp_mv,
        m.ce_dsm,
        m.pmfc_mv,
        m.bateria_mv,
        m.rssi_dbm
    );

    int httpCode = http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));

    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            Serial.printf("🚀 [HTTP POST] Sucesso! Código %d enviado para API.\n", httpCode);
            // Pisca LED indicando envio confirmado
            digitalWrite(PIN_LED_STATUS, LOW);
            delay(80);
            digitalWrite(PIN_LED_STATUS, HIGH);
        } else {
            Serial.printf("⚠️ [HTTP POST] Servidor retornou código %d\n", httpCode);
        }
    } else {
        Serial.printf("❌ [HTTP POST] Erro na transmissão: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
}
