#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <LittleFS.h>
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
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#if __has_include("firmware_config.h")
#include "firmware_config.h"
#else
#error "Copie firmware_config.example.h para firmware_config.h e preencha a configuracao local."
#endif

// Formato compacto e versionado; cada campo e serializado explicitamente.
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
static const size_t kMaxStoredRecords = 128;
static const UBaseType_t kRxQueueLength = 16;

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
  bool getU16(uint16_t &value) {
    uint8_t low, high;
    if (!getByte(low) || !getByte(high)) return false;
    value = (uint16_t)low | ((uint16_t)high << 8);
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
  bool getU64(uint64_t &value) {
    value = 0;
    for (uint8_t i = 0; i < 8; ++i) {
      uint8_t part;
      if (!getByte(part)) return false;
      value |= ((uint64_t)part << (8 * i));
    }
    return true;
  }
  bool getId(char output[kMaxIdBytes + 1]) {
    uint8_t count;
    if (!getByte(count) || count == 0 || count > kMaxIdBytes || offset + count > length) return false;
    for (uint8_t i = 0; i < count; ++i) {
      const char c = (char)bytes[offset++];
      const bool safe = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.';
      if (!safe) return false;
      output[i] = c;
    }
    output[count] = '\0';
    return true;
  }
};

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
  bool putU32(uint32_t value) {
    for (uint8_t i = 0; i < 4; ++i) if (!putByte((uint8_t)(value >> (8 * i)))) return false;
    return true;
  }
};

struct Reading {
  char nodeId[kMaxIdBytes + 1];
  uint8_t bootId[16];
  char bootIdHex[33];
  uint32_t sequence;
  char sensorId[kMaxIdBytes + 1];
  char channelId[kMaxIdBytes + 1];
  char profileId[kMaxIdBytes + 1];
  uint16_t profileVersion;
  uint8_t source;
  uint8_t quality;
  uint8_t kind;
  uint32_t nodeUptimeMs;
  int64_t integerValue;
  double floatValue;
  bool booleanValue;
  uint8_t categoryLength;
  char category[kMaxCategoryBytes];
};

struct RadioFrame {
  uint8_t mac[6];
  uint16_t length;
  uint8_t bytes[kMaxFrame];
};

QueueHandle_t radioQueue = nullptr;
bool storageReady = false;
bool radioReady = false;
uint8_t radioChannel = 0;
volatile uint32_t droppedRadioFrames = 0;
uint32_t nextWifiReconnectMs = 0;
uint32_t nextPostAttemptMs = 0;
uint32_t retryDelayMs = 1000;

static bool isConfigured(const char *value) {
  return value && value[0] != '\0' && strstr(value, "PREENCHER_") == nullptr;
}

static bool validId(const char *value) {
  if (!isConfigured(value)) return false;
  const size_t count = strlen(value);
  if (count == 0 || count > kMaxIdBytes) return false;
  for (size_t i = 0; i < count; ++i) {
    const char c = value[i];
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.')) return false;
  }
  return true;
}

static void hexId(const uint8_t id[16], char output[33]) {
  static const char digits[] = "0123456789abcdef";
  for (uint8_t i = 0; i < 16; ++i) {
    output[i * 2] = digits[id[i] >> 4];
    output[i * 2 + 1] = digits[id[i] & 0x0F];
  }
  output[32] = '\0';
}

static void appendJsonEscaped(String &output, const char *value, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    const uint8_t c = (uint8_t)value[i];
    if (c == '"' || c == '\\') {
      output += '\\';
      output += (char)c;
    } else if (c == '\b') output += F("\\b");
    else if (c == '\f') output += F("\\f");
    else if (c == '\n') output += F("\\n");
    else if (c == '\r') output += F("\\r");
    else if (c == '\t') output += F("\\t");
    else if (c < 0x20) {
      char encoded[7];
      snprintf(encoded, sizeof(encoded), "\\u%04x", c);
      output += encoded;
    } else output += (char)c;
  }
}

