# Organização do repositório

Data: 13/11/2026. Reorganização realizada após o usuário informar que os testes manuais do backend foram validados.

## Estrutura para a equipe

```text
PROJETO-HACKATON-2026/
├── README.md
├── PLANO-DO-PROJETO.md
├── PLANO-BACKEND.md
├── backend/                 # Dev 1: API, SQLite, regras e outbox
├── frontend/                # Dev 2: portal React, modos API e demonstração
├── bot/                     # Dev 2: processo Telegram, adaptação pendente
├── firmware/                # Dev 3: sketches e guia de configuração
│   ├── sensor_node/
│   └── gateway/
├── docs/                    # Documentação e evidências
├── legacy/                  # Interfaces anteriores, preservadas
│   ├── web/
│   └── dashboard/
├── extension/               # Extensão existente, integração atual a revisar
└── assets/                  # Materiais existentes de apresentação
```

## Mapa de mudanças

| Caminho anterior | Caminho atual |
| --- | --- |
| `ESPs32 - Hard/esp1_sensor/esp1_sensor.ino` | `firmware/sensor_node/sensor_node.ino` |
| `ESPs32 - Hard/espcentral_sensor/espcentral_sensor.ino` | `firmware/gateway/gateway.ino` |
| `ESPs32 - Hard/esp1_sensor/firmware_config.example.h` | `firmware/sensor_node/firmware_config.example.h` |
| `ESPs32 - Hard/espcentral_sensor/firmware_config.example.h` | `firmware/gateway/firmware_config.example.h` |
| `ESPs32 - Hard/README-DEV3.md` | `firmware/README-DEV3.md` |
| `web/` | `legacy/web/` |
| `dashboard/` | `legacy/dashboard/` |

Os sketches foram renomeados junto com as pastas para manter a convenção Arduino. A lógica do firmware e as configurações de exemplo foram preservadas. O frontend já havia deixado de importar `web/js/content.js`, permitindo arquivar o site anterior. Os caminhos internos dos protótipos permanecem iguais.

`backend/`, `frontend/` e `bot/` continuam nos mesmos locais. Ambientes virtuais, dependências instaladas, configurações locais e bancos de execução permanecem nos diretórios dos serviços. Os planos continuam na raiz para consulta da equipe. As regras de ignore cobrem configurações de firmware, ambientes, bancos, builds e logs.

## Validação e próximos passos

- Backend MVP: 53 testes automatizados aprovados na entrega anterior; testes manuais aceitos pelo usuário antes desta organização. A reorganização não altera o código da API nem as migrações.
- Frontend: `npm test` e `npm run build` aprovados após a movimentação, confirmando a independência dos protótipos.
- Integridade: 66 arquivos de código e recursos conferidos por SHA-256, incluindo o código da API e os sketches movidos; 95 links locais da documentação conferidos.
- Firmware: nomes dos sketches e pastas conferidos; exemplos permanecem versionáveis e configurações locais são ignoradas. Compilação e teste nas placas continuam pendentes.
- Integração: validar frontend no celular, aquisição física, referência de tempo, heartbeat, reenvio e envio real pelo bot. O aceite do backend não representa aceite desses componentes.

Cada desenvolvedor continua trabalhando na pasta de sua frente e em branch própria. A revisão deve incluir o novo caminho dos arquivos movidos. Esta reorganização prepara o conteúdo local; commit e envio ao GitHub são etapas separadas.
