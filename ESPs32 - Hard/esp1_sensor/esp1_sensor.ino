#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#if __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#else
#define ESP_ARDUINO_VERSION_MAJOR 2
#endif
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#if __has_include("firmware_config.h")
#include "firmware_config.h"
#else
#error "Copie firmware_config.example.h para firmware_config.h e preencha a configuracao local."
#endif

// Protocolo binario compacto. Todos os inteiros sao serializados explicitamente
// em little-endian; o formato nao depende do padding de uma struct C++.
static const uint8_t kMagic = 0xA7;
static const uint8_t kWireVersion = 1;
static const uint8_t kReadingFrame = 1;
static const uint8_t kAckFrame = 2;
static const size_t kMaxFrame = 250;
static const size_t kMaxIdBytes = 40;
static const size_t kMaxCategoryBytes = 48;
static const uint8_t kKindNone = 0;
static const uint8_t kKindInteger = 1;
static const uint8_t kKindFloat = 2;
static const uint8_t kKindCategory = 3;
static const uint8_t kKindBoolean = 4;
static const uint8_t kQualityValid = 0;
static const uint8_t kQualitySensorError = 1;
static const uint8_t kSourceSimulation = 0;
static const uint8_t kSourcePhysical = 1;
static const uint8_t kMaxAttempts = 3;
static const uint32_t kAckTimeoutMs = 1200;

struct Writer {
  uint8_t bytes[kMaxFrame];
  size_t length = 0;

  bool putByte(uint8_t value) {
    if (length >= sizeof(bytes)) return false;
    bytes[length++] = value;
    return true;
  }
  bool putBytes(const uint8_t *value, size_t count) {
    if (length + count > sizeof(bytes)) return false;
    memcpy(bytes + length, value, count);
    length += count;
    return true;
  }
  bool putU16(uint16_t value) {
    return putByte((uint8_t)value) && putByte((uint8_t)(value >> 8));
  }
  bool putU32(uint32_t value) {
    for (uint8_t i = 0; i < 4; ++i) if (!putByte((uint8_t)(value >> (8 * i)))) return false;
    return true;
  }
  bool putU64(uint64_t value) {
    for (uint8_t i = 0; i < 8; ++i) if (!putByte((uint8_t)(value >> (8 * i)))) return false;
    return true;
  }
  bool putId(const char *value) {
    const size_t count = strlen(value);
    if (count == 0 || count > kMaxIdBytes || !putByte((uint8_t)count)) return false;
    for (size_t i = 0; i < count; ++i) {
      const char c = value[i];
      const bool safe = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.';
      if (!safe || !putByte((uint8_t)c)) return false;
    }
    return true;
  }
};

struct Reader {
  const uint8_t *bytes;
  size_t length;
  size_t offset = 0;

  bool getByte(uint8_t &value) {
    if (offset >= length) return false;
    value = bytes[offset++];
    return true;
  }
  bool getBytes(uint8_t *value, size_t count) {
    if (offset + count > length) return false;
    memcpy(value, bytes + offset, count);
    offset += count;
    return true;
  }
  bool getU32(uint32_t &value) {
    value = 0;
    for (uint8_t i = 0; i < 4; ++i) {
      uint8_t part;
      if (!getByte(part)) return false;
      value |= ((uint32_t)part << (8 * i));
    }
    return true;
  }
};

struct Sample {
  uint8_t kind = kKindNone;
  uint8_t quality = kQualitySensorError;
  int64_t integerValue = 0;
  double floatValue = 0.0;
  bool booleanValue = false;
  uint8_t categoryLength = 0;
  char category[kMaxCategoryBytes];
};

struct Ack {
  uint8_t bootId[16];
  uint32_t sequence;
  char channelId[kMaxIdBytes + 1];
};