static bool decodeReading(const uint8_t *data, size_t length, Reading &reading) {
  Reader reader;
  reader.bytes = data;
  reader.length = length;
  reader.offset = 0;
  uint8_t magic, version, type;
  if (!reader.getByte(magic) || !reader.getByte(version) || !reader.getByte(type) ||
      magic != kMagic || version != kWireVersion || type != kReadingFrame) return false;
  if (!reader.getId(reading.nodeId) || !reader.getBytes(reading.bootId, sizeof(reading.bootId)) ||
      !reader.getU32(reading.sequence) || !reader.getId(reading.sensorId) ||
      !reader.getId(reading.channelId) || !reader.getId(reading.profileId) ||
      !reader.getU16(reading.profileVersion) || !reader.getByte(reading.source) ||
      !reader.getByte(reading.quality) || !reader.getByte(reading.kind) ||
      !reader.getU32(reading.nodeUptimeMs)) return false;
  if (reading.source > kSourcePhysical || reading.quality > kQualitySensorError ||
      reading.profileVersion == 0) return false;
  hexId(reading.bootId, reading.bootIdHex);

  if (reading.quality == kQualitySensorError) {
    if (reading.kind != kKindNone || reader.offset != reader.length) return false;
    return true;
  }
  if (reading.kind == kKindInteger) {
    uint64_t bits;
    if (!reader.getU64(bits)) return false;
    memcpy(&reading.integerValue, &bits, sizeof(bits));
  } else if (reading.kind == kKindFloat) {
    uint64_t bits;
    if (!reader.getU64(bits)) return false;
    memcpy(&reading.floatValue, &bits, sizeof(bits));
    if (!isfinite(reading.floatValue)) return false;
  } else if (reading.kind == kKindBoolean) {
    uint8_t value;
    if (!reader.getByte(value) || value > 1) return false;
    reading.booleanValue = value == 1;
  } else if (reading.kind == kKindCategory) {
    if (!reader.getByte(reading.categoryLength) || reading.categoryLength > kMaxCategoryBytes ||
        !reader.getBytes((uint8_t *)reading.category, reading.categoryLength)) return false;
  } else return false;
  return reader.offset == reader.length;
}

static String readingJson(const Reading &reading) {
  String json;
  json.reserve(420);
  json += F("{\"node_id\":\""); json += reading.nodeId;
  json += F("\",\"node_boot_id\":\""); json += reading.bootIdHex;
  json += F("\",\"sequence\":"); json += String((unsigned long)reading.sequence);
  json += F(",\"sensor_id\":\""); json += reading.sensorId;
  json += F("\",\"channel_id\":\""); json += reading.channelId;
  json += F("\",\"profile_id\":\""); json += reading.profileId;
  json += F("\",\"profile_version\":"); json += String((unsigned)reading.profileVersion);
  json += F(",\"result\":");
  if (reading.quality != kQualityValid) {
    json += F("null");
  } else {
    json += F("{\"kind\":");
    if (reading.kind == kKindInteger || reading.kind == kKindFloat) json += F("\"numeric\",\"value\":");
    else if (reading.kind == kKindCategory) json += F("\"categorical\",\"value\":");
    else json += F("\"boolean\",\"value\":");

    if (reading.kind == kKindInteger) {
      char number[32];
      snprintf(number, sizeof(number), "%lld", (long long)reading.integerValue);
      json += number;
    } else if (reading.kind == kKindFloat) {
      char number[32];
      snprintf(number, sizeof(number), "%.17g", reading.floatValue);
      json += number;
    } else if (reading.kind == kKindBoolean) {
      json += reading.booleanValue ? F("true") : F("false");
    } else {
      json += '"';
      appendJsonEscaped(json, reading.category, reading.categoryLength);
      json += '"';
    }
    json += '}';
  }
  json += F(",\"quality\":\"");
  json += reading.quality == kQualityValid ? F("valid") : F("sensor_error");
  json += F("\",\"source\":\"");
  json += reading.source == kSourceSimulation ? F("simulation") : F("physical_sensor");
  json += F("\",\"measured_at\":null,\"time_quality\":\"unknown\",\"node_uptime_ms\":");
  json += String((unsigned long)reading.nodeUptimeMs);
  json += '}';
  return json;
}

static String queuePath(const Reading &reading) {
  char path[160];
  snprintf(path, sizeof(path), "/q_%s_%s_%010lu_%s.json",
           reading.nodeId, reading.bootIdHex, (unsigned long)reading.sequence, reading.channelId);
  return String(path);
}

static size_t pendingCount() {
  if (!storageReady) return 0;
  size_t count = 0;
  File root = LittleFS.open("/");
  if (!root) return 0;
  File entry = root.openNextFile();
  while (entry) {
    String name = entry.name();
    if (name.startsWith("q_")) name = "/" + name;
    if (!entry.isDirectory() && name.startsWith("/q_") && name.endsWith(".json")) ++count;
    entry.close();
    entry = root.openNextFile();
  }
  root.close();
  return count;
}

