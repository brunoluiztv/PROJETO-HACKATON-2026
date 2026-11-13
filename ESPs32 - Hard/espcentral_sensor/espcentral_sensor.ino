#include <Arduino.h>

/*
  ESP1 — mock temporario

  Este sketch nao depende de um sensor, modelo de placa, pino ou protocolo
  especifico. Ele usa um valor ficticio e imprime uma mensagem JSON pela
  Serial para servir de base ate confirmarmos o hardware.

  Para a versao real:
  1. Substitua lerSensorUmidadeMock() pela leitura do sensor confirmado.
  2. Substitua enviarParaCentralMock() pelo transporte escolhido para a ESP
     Central. A Serial aqui e apenas uma demonstracao da mensagem.
  3. Ajuste INTERVALO_MOCK_MS conforme a frequencia de leitura definida.
*/

// Cadencia provisoria da demonstracao; nao e uma configuracao confirmada.
const uint32_t INTERVALO_MOCK_MS = 5000;

// Valor ficticio, sem unidade. Nao representa uma leitura real do sensor.
const int32_t VALOR_FICTICIO = 1234;

uint32_t ultimaMensagemMs = 0;

int32_t lerSensorUmidadeMock() {
  // TODO: trocar pela leitura direta devolvida pelo sensor/biblioteca.
  return VALOR_FICTICIO;
}

void enviarParaCentralMock(int32_t valor) {
  // TODO: trocar a saida Serial pela comunicacao real com a ESP Central.
  Serial.print(F("{\"sensor\":\"umidade\",\"valor\":"));
  Serial.print(valor);
  Serial.println(F(",\"mock\":true}"));
}

void setup() {
  Serial.begin(115200);
}

void loop() {
  const uint32_t agoraMs = millis();

  if ((uint32_t)(agoraMs - ultimaMensagemMs) >= INTERVALO_MOCK_MS) {
    ultimaMensagemMs = agoraMs;

    const int32_t valor = lerSensorUmidadeMock();
    enviarParaCentralMock(valor);
  }
}