struct Pending {
  bool active = false;
  uint8_t bytes[kMaxFrame];
  size_t length = 0;
  uint8_t bootId[16];
  uint32_t sequence = 0;
  uint8_t attempts = 0;
  bool waitingForAck = false;
  uint32_t lastSendMs = 0;
};

QueueHandle_t ackQueue = nullptr;
Pending pending;
uint8_t bootId[16];
uint32_t nextSequence = 0;
uint32_t droppedAckFrames = 0;
uint8_t gatewayMac[6];
bool radioReady = false;

static bool configuredId(const char *value) {
  return value != nullptr && value[0] != '\0' && strstr(value, "PREENCHER_") == nullptr;
}

static bool parseMac(const char *text, uint8_t mac[6]) {
  if (!text || strlen(text) != 17) return false;
  for (uint8_t i = 0; i < 6; ++i) {
    char pair[3] = {text[i * 3], text[i * 3 + 1], '\0'};
    char *end = nullptr;
    const long value = strtol(pair, &end, 16);
    if (!end || *end != '\0' || value < 0 || value > 255) return false;
    mac[i] = (uint8_t)value;
    if (i < 5 && text[i * 3 + 2] != ':') return false;
  }
  bool allZero = true;
  bool allFF = true;
  for (uint8_t i = 0; i < 6; ++i) {
    allZero = allZero && mac[i] == 0;
    allFF = allFF && mac[i] == 0xFF;
  }
  return !allZero && !allFF;
}

static void printHex(const uint8_t *bytes, size_t count) {
  for (size_t i = 0; i < count; ++i) {
    if (bytes[i] < 16) Serial.print('0');
    Serial.print(bytes[i], HEX);
  }
}

static void makeBootId() {
  // O ID aleatorio separa as sequencias de inicializacoes diferentes.
  for (uint8_t i = 0; i < 4; ++i) {
    const uint32_t randomPart = esp_random();
    memcpy(bootId + (i * 4), &randomPart, sizeof(randomPart));
  }
}

static Sample acquireSensor() {
  Sample sample;
#if NODE_USE_MOCK
  // MOCK EXPLICITO: inteiro bruto ficticio, sem unidade e sem relacao com um sensor.
  sample.kind = kKindInteger;
  sample.quality = kQualityValid;
  sample.integerValue = NODE_MOCK_RAW_VALUE;
#else
  // Nenhum modelo/pino foi definido. Ao ligar um sensor, substitua este bloco
  // por sua leitura direta, preservando o tipo e o valor devolvidos pelo sensor.
  sample.kind = kKindNone;
  sample.quality = kQualitySensorError;
#endif
  return sample;
}

static bool encodeReading(const Sample &sample, uint32_t sequence, Writer &writer) {
  if (sample.quality == kQualityValid && sample.kind == kKindNone) return false;
  if (sample.kind == kKindCategory && sample.categoryLength > kMaxCategoryBytes) return false;
  writer.putByte(kMagic);
  writer.putByte(kWireVersion);
  writer.putByte(kReadingFrame);
  if (!writer.putId(NODE_ID)) return false;
  if (!writer.putBytes(bootId, sizeof(bootId))) return false;
  if (!writer.putU32(sequence)) return false;
  if (!writer.putId(NODE_SENSOR_ID) || !writer.putId(NODE_CHANNEL_ID) || !writer.putId(NODE_PROFILE_ID)) return false;
  if (!writer.putU16((uint16_t)NODE_PROFILE_VERSION)) return false;
  if (!writer.putByte(NODE_USE_MOCK ? kSourceSimulation : kSourcePhysical)) return false;
  if (!writer.putByte(sample.quality) || !writer.putByte(sample.kind)) return false;
  if (!writer.putU32(millis())) return false;
  if (sample.quality != kQualityValid) return true;

  if (sample.kind == kKindInteger) {
    uint64_t bits;
    memcpy(&bits, &sample.integerValue, sizeof(bits));
    return writer.putU64(bits);
  }
  if (sample.kind == kKindFloat) {
    if (!isfinite(sample.floatValue)) return false;
    uint64_t bits;
    memcpy(&bits, &sample.floatValue, sizeof(bits));
    return writer.putU64(bits);
  }
  if (sample.kind == kKindBoolean) return writer.putByte(sample.booleanValue ? 1 : 0);
  if (sample.kind == kKindCategory) {
    if (!writer.putByte(sample.categoryLength)) return false;
    return writer.putBytes((const uint8_t *)sample.category, sample.categoryLength);
  }
  return false;
}