static size_t storedRecordCount() {
  if (!storageReady) return 0;
  size_t count = 0;
  File root = LittleFS.open("/");
  if (!root) return 0;
  File entry = root.openNextFile();
  while (entry) {
    String name = entry.name();
    if (name.startsWith("q_")) name = "/" + name;
    if (!entry.isDirectory() && name.startsWith("/q_") &&
        (name.endsWith(".json") || name.endsWith(".blocked") || name.endsWith(".tmp"))) ++count;
    entry.close();
    entry = root.openNextFile();
  }
  root.close();
  return count;
}

static String readStoredRecord(const String &path) {
  File file = LittleFS.open(path, "r");
  if (!file) return String();
  String content = file.readStringUntil('\n');
  file.close();
  if (content.endsWith("\r")) content.remove(content.length() - 1);
  return content;
}

static bool persistBeforeAck(const Reading &reading, String &path) {
  path = queuePath(reading);
  const String record = readingJson(reading);
  if (LittleFS.exists(path)) {
    const String prior = readStoredRecord(path);
    if (prior == record) return true; // Duplicata idempotente ainda pendente.
    Serial.println(F("Conflito local: mesma identidade, conteudo diferente; ACK nao enviado."));
    return false;
  }
  const String temporaryPath = path + ".tmp";
  if (LittleFS.exists(temporaryPath)) LittleFS.remove(temporaryPath);
  if (storedRecordCount() >= kMaxStoredRecords) {
    Serial.println(F("Limite local de registros atingido: leitura nao confirmada ao no."));
    return false;
  }
  // Grave primeiro em arquivo temporario. Se houver queda durante a escrita,
  // nenhum registro parcial aparece como pendencia nem recebe ACK.
  File file = LittleFS.open(temporaryPath, "w");
  if (!file) {
    Serial.println(F("Falha ao abrir arquivo da fila; ACK nao enviado."));
    return false;
  }
  const size_t bodyWritten = file.print(record);
  const size_t newlineWritten = file.print('\n');
  file.flush();
  file.close();
  if (bodyWritten != record.length() || newlineWritten != 1) {
    LittleFS.remove(temporaryPath);
    Serial.println(F("Falha ao gravar registro; ACK nao enviado."));
    return false;
  }
  if (!LittleFS.rename(temporaryPath, path)) {
    LittleFS.remove(temporaryPath);
    Serial.println(F("Falha ao finalizar arquivo da fila; ACK nao enviado."));
    return false;
  }
  return true;
}

static bool ensurePeer(const uint8_t mac[6]) {
  if (esp_now_is_peer_exist(mac)) return true;
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = radioChannel;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  return esp_now_add_peer(&peer) == ESP_OK;
}

static void sendAck(const uint8_t mac[6], const Reading &reading) {
  if (!radioReady || !ensurePeer(mac)) {
    Serial.println(F("Registro gravado, mas nao foi possivel cadastrar o peer para o ACK."));
    return;
  }
  Writer ack;
  ack.putByte(kMagic);
  ack.putByte(kWireVersion);
  ack.putByte(kAckFrame);
  ack.putBytes(reading.bootId, sizeof(reading.bootId));
  ack.putU32(reading.sequence);
  ack.putId(reading.channelId);
  const esp_err_t result = esp_now_send(mac, ack.bytes, ack.length);
  Serial.printf("ACK enviado apos persistencia: %s seq=%lu, retorno=%d\n",
                reading.nodeId, (unsigned long)reading.sequence, (int)result);
}

static void processRadioQueue() {
  if (!radioQueue || !storageReady) return;
  RadioFrame frame{};
  while (xQueueReceive(radioQueue, &frame, 0) == pdTRUE) {
    Reading reading{};
    if (!decodeReading(frame.bytes, frame.length, reading)) {
      Serial.println(F("Pacote ESP-NOW invalido ou versao desconhecida; descartado."));
      continue;
    }
    String path;
    if (!persistBeforeAck(reading, path)) continue;
    Serial.printf("Persistido em LittleFS: %s seq=%lu, fila=%u\n",
                  reading.nodeId, (unsigned long)reading.sequence, (unsigned)pendingCount());
    sendAck(frame.mac, reading);
  }
}

