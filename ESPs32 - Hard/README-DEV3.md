# Firmware ESP32 — Dev 3

Este diretório implementa o nó e o gateway conforme a arquitetura ESP-NOW → Wi-Fi → FastAPI. O firmware não escolhe sensor, pinos, frequência, unidade, MAC, credenciais nem IP do notebook. Esses dados precisam ser preenchidos quando a equipe os confirmar.

Esta entrega está em outputs/ porque o workspace aberto não contém um clone do repositório. Os arquivos preservam os caminhos internos ESPs32 - Hard/ para serem copiados ao checkout da equipe; a branch remota não foi alterada.

## O que foi conferido na branch remota

Na branch main do repositório, docs/PLANO-EQUIPE-MVP.md e docs/CONTRATO-API-V1.md existem, mas encaminham para as seções correspondentes de PLANO-DO-PROJETO.md. A parte 2 desse plano é o contrato usado aqui: POST /api/v1/readings, envelope com schema_version, gateway_id e readings, e confirmação por leitura (accepted, duplicate, rejected ou conflict).

Referências consultadas: [plano e contrato na branch main](https://github.com/brunoluiztv/PROJETO-HACKATON-2026/blob/main/PLANO-DO-PROJETO.md), [atalho do plano da equipe](https://github.com/brunoluiztv/PROJETO-HACKATON-2026/blob/main/docs/PLANO-EQUIPE-MVP.md) e [atalho do contrato](https://github.com/brunoluiztv/PROJETO-HACKATON-2026/blob/main/docs/CONTRATO-API-V1.md).

Antes da alteração, os dois sketches eram mocks iguais: imprimiam JSON pela Serial e usavam o inteiro fictício 1234. O exemplo mock foi mantido no nó, claramente identificado, mas a saída agora usa ESP-NOW.

## Decisões do firmware

- O nó só coleta após digitar r no Serial Monitor. Assim não se presume uma frequência que ainda não foi definida. A fonte inicial é um inteiro fictício 1234, sem unidade e sem conversão. Ao instalar o sensor, acquireSensor() deve devolver o valor e o tipo diretamente.
- Cada boot cria um node_boot_id aleatório; a sequência avança a cada nova amostra. O pacote leva node_id, sensor_id, channel_id, profile_id e profile_version do contrato. Uma leitura aguarda ACK antes de o nó aceitar outra; são feitas até três tentativas automáticas. Se não houver ACK, digitar r tenta de novo a mesma leitura e mantém a mesma identidade.
- O protocolo ESP-NOW tem versão e campos serializados em bytes, sem depender do padding de struct. O pacote fica limitado a 250 bytes. O callback do gateway apenas copia MAC e pacote para uma fila de RAM.
- O gateway grava cada leitura como arquivo separado em LittleFS e só então envia o ACK. Identificadores do protocolo de rádio aceitam até 40 caracteres ASCII. São aceitos até 128 arquivos locais no total, incluindo pendências, temporários de gravação e diagnósticos .blocked; com LittleFS indisponível, gravação falha ou limite cheio, o gateway não confirma ao nó.
- LittleFS foi escolhido porque os sketches já usam o ambiente Arduino e não há placa, pinos de SD ou configuração PlatformIO definida. Ele usa a flash da placa e dispensa fiação adicional. A placa precisa de uma tabela de partições com uma partição de dados disponível. O sketch chama LittleFS.begin(false): não formata a flash se a montagem falhar. Não usa NVS como log de leituras.
- O callback de rádio não faz acesso ao flash nem HTTP. O processamento da fila acontece no loop().
- Para o POST, o gateway serializa o JSON do contrato sem mudar a medição. O envio usa Bearer token, exatamente POST /api/v1/readings e um registro por lote. O arquivo só é removido após HTTP 200 e estado accepted ou duplicate com os mesmos IDs. Rejeições/conflitos permanecem em arquivo .blocked, e a resposta da API aparece na Serial. Depois de corrigir o motivo, digite r no Serial do gateway para reativar arquivos .blocked. Falhas de rede e autenticação mantêm o .json e usam atraso crescente entre tentativas.
- A deduplicação local cobre registros que ainda estão na fila. Depois que um registro é aceito e removido localmente, o contrato da API é a proteção para um retransmitido tardio: a API deve devolver duplicate para a mesma identidade e conteúdo. IDs repetidos com conteúdo diferente devem retornar conflict.
- O gateway segue o canal do Wi-Fi quando conectado e informa esse canal pela Serial. Se iniciar sem Wi-Fi, precisa de GATEWAY_RADIO_CHANNEL configurado com o canal real. Cada nó usa esse mesmo canal. Esse é o canal de rádio; não é o channel_id da medição.

## Configurar sem versionar segredos

1. Copie espcentral_sensor/firmware_config.example.h para espcentral_sensor/firmware_config.h.
2. Preencha GATEWAY_ID, SSID e senha localmente. Use o token Bearer emitido para o gateway. Configure API_URL com o endereço local informado pelo Dev 1, por exemplo no formato http://IP_DO_NOTEBOOK:8000/api/v1/readings. O plano do projeto prevê a porta 8000; confirme a porta real antes de usar.
3. Grave o gateway e abra o Serial Monitor em 115200. Copie o MAC STA do gateway para a configuração do nó. Após conectar ao roteador, copie o canal mostrado como ESP-NOW pronto no canal ....
4. Copie esp1_sensor/firmware_config.example.h para esp1_sensor/firmware_config.h. Preencha os IDs cadastrados pela equipe, o MAC copiado e o mesmo canal de rádio. Para manter o mock, deixe NODE_USE_MOCK como 1. O valor de perfil deve existir no catálogo da API; 0 indica configuração incompleta.
5. Grave o nó, abra sua Serial em 115200 e digite r + Enter. Observe o ACK do gateway. A configuração local é ignorada pelo .gitignore deste diretório.

O sketch não contém nenhum IP, MAC, SSID, senha, token ou canal real. Se o roteador mudar de canal, atualize NODE_RADIO_CHANNEL no nó e confirme o canal atual impresso pelo gateway.

## Gravar as placas

1. Abra cada arquivo .ino pela pasta de seu sketch no Arduino IDE. Se necessário, instale o pacote de placas Arduino-ESP32. As bibliotecas usadas (Wi-Fi, ESP-NOW, HTTPClient e LittleFS) vêm com esse pacote; não há dependência de biblioteca externa.
2. Selecione o modelo exato da placa e a porta serial que correspondem ao hardware recebido. Não escolha modelo por suposição.
3. No gateway, selecione uma tabela de partições que tenha partição de dados para o LittleFS. Se não souber qual serve à placa, confirme antes com a equipe de hardware.
4. Grave primeiro o gateway e depois o nó. Abra os monitores seriais a 115200 para obter MAC/canal e acompanhar ACKs e sincronização.

Esses são passos de configuração; a compilação e o teste físico ainda precisam ser feitos no modelo de placa e na versão de core que a equipe usar.

## Descobrir a rede local quando os dados forem fornecidos

- No gateway, use a linha MAC STA do gateway do Serial Monitor; não use um MAC copiado de outro ESP32.
- Para obter o canal, aguarde a linha ESP-NOW pronto no canal N depois de o gateway se conectar à rede. Configure esse mesmo número no nó. Para iniciar recepção com o ponto de acesso fora do ar, informe esse canal já conhecido em GATEWAY_RADIO_CHANNEL.
- No Windows, rode ipconfig no notebook e use o IPv4 do adaptador conectado ao mesmo Wi-Fi do gateway. No Linux, consulte ip addr; no macOS, ifconfig. Use o endereço LAN do notebook na API_URL, não localhost nem o endereço público.
- A FastAPI precisa aceitar conexões na LAN e o firewall do notebook precisa permitir a porta escolhida. O caminho HTTP permanece /api/v1/readings.

## Exemplo de JSON do contrato

O formato abaixo segue o exemplo de PLANO-DO-PROJETO.md. Os valores de identidade e a medição são demonstração; não descrevem o hardware real.

    {
      "schema_version": 1,
      "gateway_id": "gateway-demo-01",
      "readings": [
        {
          "node_id": "node-demo-01",
          "node_boot_id": "boot-unico-001",
          "sequence": 42,
          "sensor_id": "sensor-demo-01",
          "channel_id": "signal-01",
          "profile_id": "signal-demo",
          "profile_version": 1,
          "result": { "kind": "numeric", "value": 42.5 },
          "quality": "valid",
          "source": "simulation",
          "measured_at": null,
          "time_quality": "unknown",
          "node_uptime_ms": 420000
        }
      ]
    }

O valor fictício 1234 emitido pelo mock deste sketch segue o mesmo formato, com result.value numérico e source igual a simulation.

## Ambiente e pendências

O repositório não define modelo de placa, versão instalada do core Arduino-ESP32, partição flash nem sensores físicos. Os callbacks ESP-NOW incluem adaptação para cores Arduino-ESP32 2.x e 3.x, mas ainda exigem compilação com o ambiente e as placas reais. Se LittleFS não montar, escolha uma partição flash compatível antes de operar; não habilite formatação automática em um gateway que possa ter pendências.

Este firmware ainda depende dos IDs cadastrados no backend, MAC e canal reais, Wi-Fi e token locais, IP/porta reais do notebook e teste físico do enlace e da recuperação de energia. Sem esses dados, o POST fica intencionalmente inativo. Não foi afirmada compilação nem teste em placa.
