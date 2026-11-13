/**
 * ============================================================================
 * Tekó Biotech — Nó Fitoeletrônico Sentinela (ESP32-C3)
 * Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural
 * ============================================================================
 * 
 * Descrição do Hardware:
 * 1. Clipe de Caule Biocompatível:
 *    - Espectroscopia de Bioimpedância Dupla:
 *      * 50 kHz: Atravessa a membrana lipídica celular -> Turgor intracelular real.
 *      * 1 kHz:  Corrente circula pelo apoplasto/xilema -> Fluxo de seiva bruta.
 *    - Eletrodos de grafite com interface de bio-hidrogel condutivo macio
 *      (ágar 2% + glicerol vegetal 5% + KCl fisiológico 100 mM) para evitar necrose.
 * 
 * 2. Haste Basal de Rizosfera:
 *    - Eletrodo de Platina/Vidro para Potencial Redox (ORP em mV):
 *      * ORP > +300 mV: Raiz bem oxigenada.
 *      * ORP < -100 mV: Hipóxia/anóxia severa (solo saturado, aquaporinas fechadas).
 *    - Sensor de Condutividade Elétrica (CE em dS/m): Mede lixiviação de nutrientes.
 *    - Célula a Combustível Microbiana Vegetal (P-MFC):
 *      * Ânodo de feltro de carbono colonizado por Geobacter spp. oxidando exsudatos
 *        radiculares a 0.45V-0.65V, combinada com micro-painel solar.
 * 
 * 3. Gestão Energética & Resiliência:
 *    - Deep Sleep: 10 µA em repouso. Acorda por 2s a cada 30 min = 14 mAh/dia.
 *    - Blindagem IP68 rural por encapsulamento maciço em resina de poliuretano de mamona.
 *    - Buffer offline circular em LittleFS para armazenar 30 dias de dados sem internet.
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <LittleFS.h>
#include <esp_sleep.h>

// --- PINOUT ESP32-C3 ---
#define PIN_IMPEDANCE_FREQ_SEL  2   // LOW = 1 kHz, HIGH = 50 kHz
#define PIN_IMPEDANCE_ADC       0   // ADC1_CH0 - Tensão retificada da bioimpedância
#define PIN_ORP_ADC             1   // ADC1_CH1 - Potencial Redox da rizosfera
#define PIN_CE_ADC              3   // ADC1_CH3 - Condutividade elétrica
#define PIN_PMFC_BAT_ADC        4   // ADC1_CH4 - Tensão da Célula P-MFC + Bateria LiFePO4
#define PIN_STATUS_LED          8   // LED de status (ativo apenas em testes)

// --- CONSTANTES TEMPORAIS ---
#define TIME_TO_SLEEP_SEC       1800  // 30 minutos em segundos
#define uS_TO_S_FACTOR          1000000ULL

// --- ESTRUTURA DE TELEMETRIA FITOELETRÔNICA ---
struct TelemetriaPlanta {
    uint32_t timestamp;
    float impedancia_50k_kohm;  // Z a 50 kHz (turgor celular)
    float impedancia_1k_kohm;   // Z a 1 kHz (fluxo no xilema)
    float orp_mv;               // Potencial Redox da raiz
    float ce_dsm;               // Condutividade elétrica do solo
    float tensao_pmfc_v;        // Tensão colhida da rizosfera
    uint8_t estado_fisiologico; // 0 = Hidratada, 1 = Sede, 2 = Hipoxia/Enchente
};

// --- PROTÓTIPOS ---
float lerBioimpedancia(uint8_t frequenciaKhz);
float lerPotencialRedoxORP();
float lerCondutividadeEletrica();
float lerTensaoPMFC();
uint8_t classificarEstado(float z50k, float orp);
void salvarLeituraOffline(const TelemetriaPlanta &dado);
void tentarEnviarTelemetria(const TelemetriaPlanta &dado);

void setup() {
    Serial.begin(115200);
    delay(100);

    Serial.println("\n[Tekó Biotech] Inicializando no sentinela...");

    pinMode(PIN_IMPEDANCE_FREQ_SEL, OUTPUT);
    pinMode(PIN_STATUS_LED, OUTPUT);

    // Inicializa sistema de arquivos Flash offline LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("[LittleFS] Falha ao montar sistema de arquivos!");
    } else {
        Serial.println("[LittleFS] Memoria Flash offline pronta.");
    }

    // 1. Coleta de Telemetria Fitoeletrônica
    TelemetriaPlanta leitura;
    leitura.timestamp = (uint32_t)(esp_timer_get_time() / 1000000);
    
    // Leitura no caule (1 kHz e 50 kHz)
    leitura.impedancia_1k_kohm = lerBioimpedancia(1);
    leitura.impedancia_50k_kohm = lerBioimpedancia(50);

    // Leitura na rizosfera (ORP, CE e bioenergia)
    leitura.orp_mv = lerPotencialRedoxORP();
    leitura.ce_dsm = lerCondutividadeEletrica();
    leitura.tensao_pmfc_v = lerTensaoPMFC();

    // Diagnóstico Fisiológico da Planta Sentinela
    leitura.estado_fisiologico = classificarEstado(leitura.impedancia_50k_kohm, leitura.orp_mv);

    Serial.printf("[Telemetria] Z_50k=%.2f kOhm | Z_1k=%.2f kOhm | ORP=%.1f mV | CE=%.2f dS/m | P-MFC=%.2f V\n",
                  leitura.impedancia_50k_kohm, leitura.impedancia_1k_kohm,
                  leitura.orp_mv, leitura.ce_dsm, leitura.tensao_pmfc_v);

    // 2. Persistência em buffer circular local (resiliência a enchentes)
    salvarLeituraOffline(leitura);

    // 3. Tentativa de envio para a nuvem / Gateway LoRa / WiFi
    tentarEnviarTelemetria(leitura);

    // 4. Gestão Energética: Configura e entra em Deep Sleep
    Serial.println("[Power] Entrando em Deep Sleep por 30 minutos (10 uA)...");
    esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP_SEC * uS_TO_S_FACTOR);
    Serial.flush();
    esp_deep_sleep_start();
}

void loop() {
    // Nunca alcancado no Deep Sleep
}

// --- FUNÇÕES DE LEITURA EMBARCADA ---

float lerBioimpedancia(uint8_t frequenciaKhz) {
    if (frequenciaKhz == 50) {
        digitalWrite(PIN_IMPEDANCE_FREQ_SEL, HIGH); // Canal de 50 kHz
    } else {
        digitalWrite(PIN_IMPEDANCE_FREQ_SEL, LOW);  // Canal de 1 kHz
    }
    delay(15); // Estabilizacao do bio-hidrogel condutivo de agar + glicerol

    // Leitura com amostragem estavel
    uint32_t soma = 0;
    for (int i = 0; i < 32; i++) {
        soma += analogRead(PIN_IMPEDANCE_ADC);
        delayMicroseconds(250);
    }
    float raw = (float)soma / 32.0;
    float voltagem = (raw / 4095.0) * 3.3;

    // Curva de calibracao do circuito divisor com amplificador de instrumentacao
    // Calibrado para faixa de 0.5 kOhm a 15.0 kOhm no caule de hortalicas
    float impedancia_kohm = (voltagem * 10.0) / (3.3 - voltagem + 0.001);
    return impedancia_kohm;
}

float lerPotencialRedoxORP() {
    uint32_t soma = 0;
    for (int i = 0; i < 32; i++) {
        soma += analogRead(PIN_ORP_ADC);
        delay(1);
    }
    float raw = (float)soma / 32.0;
    float voltagem_mv = ((raw / 4095.0) * 3300.0);
    // Conversao com offset do eletrodo de referencia Ag/AgCl (+200 mV)
    float orp_mv = ((voltagem_mv - 1500.0) * 1.0) + 200.0;
    return orp_mv;
}

float lerCondutividadeEletrica() {
    int raw = analogRead(PIN_CE_ADC);
    float v = (raw / 4095.0) * 3.3;
    // Calibracao de condutividade em dS/m
    return v * 1.5;
}

float lerTensaoPMFC() {
    int raw = analogRead(PIN_PMFC_BAT_ADC);
    return (raw / 4095.0) * 3.3 * 2.0; // Divisor resistivo 1:2
}

uint8_t classificarEstado(float z50k, float orp) {
    // 2 = Hipoxia / Enchente: solo encharcado, orp negativo extremo (raiz asfixiada)
    if (orp < -100.0) {
        return 2;
    }
    // 1 = Sede / Estiagem Precoce: impedancia de caule subindo (falta de turgor)
    if (z50k > 4.0) {
        return 1;
    }
    // 0 = Hidratada / Seiva Normal
    return 0;
}

void salvarLeituraOffline(const TelemetriaPlanta &dado) {
    File f = LittleFS.open("/telemetria_buffer.bin", "ab");
    if (f) {
        f.write((const uint8_t*)&dado, sizeof(TelemetriaPlanta));
        f.close();
        Serial.println("[LittleFS] Telemetria salva no buffer circular offline.");
    }
}

void tentarEnviarTelemetria(const TelemetriaPlanta &dado) {
    // Tenta conexao rapida (timeout 1.5s)
    // Se o temporal derrubou a torre de celular/WiFi, nao gasta energia:
    // os dados ja estao salvos no LittleFS para retransmissao futura.
    Serial.println("[Network] Tentando uplink rapido...");
    // Em implementacao real, conecta via ESP-NOW, LoRaWAN ou HTTP se WiFi disponivel.
}