static void receiveBytes(const uint8_t mac[6], const uint8_t *data, int length) {
  if (!mac || !data || length <= 0 || (size_t)length > kMaxFrame || !radioQueue) return;
  RadioFrame frame{};
  memcpy(frame.mac, mac, sizeof(frame.mac));
  frame.length = (uint16_t)length;
  memcpy(frame.bytes, data, (size_t)length);
  if (xQueueSend(radioQueue, &frame, 0) != pdTRUE) ++droppedRadioFrames;
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
static void onEspNowReceive(const esp_now_recv_info_t *info, const uint8_t *data, int length) {
  if (!info) return;
  receiveBytes(info->src_addr, data, length);
}
#else
static void onEspNowReceive(const uint8_t *mac, const uint8_t *data, int length) {
  receiveBytes(mac, data, length);
}
#endif

static bool startRadio(uint8_t channel) {
  if (channel < 1 || channel > 14) return false;
  if (radioReady) {
    esp_now_deinit();
    radioReady = false;
  }
  if (WiFi.status() != WL_CONNECTED) {
    const esp_err_t setResult = esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
    if (setResult != ESP_OK) {
      Serial.printf("Falha ao selecionar canal %u: %d\n", channel, (int)setResult);
      return false;
    }
  }
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("Falha ao iniciar ESP-NOW."));
    return false;
  }
  if (esp_now_register_recv_cb(onEspNowReceive) != ESP_OK) {
    Serial.println(F("Falha ao registrar recepcao ESP-NOW."));
    esp_now_deinit();
    return false;
  }
  radioChannel = channel;
  radioReady = true;
  Serial.printf("ESP-NOW pronto no canal %u. Configure os nos no mesmo canal.\n", (unsigned)radioChannel);
  return true;
}

static void keepRadioOnCurrentChannel() {
  uint8_t desired = 0;
  if (WiFi.status() == WL_CONNECTED) {
    desired = (uint8_t)WiFi.channel();
    if (GATEWAY_RADIO_CHANNEL >= 1 && GATEWAY_RADIO_CHANNEL <= 14 &&
        GATEWAY_RADIO_CHANNEL != desired) {
      Serial.printf("Canal configurado %u difere do canal do Wi-Fi %u; gateway acompanha o Wi-Fi.\n",
                    (unsigned)GATEWAY_RADIO_CHANNEL, (unsigned)desired);
    }
  } else if (GATEWAY_RADIO_CHANNEL >= 1 && GATEWAY_RADIO_CHANNEL <= 14) {
    desired = GATEWAY_RADIO_CHANNEL;
  }
  if (desired && (!radioReady || desired != radioChannel)) startRadio(desired);
}

static String nextPendingPath() {
  String selected;
  File root = LittleFS.open("/");
  if (!root) return selected;
  File entry = root.openNextFile();
  while (entry) {
    String name = entry.name();
    if (name.startsWith("q_")) name = "/" + name;
    if (!entry.isDirectory() && name.startsWith("/q_") && name.endsWith(".json") &&
        (selected.length() == 0 || name < selected)) selected = name;
    entry.close();
    entry = root.openNextFile();
  }
  root.close();
  return selected;
}

static String jsonStringProperty(const String &json, const char *key) {
  String quotedKey = String("\"") + key + "\"";
  int position = json.indexOf(quotedKey);
  if (position < 0) return String();
  position = json.indexOf(':', position + quotedKey.length());
  if (position < 0) return String();
  ++position;
  while (position < (int)json.length() && isspace((unsigned char)json[position])) ++position;
  if (position >= (int)json.length() || json[position] != '"') return String();
  ++position;
  String value;
  bool escaped = false;
  for (; position < (int)json.length(); ++position) {
    const char c = json[position];
    if (escaped) {
      if (c == 'n') value += '\n';
      else if (c == 'r') value += '\r';
      else if (c == 't') value += '\t';
      else value += c;
      escaped = false;
    } else if (c == '\\') escaped = true;
    else if (c == '"') return value;
    else value += c;
  }
  return String();
}

static String jsonNumberProperty(const String &json, const char *key) {
  String quotedKey = String("\"") + key + "\"";
  int position = json.indexOf(quotedKey);
  if (position < 0) return String();
  position = json.indexOf(':', position + quotedKey.length());
  if (position < 0) return String();
  ++position;
  while (position < (int)json.length() && isspace((unsigned char)json[position])) ++position;
  const int start = position;
  while (position < (int)json.length() && json[position] >= '0' && json[position] <= '9') ++position;
  return position == start ? String() : json.substring(start, position);
}