static bool decodeAck(const uint8_t *data, size_t length, Ack &ack) {
  Reader reader;
  reader.bytes = data;
  reader.length = length;
  reader.offset = 0;
  uint8_t magic, version, type, channelLength;
  if (!reader.getByte(magic) || !reader.getByte(version) || !reader.getByte(type) ||
      magic != kMagic || version != kWireVersion || type != kAckFrame) return false;
  if (!reader.getBytes(ack.bootId, sizeof(ack.bootId)) || !reader.getU32(ack.sequence) ||
      !reader.getByte(channelLength) || channelLength == 0 || channelLength > kMaxIdBytes ||
      !reader.getBytes((uint8_t *)ack.channelId, channelLength)) return false;
  ack.channelId[channelLength] = '\0';
  return reader.offset == reader.length;
}

static void onReceive(const uint8_t *data, int length) {
  if (!data || length <= 0 || (size_t)length > kMaxFrame || !ackQueue) return;
  Ack ack{};
  if (!decodeAck(data, (size_t)length, ack)) return;
  if (xQueueSend(ackQueue, &ack, 0) != pdTRUE) ++droppedAckFrames;
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
static void onEspNowReceive(const esp_now_recv_info_t *info, const uint8_t *data, int length) {
  (void)info;
  onReceive(data, length);
}
#else
static void onEspNowReceive(const uint8_t *mac, const uint8_t *data, int length) {
  (void)mac;
  onReceive(data, length);
}
#endif

static bool startRadio() {
  if (NODE_RADIO_CHANNEL < 1 || NODE_RADIO_CHANNEL > 14) {
    Serial.println(F("Configure NODE_RADIO_CHANNEL com o canal exibido pelo gateway."));
    return false;
  }
  WiFi.mode(WIFI_STA);
  const esp_err_t channelResult = esp_wifi_set_channel((uint8_t)NODE_RADIO_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (channelResult != ESP_OK) {
    Serial.printf("Falha ao selecionar canal do radio: %d\n", (int)channelResult);
    return false;
  }
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("Falha ao iniciar ESP-NOW."));
    return false;
  }
  if (esp_now_register_recv_cb(onEspNowReceive) != ESP_OK) {
    Serial.println(F("Falha ao registrar callback de ACK."));
    esp_now_deinit();
    return false;
  }
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, gatewayMac, sizeof(gatewayMac));
  peer.channel = NODE_RADIO_CHANNEL;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  if (!esp_now_is_peer_exist(gatewayMac) && esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println(F("Falha ao cadastrar MAC do gateway como peer."));
    esp_now_deinit();
    return false;
  }
  radioReady = true;
  Serial.printf("ESP-NOW pronto no canal %u.\n", (unsigned)NODE_RADIO_CHANNEL);
  return true;
}

static void createPendingReading() {
  Sample sample = acquireSensor();
  Writer writer;
  const uint32_t sequence = ++nextSequence;
  if (!encodeReading(sample, sequence, writer)) {
    Serial.println(F("Amostra nao coube no pacote ou valor numerico nao e finito."));
    return;
  }
  pending.active = true;
  memcpy(pending.bytes, writer.bytes, writer.length);
  pending.length = writer.length;
  memcpy(pending.bootId, bootId, sizeof(bootId));
  pending.sequence = sequence;
  pending.attempts = 0;
  pending.waitingForAck = false;
  pending.lastSendMs = 0;
  Serial.printf("Amostra pronta. sequencia=%lu, origem=%s\n",
                (unsigned long)sequence, NODE_USE_MOCK ? "simulation (mock)" : "physical_sensor");
}

