#pragma once

// Copie este arquivo como firmware_config.h e preencha com os identificadores
// confirmados pela equipe. Este exemplo nao contem credenciais nem MAC real.
#define NODE_ID "PREENCHER_NODE_ID"
#define NODE_GATEWAY_MAC "PREENCHER_MAC_DO_GATEWAY"
#define NODE_RADIO_CHANNEL 0

#define NODE_SENSOR_ID "PREENCHER_SENSOR_ID"
#define NODE_CHANNEL_ID "PREENCHER_CHANNEL_ID"
#define NODE_PROFILE_ID "PREENCHER_PROFILE_ID"
#define NODE_PROFILE_VERSION 0

// 1 = mock explicito. Para sensor fisico, definir 0 e implementar acquireSensor()
// no sketch usando a leitura direta do sensor, sem conversao/calibracao.
#define NODE_USE_MOCK 1
#define NODE_MOCK_RAW_VALUE 1234LL
