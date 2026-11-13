/**
 * ============================================================================
 * Tekó Biotech — Firmware ESP32 Gateway da Ninhura (Mesh ESP-NOW -> HTTP POST)
 * Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural
 * ============================================================================
 * 
 * ARQUITETURA GERAL DA NINHURA:
 * 
 *   [Nó Sentinela 1 (ESP32)] ---\
 *   [Nó Sentinela 2 (ESP32)] ----+--> (ESP-NOW 2.4GHz) --> [ESP32 Gateway]
 *   [Nó Sentinela 3 (ESP32)] ---/                                  |
 *                                                    (Wi-Fi / 4G + HTTP POST)
 *                                                                  v
 *                                                         [Backend FastAPI]
 *                                                                  |
 *                                                    +-------------+-------------+
 *                                                    |                           |
 *                                             [Dashboard Web]             [Telegram Bot]
 * 
 * DECISÃO DE ENGENHARIA CRÍTICA:
 * Por que os Nós ESP32 NÃO se comunicam diretamente com o Telegram?
 * 1. Economia de Bateria dos Nós de Campo: Conexões TLS/HTTPS com a API do Telegram
 *    exigem handshake criptográfico pesado e mantêm o rádio ligado por 3 a 5 segundos.
 *    Com ESP-NOW, o pacote é transmitido em apenas 4 milissegundos e o nó volta
 *    imediatamente para Deep Sleep (10 µA), permitindo anos de autonomia ou alimentação
 *    por Célula de Combustível Microbiana P-MFC.
 * 2. Ponto Único de Conexão à Internet: Em propriedades rurais do RS, o sinal de celular/Wi-Fi
 *    só costuma alcançar a sede da fazenda ou galpão. O Gateway fica na sede com internet,
 *    enquanto os nós comunicam a centenas de metros via rádio ESP-NOW de alta penetração.
 * 3. Desacoplamento e Segurança: As regras de negócio agronômicas da Embrapa e o token
 *    secreto do Bot do Telegram residem exclusivamente no servidor FastAPI.
 * ============================================================================
 */

#include <WiFi.h>
#include <esp_now.h>
#include <HTTPClient.h>

// ============================================================================
// CONFIGURAÇÕES DE REDE WI-FI DO GATEWAY (DUPLO FALLBACK)
// ============================================================================
const char* WIFI_SSID_1 = "PhytoSense_Hotspot";  // Roteador 4G do Celular (Apresentação)
const char* WIFI_PASS_1 = "rural123456";

const char* WIFI_SSID_2 = "UERGS_HACKATON";      // Wi-Fi Local do Evento / Bancada
const char* WIFI_PASS_2 = "hackathon2026";

// URL do Backend FastAPI para Ingestão do Gateway
// (Altere para o IP local do seu computador onde roda o backend FastAPI)
const char* BACKEND_GATEWAY_URL = "http://192.168.1.150:8000/api/telemetria/gateway";

// Identificador do Gateway
const char* GATEWAY_ID = "esp32_gateway";

#define PIN_LED_GATEWAY 2   // LED onboard indicador de atividade

// Estrutura de dados transmitida pelos Nós de Campo via ESP-NOW
typedef struct struct_mensagem_ninhura {
    char no_id[16];        // ex: "esp32_no_01", "esp32_no_02", "esp32_no_03"
    char id_perfil[32];   // ex: "olericultura_alface_argissolo"
    int leitura_adc;      // 0 a 4095
    float tensao_kpa;     // Tensão matricial calculada (ou 0 se o nó delegar ao servidor)
    float temp_c;         // Temperatura em °C
    int bateria_mv;       // Tensão da bateria em mV (ex: 3300)
} struct_mensagem_ninhura;

struct_mensagem_ninhura dadosRecebidos;
volatile bool novoPacoteRecebido = false;
int contadorPacotesRoteados = 0;

// ============================================================================
// CALLBACK DO ESP-NOW AO RECEBER PACOTE DE UM NÓ SENTINELA
// ============================================================================
void OnDataRecv(const uint8_t * mac_addr, const uint8_t *incomingData, int len) {
    if (len == sizeof(struct_mensagem_ninhura)) {
        memcpy(&dadosRecebidos, incomingData, sizeof(struct_mensagem_ninhura));
        novoPacoteRecebido = true;
        
        char macStr[18];
        snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
                 mac_addr[0], mac_addr[1], mac_addr[2], mac_addr[3], mac_addr[4], mac_addr[5]);
        
        Serial.printf("\n[ESP-NOW] Pacote recebido de %s | Nó: %s | ADC: %d\n",
                      macStr, dadosRecebidos.no_id, dadosRecebidos.leitura_adc);
    } else {
        Serial.printf("[ESP-NOW] Tamanho de pacote incompativel: %d bytes\n", len);
    }
}

