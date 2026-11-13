#pragma once

// Copie este arquivo como firmware_config.h e preencha apenas localmente.
// Nao versionar SSID, senha, token ou valores reais de rede.
#define GATEWAY_ID "PREENCHER_GATEWAY_ID"
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_TOKEN ""

// URL completa, terminando exatamente em /api/v1/readings.
// Exemplo de formato: http://IP_DO_NOTEBOOK:8000/api/v1/readings
#define API_URL ""

// 0 = adotar o canal que o gateway obteve ao conectar ao Wi-Fi.
// Sem Wi-Fi desde a inicializacao, informe aqui o canal real da rede/AP.
#define GATEWAY_RADIO_CHANNEL 0