static void sendPending() {
  if (!pending.active || !radioReady || pending.attempts >= kMaxAttempts) return;
  ++pending.attempts;
  pending.waitingForAck = true;
  pending.lastSendMs = millis();
  const esp_err_t result = esp_now_send(gatewayMac, pending.bytes, pending.length);
  Serial.printf("Tentativa %u/%u, sequencia=%lu, retorno=%d\n",
                (unsigned)pending.attempts, (unsigned)kMaxAttempts,
                (unsigned long)pending.sequence, (int)result);
}

static void handleAcks() {
  Ack ack{};
  while (ackQueue && xQueueReceive(ackQueue, &ack, 0) == pdTRUE) {
    if (!pending.active || ack.sequence != pending.sequence ||
        memcmp(ack.bootId, pending.bootId, sizeof(pending.bootId)) != 0 ||
        strcmp(ack.channelId, NODE_CHANNEL_ID) != 0) continue;
    pending.active = false;
    pending.waitingForAck = false;
    Serial.printf("ACK do gateway: registro persistido (sequencia %lu).\n",
                  (unsigned long)ack.sequence);
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println(F("No ESP32 AgroSponge RS — aquisicao manual por Serial."));
  Serial.println(F("Digite r e Enter para gerar/enviar uma amostra."));

  if (!configuredId(NODE_ID) || !configuredId(NODE_SENSOR_ID) ||
      !configuredId(NODE_CHANNEL_ID) || !configuredId(NODE_PROFILE_ID) ||
      NODE_PROFILE_VERSION < 1 || NODE_PROFILE_VERSION > 65535) {
    Serial.println(F("Preencha os identificadores e a versao do perfil em firmware_config.h."));
    return;
  }
  if (!parseMac(NODE_GATEWAY_MAC, gatewayMac)) {
    Serial.println(F("Preencha NODE_GATEWAY_MAC com o MAC mostrado no Serial do gateway."));
    return;
  }
  WiFi.mode(WIFI_STA);
  delay(50);
  makeBootId();
  Serial.print(F("node_boot_id desta inicializacao: "));
  printHex(bootId, sizeof(bootId));
  Serial.println();

  ackQueue = xQueueCreate(8, sizeof(Ack));
  if (!ackQueue) {
    Serial.println(F("Sem memoria para a fila de ACK."));
    return;
  }
  startRadio();
}

void loop() {
  handleAcks();
  if (droppedAckFrames) {
    Serial.printf("ACKs descartados por fila cheia: %lu\n", (unsigned long)droppedAckFrames);
    droppedAckFrames = 0;
  }

  if (Serial.available()) {
    const char command = (char)Serial.read();
    if (command == 'r' || command == 'R') {
      if (!radioReady) {
        Serial.println(F("Radio ainda nao esta pronto; confira MAC e canal."));
      } else if (!pending.active) {
        createPendingReading();
        sendPending();
      } else if (!pending.waitingForAck && pending.attempts >= kMaxAttempts) {
        Serial.println(F("Reenviando a mesma leitura e a mesma identidade."));
        pending.attempts = 0;
        sendPending();
      } else {
        Serial.println(F("Ha uma leitura aguardando ACK; nenhuma nova leitura foi criada."));
      }
    }
  }

  if (pending.active && pending.waitingForAck &&
      (uint32_t)(millis() - pending.lastSendMs) >= kAckTimeoutMs) {
    pending.waitingForAck = false;
    if (pending.attempts < kMaxAttempts) {
      sendPending();
    } else {
      Serial.println(F("Limite de tentativas atingido; leitura mantida em RAM. Digite r para tentar de novo."));
    }
  }
  vTaskDelay(pdMS_TO_TICKS(5));
}
