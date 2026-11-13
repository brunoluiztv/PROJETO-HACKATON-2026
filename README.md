# tekó biotech — portal de monitoramento para agricultura familiar

Projeto desenvolvido no **Hackathon das Engenharias UERGS 2026** por uma equipe de três desenvolvedores. O objetivo é coletar medições em pontos distribuídos, armazenar o histórico e permitir ao agricultor consultar informações pelo celular, computador e Telegram.

**A equipe adotou o nome tekó biotech; registro e domínio ainda estão em verificação.** Sensores e grandezas a medir continuam em definição. A arquitetura permite adaptar a apresentação sem vincular todo o sistema a um único sensor.

## Documentação principal

Comece pelo **[PLANO-DO-PROJETO.md](PLANO-DO-PROJETO.md)**, na raiz do repositório. Ele reúne:

- Arquitetura e responsabilidades dos componentes.
- Divisão de trabalho dos três desenvolvedores e organização Git.
- Contrato proposto de integração da API.
- Etapas de entrega, critérios de aceite e roteiro de demonstração.

Para a frente do Dev 1, consulte o **[PLANO-BACKEND.md](PLANO-BACKEND.md)**: módulos, persistência SQLite, transações, ingestão, consultas, motor de alertas, integração interna com o bot e ordem das entregas.

O [índice da documentação](docs/README.md) reúne os guias dos componentes, a [organização do repositório](docs/ORGANIZACAO-REPOSITORIO.md), a direção do portal e os registros anteriores. O plano central descreve a arquitetura acordada para a integração.

## Arquitetura do MVP

```mermaid
flowchart TD
    N1["Nó ESP32 + sensores"] -->|ESP-NOW| G["ESP32 gateway"]
    N2["Outro nó ESP32 + sensores"] -->|ESP-NOW| G
    G --> F["Armazenamento persistente e painel local"]
    G -->|Wi-Fi + HTTP na rede local| A["Notebook: FastAPI"]
    A --> D["SQLite: leituras, regras e alertas"]
    A --> W["Dashboard React: celular e PC"]
    B["Bot Python"] <-->|API| A
    B <-->|Internet| T["Telegram: consultas, avisos e link do painel"]
```

Os nós coletam e transmitem. O gateway recebe os dados, mantém pendências e encaminha à API. O backend valida, armazena e avalia regras; dashboard e bot consultam a mesma fonte de dados. O token do Telegram permanece no notebook.

A configuração inicial utiliza **notebook local**, com FastAPI e SQLite. O armazenamento e o painel embarcados serão centralizados no gateway. As funcionalidades planejadas ainda precisam ser integradas e validadas.

## Estado do desenvolvimento

| Componente | Situação |
| --- | --- |
| Frontend integrado | Implementado em `frontend/`, com modos API e demonstração separados, triagem da lavoura, simulação e consulta a pontos; integração completa precisa de aceite no notebook. |
| Histórico e exportação | Gráficos, tabela, períodos e CSV disponíveis na demonstração do frontend. |
| Bot Telegram | Código inicial existente; comandos de monitoramento e integração com a API ainda precisam ser concluídos. |
| Hardware | Sketches organizados em `firmware/sensor_node/` e `firmware/gateway/`; integração com o contrato e ensaio completo precisam ser validados. |
| API e banco | Backend MVP implementado: ingestão, catálogo, histórico, sessões, alertas numéricos e outbox do bot. 53 testes ASGI aprovados e testes manuais validados pelo usuário; integração física e envio real pelo bot pendentes. |
| Fila persistente, sincronização e alertas | Especificados no plano; validação integrada pendente. |
| Sensores e critérios de análise | Em definição. |

O frontend ainda não está conectado a medições físicas. Os exemplos apresentados são simulações, sem comprovação de concentração, contaminação ou classificação agronômica. Critérios reais dependem da escolha dos sensores, calibração e validação do método.

Os protótipos anteriores estão preservados em [legacy/](legacy/README.md). `legacy/web/` e o bot atual ainda contêm a proposta antiga com saco de gel. O fluxo atual do produto está em `frontend/`. O bot ainda precisa ser adaptado antes de ser oferecido como Tekó.

## Organização do repositório

