# Firmware — nós e gateway ESP32

Frente do Dev 3. Os sketches foram organizados conforme o [plano da equipe](../PLANO-DO-PROJETO.md), preservando o código existente.

| Componente | Sketch | Configuração de exemplo |
| --- | --- | --- |
| Nó sensor | [sensor_node/sensor_node.ino](sensor_node/sensor_node.ino) | [sensor_node/firmware_config.example.h](sensor_node/firmware_config.example.h) |
| Gateway | [gateway/gateway.ino](gateway/gateway.ino) | [gateway/firmware_config.example.h](gateway/firmware_config.example.h) |

O nome de cada `.ino` corresponde ao da pasta, conforme a organização dos sketches Arduino. Abra cada sketch separadamente no Arduino IDE.

Leia o [guia técnico do Dev 3](README-DEV3.md) para configurar, gravar e acompanhar o protocolo. Em cada pasta, copie `firmware_config.example.h` para `firmware_config.h` e preencha os valores locais. Esses arquivos de configuração ficam fora do Git; os exemplos permanecem versionados.

O nó transmite por ESP-NOW. O gateway mantém pendências em LittleFS e envia `POST /api/v1/readings` com a credencial emitida pelo backend. Use o IP do notebook na LAN, com a porta real da API. O banco e os exemplos de integração estão em [backend/](../backend/README.md).

Sensores, placa, partição e versão do core Arduino-ESP32 ainda precisam de definição e ensaio. A reorganização preserva o firmware; não comprova compilação nem funcionamento físico. O horário de aquisição confiável, o heartbeat de sessões e o painel local do gateway ainda precisam ser integrados ao contrato atual.