static bool responseMatches(const String &response, const Reading &reading, String &status) {
  if (jsonStringProperty(response, "node_id") != reading.nodeId ||
      jsonStringProperty(response, "node_boot_id") != reading.bootIdHex ||
      jsonStringProperty(response, "channel_id") != reading.channelId ||
      jsonNumberProperty(response, "sequence") != String((unsigned long)reading.sequence)) return false;
  status = jsonStringProperty(response, "status");
  return status.length() != 0;
}

static bool responseEnvelopeMatches(const String &response) {
  return jsonNumberProperty(response, "schema_version") == "1" &&
         jsonStringProperty(response, "gateway_id") == GATEWAY_ID;
}

static bool identityFromStoredRecord(const String &record, Reading &identity) {
  const String sequence = jsonNumberProperty(record, "sequence");
  if (sequence.length() == 0) return false;
  jsonStringProperty(record, "node_id").toCharArray(identity.nodeId, sizeof(identity.nodeId));
  jsonStringProperty(record, "node_boot_id").toCharArray(identity.bootIdHex, sizeof(identity.bootIdHex));
  jsonStringProperty(record, "channel_id").toCharArray(identity.channelId, sizeof(identity.channelId));
  identity.sequence = (uint32_t)strtoul(sequence.c_str(), nullptr, 10);
  return identity.nodeId[0] != '\0' && identity.bootIdHex[0] != '\0' && identity.channelId[0] != '\0';
}

static bool blockRecordForDiagnosis(const String &path) {
  const String blockedPath = path + ".blocked";
  if (LittleFS.exists(blockedPath)) return true;
  return LittleFS.rename(path, blockedPath);
}

static size_t requeueBlockedRecords() {
  size_t restored = 0;
  while (true) {
    String selected;
    File root = LittleFS.open("/");
    if (!root) break;
    File entry = root.openNextFile();
    while (entry) {
      String name = entry.name();
      if (name.startsWith("q_")) name = "/" + name;
      if (!entry.isDirectory() && name.startsWith("/q_") && name.endsWith(".json.blocked")) {
        const String pendingPath = name.substring(0, name.length() - 8);
        if (!LittleFS.exists(pendingPath)) selected = name;
      }
      entry.close();
      if (selected.length()) break;
      entry = root.openNextFile();
    }
    root.close();
    if (selected.length() == 0) break;
    const String pendingPath = selected.substring(0, selected.length() - 8);
    if (!LittleFS.rename(selected, pendingPath)) break;
    ++restored;
  }
  return restored;
}

static void scheduleRetry() {
  nextPostAttemptMs = millis() + retryDelayMs;
  retryDelayMs = retryDelayMs < 30000 ? retryDelayMs * 2 : 60000;
  if (retryDelayMs > 60000) retryDelayMs = 60000;
}