```text
PROJETO-HACKATON-2026/
├── README.md
├── PLANO-DO-PROJETO.md       # Referência central da equipe e contrato da API
├── PLANO-BACKEND.md          # Entregas e organização do Dev 1
├── frontend/                # Interface integrada em React, TypeScript e Vite
├── backend/                 # API, banco, alertas e fila de notificações
├── bot/                     # Bot Python e testes existentes
├── firmware/                # Dev 3: sketches do nó e do gateway
│   ├── sensor_node/
│   └── gateway/
├── skills/                  # Padrão sickn33/agentic-awesome-skills para IAs e Agentes
├── docs/                    # Relatórios, planos e registros técnicos
│   └── BIOSSENSOR-LOGICA-E-MERCADO.md # Lógica in-planta, física de solos e mercado
├── web/                     # WebApp mobile PWA responsivo (GitHub Pages)
├── legacy/                  # Protótipos anteriores, preservados
│   ├── web/
│   └── dashboard/
├── extension/               # Extensão de acessibilidade existente
└── assets/                  # Materiais de apresentação existentes
```

Concentrar novas telas em `frontend/`. O frontend atual é independente de `legacy/`. Consulte o [guia do firmware](firmware/README.md) e o [mapa dos caminhos alterados](docs/ORGANIZACAO-REPOSITORIO.md).

## Executar o frontend

Com Node.js e npm instalados, a partir da raiz do repositório:

```bash
cd frontend
npm ci
npm run dev
```

Abra o endereço **Local** informado pelo Vite, normalmente `http://localhost:5173`. Mantenha o terminal aberto.

Para acessar pelo celular, conecte celular e notebook à mesma rede e abra o endereço **Network** informado pelo Vite. `localhost` no celular aponta para o próprio celular.

Para verificar e gerar o build:

```bash
npm test
npm run build
npm run preview
```

O build gera `frontend/dist/`. O roteiro de validação está no [README do frontend](frontend/README.md). A instalação exige acesso ao servidor de pacotes npm; houve timeout no Wi-Fi usado durante o desenvolvimento, enquanto a conexão móvel permitiu prosseguir.

## Backend MVP

A implementação está em **[backend/](backend/README.md)**. O banco passa para esquema **4**, preservando catálogo, tokens, leituras e sessões. O [aceite final do backend](backend/ENTREGA-FINAL-BACKEND.md) documenta alertas, reserva de notificações, retentativas e integração do Dev 2. O backend prepara e registra as mensagens; o bot realiza o envio real ao Telegram.

Os alertas automáticos desta versão são numéricos e exigem horário de aquisição confiável e recente. Leituras sem horário continuam armazenadas, mas não abrem ou recuperam ocorrências. Isso precisa ser considerado na integração do firmware. Regras de exemplo são experimentais e voltadas à simulação.

## Bot Telegram

O código inicial e seus requisitos estão em [bot/](bot/). Para preparar o ambiente em Linux/macOS:

```bash
cd bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Preencha o token e a URL apropriada em `.env`, sem versionar credenciais. O [guia existente](docs/CONFIGURACAO-TELEGRAM.md) documenta a configuração inicial; textos, comandos e identidade ainda precisam ser adaptados à plataforma atual.

O MVP prevê `/start`, `/status`, `/sensores`, `/alertas`, `/painel` e `/ajuda`, além de envio de alertas com link do dashboard. O estado da ocorrência e as retentativas de notificação deverão ser persistidos pela API.

No ensaio local, `/painel` deve enviar um link comum com o IP do notebook. O botão Mini App da implementação anterior exige HTTPS e precisa de tratamento diferente para um endereço HTTP local. Esse link local não é acessível fora da rede do notebook.

## Funcionamento sem internet

- Se a internet externa cair, mas a rede local e o notebook continuarem funcionando, a coleta, a API e o dashboard local poderão continuar após a integração.
- Se o notebook ou a API estiver indisponível, o gateway deverá armazenar pendências para sincronização posterior.
- O painel local leve do gateway permitirá consulta próxima, dentro da retenção disponível.
- Telegram depende de internet; falhas de envio não devem bloquear aquisição e persistência.
- Dados apenas em RAM nos nós podem ser perdidos após desligamento. Garantias de retenção exigem armazenamento persistente e teste.

## Próximas entregas

1. Validar o frontend no modo API com seleção de nó, canal e alertas.
2. Integrar nó, gateway, armazenamento, referência de tempo, heartbeat e reenvio sem duplicações.
3. Integrar o bot à fila persistente e validar recebimento real pelo Telegram.
4. Escolher e calibrar sensores, adaptando seus perfis de análise.
5. Validar o fluxo completo no celular e PC, incluindo interrupção e recuperação de conexão.

Cada desenvolvedor trabalha em branch própria, com entregas pequenas e revisão por outro membro. Alterações no contrato devem acompanhar a documentação e ser combinadas com a equipe.
