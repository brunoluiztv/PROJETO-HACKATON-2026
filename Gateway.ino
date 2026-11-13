#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_err.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

static const uint8_t PIN_SENSOR_UMIDADE = 34;
static const uint8_t PIN_SENSOR_2 = 32;
static const uint8_t CANAL_ESPNOW = 1;
static const uint32_t INTERVALO_ENVIO_MS = 1000;

static const uint8_t MAC_BROADCAST[6] = {
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF
};

// Este pacote precisa ser igual ao definido no sketch do gateway.
typedef struct {
  uint16_t sensorUmidadeGPIO34;
  uint16_t sensor2GPIO32;
} DadosSensores;

QueueHandle_t filaStatusEnvio = nullptr;

void pararComErro(const char *etapa, esp_err_t codigo) {
  Serial.printf("ERRO em %s: codigo %d\n", etapa, (int)codigo);
  while (true) {
    delay(1000);
  }
}

void aoEnviar(const esp_now_send_info_t *info, esp_now_send_status_t status) {
  (void)info;
  if (filaStatusEnvio != nullptr) {
    xQueueSend(filaStatusEnvio, &status, 0);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("Transmissor ESP-NOW de sensores");

  analogReadResolution(12);
  pinMode(PIN_SENSOR_UMIDADE, INPUT);
  pinMode(PIN_SENSOR_2, INPUT);

  filaStatusEnvio = xQueueCreate(5, sizeof(esp_now_send_status_t));
  if (filaStatusEnvio == nullptr) {
    Serial.println("ERRO: nao foi possivel criar a fila de status.");
    while (true) {
      delay(1000);
    }
  }

  if (!WiFi.mode(WIFI_STA)) {
    Serial.println("ERRO: nao foi possivel iniciar o Wi-Fi em modo STA.");
    while (true) {
      delay(1000);
    }
  }

  esp_err_t resultado = esp_wifi_set_channel(CANAL_ESPNOW, WIFI_SECOND_CHAN_NONE);
  if (resultado != ESP_OK) {
    pararComErro("configurar canal Wi-Fi 1", resultado);
  }

  resultado = esp_now_init();
  if (resultado != ESP_OK) {
    pararComErro("inicializar ESP-NOW", resultado);
  }

  resultado = esp_now_register_send_cb(aoEnviar);
  if (resultado != ESP_OK) {
    pararComErro("registrar callback de envio", resultado);
  }

  // O endereco broadcast precisa estar cadastrado como peer para o envio.
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, MAC_BROADCAST, sizeof(MAC_BROADCAST));
  peerInfo.channel = CANAL_ESPNOW;
  peerInfo.ifidx = WIFI_IF_STA;
  peerInfo.encrypt = false;

  resultado = esp_now_add_peer(&peerInfo);
  if (resultado != ESP_OK) {
    pararComErro("adicionar peer broadcast", resultado);
  }

  Serial.println("ESP-NOW pronto no canal Wi-Fi 1; destino broadcast.");
}

void loop() {
  esp_now_send_status_t statusEnvio;
  while (xQueueReceive(filaStatusEnvio, &statusEnvio, 0) == pdTRUE) {
    if (statusEnvio == ESP_NOW_SEND_SUCCESS) {
      Serial.println("Callback ESP-NOW: envio informado como sucesso.");
    } else {
      Serial.println("ERRO: callback ESP-NOW informou falha no envio.");
    }
  }

  DadosSensores dados;
  dados.sensorUmidadeGPIO34 = (uint16_t)analogRead(PIN_SENSOR_UMIDADE);
  dados.sensor2GPIO32 = (uint16_t)analogRead(PIN_SENSOR_2);

  Serial.printf(
    "Local | sensor de umidade GPIO34 (bruto): %u | sensor 2 GPIO32 (bruto): %u\n",
    (unsigned int)dados.sensorUmidadeGPIO34,
    (unsigned int)dados.sensor2GPIO32
  );

  esp_err_t resultado = esp_now_send(
    MAC_BROADCAST,
    (const uint8_t *)&dados,
    sizeof(dados)
  );

  if (resultado != ESP_OK) {
    Serial.printf("ERRO ao iniciar esp_now_send: codigo %d\n", (int)resultado);
  }

  delay(INTERVALO_ENVIO_MS);
}