// ============================================================================
// CONEXÃO COM A REDE WI-FI
// ============================================================================
void conectarWiFi() {
    Serial.println("\n[Wi-Fi] Conectando Gateway a Internet...");
    WiFi.mode(WIFI_AP_STA); // AP_STA permite que o ESP-NOW funcione junto com o Wi-Fi

    WiFi.begin(WIFI_SSID_1, WIFI_PASS_1);
    int tentativas = 0;
    while (WiFi.status() != WL_CONNECTED && tentativas < 12) {
        delay(500);
        Serial.print(".");
        tentativas++;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.printf("\n[Wi-Fi] Falha na Rede 1. Tentando Rede 2 (%s)...\n", WIFI_SSID_2);
        WiFi.begin(WIFI_SSID_2, WIFI_PASS_2);
        tentativas = 0;
        while (WiFi.status() != WL_CONNECTED && tentativas < 12) {
            delay(500);
            Serial.print(".");
            tentativas++;
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[Wi-Fi] Conectado com sucesso! IP do Gateway: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[Wi-Fi] ALERTA: Modo offline. O Gateway armazenara leituras no buffer.");
    }
}

// ============================================================================
// ENCAMINHAMENTO HTTP POST PARA O BACKEND FASTAPI
// ============================================================================
bool encaminharParaBackend(const struct_mensagem_ninhura &dados) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[HTTP] Sem conexao Wi-Fi para encaminhamento.");
        return false;
    }

    HTTPClient http;
    http.begin(BACKEND_GATEWAY_URL);
    http.addHeader("Content-Type", "application/json");

    // Monta o payload JSON estruturado
    String jsonPayload = "{";
    jsonPayload += "\"gateway_id\":\"" + String(GATEWAY_ID) + "\",";
    jsonPayload += "\"no_id\":\"" + String(dados.no_id) + "\",";
    jsonPayload += "\"id_perfil\":\"" + String(dados.id_perfil) + "\",";
    jsonPayload += "\"leitura_adc\":" + String(dados.leitura_adc) + ",";
    jsonPayload += "\"temp_c\":" + String(dados.temp_c, 1) + ",";
    jsonPayload += "\"bateria_mv\":" + String(dados.bateria_mv) + ",";
    jsonPayload += "\"rssi_espnow\":" + String(WiFi.RSSI());
    jsonPayload += "}";

    digitalWrite(PIN_LED_GATEWAY, HIGH);
    int httpResponseCode = http.POST(jsonPayload);
    digitalWrite(PIN_LED_GATEWAY, LOW);

    if (httpResponseCode == 201 || httpResponseCode == 200) {
        contadorPacotesRoteados++;
        Serial.printf("[HTTP] Sucesso (%d)! Pacote #%d encaminhado ao FastAPI.\n",
                      httpResponseCode, contadorPacotesRoteados);
        http.end();
        return true;
    } else {
        Serial.printf("[HTTP] Erro %d no encaminhamento ao servidor.\n", httpResponseCode);
        http.end();
        return false;
    }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    pinMode(PIN_LED_GATEWAY, OUTPUT);
    digitalWrite(PIN_LED_GATEWAY, LOW);

    Serial.println("==================================================");
    Serial.println("   Tekó Biotech — ESP32 Gateway da Ninhura");
    Serial.println("   Hackathon das Engenharias UERGS 2026");
    Serial.println("==================================================");

    // Inicializa Wi-Fi
    conectarWiFi();

    // Inicializa protocolo ESP-NOW
    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW] ERRO CRITICO ao inicializar ESP-NOW!");
        return;
    }

    esp_now_register_recv_cb(OnDataRecv);
    Serial.println("[ESP-NOW] Gateway pronto para escutar Nós Sentinelas.");
}

// ============================================================================
// LOOP PRINCIPAL
// ============================================================================
void loop() {
    // Reconecta Wi-Fi silenciosamente se cair
    if (WiFi.status() != WL_CONNECTED) {
        static unsigned long ultimoReconectar = 0;
        if (millis() - ultimoReconectar > 15000) {
            ultimoReconectar = millis();
            conectarWiFi();
        }
    }

    // Processa pacotes da fila ESP-NOW
    if (novoPacoteRecebido) {
        novoPacoteRecebido = false;
        encaminharParaBackend(dadosRecebidos);
    }

    delay(20);
}