static void syncOnePendingRecord() {
  if (!storageReady || WiFi.status() != WL_CONNECTED || !isConfigured(API_TOKEN) ||
      !isConfigured(API_URL) || !validId(GATEWAY_ID)) return;
  if (!API_URL.endsWith("/api/v1/readings")) {
    Serial.println(F("API_URL deve terminar exatamente em /api/v1/readings."));
    return;
  }
  if ((int32_t)(millis() - nextPostAttemptMs) < 0) return;

  const String path = nextPendingPath();
  if (path.length() == 0) return;
  const String record = readStoredRecord(path);
  if (record.length() == 0) {
    Serial.printf("Registro local ilegivel mantido para diagnostico: %s\n", path.c_str());
    blockRecordForDiagnosis(path);
    return;
  }

  String body;
  body.reserve(record.length() + strlen(GATEWAY_ID) + 64);
  body += F("{\"schema_version\":1,\"gateway_id\":\"");
  body += GATEWAY_ID;
  body += F("\",\"readings\":[");
  body += record;
  body += F("]}");

  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, API_URL)) {
    Serial.println(F("Nao foi possivel abrir a conexao HTTP; registro permanece na fila."));
    scheduleRetry();
    return;
  }
  http.setConnectTimeout(2500);
  http.setTimeout(3500);
  http.addHeader(F("Content-Type"), F("application/json"));
  http.addHeader(F("Authorization"), String(F("Bearer ")) + API_TOKEN);
  const int code = http.POST(body);
  String response;
  if (code > 0) response = http.getString();
  http.end();

  if (code == 200) {
    String status;
    Reading identity{};
    const bool identified = responseEnvelopeMatches(response) &&
                            identityFromStoredRecord(record, identity) &&
                            responseMatches(response, identity, status);
    if (identified && (status == "accepted" || status == "duplicate")) {
      if (LittleFS.remove(path)) {
        Serial.printf("API confirmou %s; pendencia removida: %s\n", status.c_str(), path.c_str());
        retryDelayMs = 1000;
        nextPostAttemptMs = millis();
      } else {
        Serial.println(F("API confirmou, mas a fila local nao removeu o arquivo; sera repetido com a mesma identidade."));
        scheduleRetry();
      }
      return;
    }

    // Resposta por registro rejected/conflict e permanente para esta tentativa.
    // O arquivo e preservado com sufixo .blocked para diagnostico e nao trava a fila.
    String returnedStatus = identified ? status : String();
    if (identified && (returnedStatus == "rejected" || returnedStatus == "conflict")) {
      if (blockRecordForDiagnosis(path)) {
        Serial.printf("API retornou %s; registro preservado como .blocked.\n", returnedStatus.c_str());
        Serial.println(response);
        nextPostAttemptMs = millis();
        retryDelayMs = 1000;
      }
      return;
    }
    Serial.println(F("HTTP 200 sem confirmacao reconhecida; registro permanece na fila."));
    scheduleRetry();
    return;
  }

  if (code >= 400 && code < 500 && code != 408 && code != 429 && code != 401 && code != 403) {
    if (blockRecordForDiagnosis(path)) {
      Serial.printf("HTTP %d; registro preservado como .blocked para nao repetir erro permanente.\n", code);
      Serial.println(response);
    }
    nextPostAttemptMs = millis();
    retryDelayMs = 1000;
    return;
  }
  if (code == 401 || code == 403) {
    Serial.printf("HTTP %d; confira a credencial local do gateway. Registro mantido.\n", code);
  } else {
    Serial.printf("Falha HTTP/rede (%d); registro mantido para nova tentativa.\n", code);
  }
  scheduleRetry();
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println(F("Gateway ESP32 AgroSponge RS — ESP-NOW, LittleFS e HTTP."));
  Serial.println(F("Depois de corrigir uma rejeicao da API, digite r para reativar arquivos .blocked."));
  WiFi.mode(WIFI_STA);
  Serial.print(F("MAC STA do gateway: "));
  Serial.println(WiFi.macAddress());

  if (!validId(GATEWAY_ID)) {
    Serial.println(F("Preencha GATEWAY_ID em firmware_config.h."));
  }
  if (!LittleFS.begin(false)) {
    Serial.println(F("LittleFS indisponivel. Nao foi formatado automaticamente; confira a particao flash."));
  } else {
    storageReady = true;
    Serial.printf("LittleFS pronto; pendencias recuperadas: %u\n", (unsigned)pendingCount());
  }

  radioQueue = xQueueCreate(kRxQueueLength, sizeof(RadioFrame));
  if (!radioQueue) Serial.println(F("Sem memoria para fila de recepcao ESP-NOW."));

  WiFi.setAutoReconnect(true);
  if (isConfigured(WIFI_SSID)) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.println(F("Conectando ao Wi-Fi. O canal atual sera usado pelo ESP-NOW."));
  } else {
    Serial.println(F("Wi-Fi nao configurado; com GATEWAY_RADIO_CHANNEL preenchido o gateway ainda pode receber nos."));
  }
  if (GATEWAY_RADIO_CHANNEL >= 1 && GATEWAY_RADIO_CHANNEL <= 14) {
    keepRadioOnCurrentChannel();
  }
}

void loop() {
  keepRadioOnCurrentChannel();
  if (WiFi.status() != WL_CONNECTED && isConfigured(WIFI_SSID) &&
      (int32_t)(millis() - nextWifiReconnectMs) >= 0) {
    WiFi.reconnect();
    nextWifiReconnectMs = millis() + 10000;
  }

  processRadioQueue();
  while (Serial.available()) {
    const char command = (char)Serial.read();
    if (command == 'r' || command == 'R') {
      Serial.printf("Registros .blocked reativados: %u. Corrija antes o motivo da rejeicao.\n",
                    (unsigned)requeueBlockedRecords());
    }
  }
  if (droppedRadioFrames) {
    Serial.printf("Pacotes descartados por fila RAM cheia: %lu\n", (unsigned long)droppedRadioFrames);
    droppedRadioFrames = 0;
  }
  syncOnePendingRecord();
  vTaskDelay(pdMS_TO_TICKS(5));
}
