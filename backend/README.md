# Backend da plataforma de monitoramento — MVP

API FastAPI em Python 3.12, com SQLite persistente, configuração por ambiente e migrações incrementais. O MVP do backend inclui ingestão autenticada, catálogo, histórico paginado, dispositivos/canais, sessões, alertas numéricos e outbox para o bot.

**Comece por [ENTREGA-FINAL-BACKEND.md](ENTREGA-FINAL-BACKEND.md)**: roteiro de aceite, ensaio isolado e contrato do worker do Dev 2. Não houve envio real ao Telegram nesta implementação; o transporte é responsabilidade do processo do bot.

Testes manuais do backend validados pelo usuário em 13/11/2026. A organização posterior do repositório manteve esta pasta e os caminhos de execução. Integração física e envio real pelo bot continuam pendentes.

## Preparar

A partir da raiz do repositório:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Se `ensurepip` faltar no Ubuntu/Debian, instale `python3.12-venv` no seu terminal e recrie a venv. Não sobrescreva um `.env` já configurado. Instalação exige acesso ao PyPI; depois, o funcionamento local da API não exige baixar dependências novamente. As versões verificadas estão em `requirements.lock.txt`.

```bash
python -m app.manage init-db
python -m app.manage seed-demo
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

No notebook: http://localhost:8000, http://localhost:8000/health e http://localhost:8000/docs. No celular na mesma LAN, usar o IP do notebook em lugar de `localhost`. `0.0.0.0` é o endereço de escuta.

`/health` confirma esquema **4**. O contrato de aquisição e heartbeat continua `schema_version: 1`. Migração não apaga dados; o seed é explícito e não duplica nem sobrescreve cadastros existentes. O seed comum cria 1 gateway, 2 nós, 4 perfis e 8 canais, sem regras nem medições automáticas.

## Rotas públicas da demonstração na LAN

| Método | Rota | Papel |
| --- | --- | --- |
| GET | `/` | Identificação e links da API. |
| GET | `/health` | Prontidão do banco e esquema. |
| GET | `/api/v1/profiles` | Catálogo versionado. |
| POST | `/api/v1/readings` | Até 32 registros e 32 KiB, com `GatewayToken`. |
| GET | `/api/v1/readings` | Histórico por nó/canal/período/origem, com cursor. |
| GET | `/api/v1/devices` | Gateways, nós e canais, sem credenciais. |
| GET | `/api/v1/devices/{node_id}/latest` | Última aquisição e qualidade de recência. |
| POST | `/api/v1/gateways/{gateway_id}/heartbeat` | Sessões e contato, com `GatewayToken`. |
| GET | `/api/v1/alert-rules` | Critérios cadastrados e estado de avaliação. |
| GET | `/api/v1/alerts` | Ocorrências paginadas, com filtros. |
| GET | `/api/v1/alerts/{id}` | Detalhes e situação das notificações. |
| GET | `/api/v1/alert-evaluations/summary` | Motivos de avaliação ou não avaliação. |

As consultas desse MVP usam dados de demonstração na LAN. Autenticação multiusuário e múltiplas propriedades continuam fora do escopo inicial. CORS permite somente origens configuradas e não substitui autenticação.

## API interna do bot

Todas as rotas abaixo exigem **BotServiceToken**, independente da credencial do gateway e do token Telegram:

| Método | Rota | Papel |
| --- | --- | --- |
| GET | `/api/v1/internal/bot-config` | Chat autorizado e URL do painel. |
| GET | `/api/v1/internal/notifications` | Diagnóstico da fila, sem hashes/tokens de reserva. |
| POST | `/api/v1/internal/notifications/claim` | Reserva atômica com prazo. |
| POST | `/api/v1/internal/notifications/{id}/delivered` | Confirma envio realizado pelo bot. |
| POST | `/api/v1/internal/notifications/{id}/failed` | Registra falha e agenda retentativa. |

O backend não recebe o token Telegram. O bot consulta a configuração, restringe comandos ao chat permitido, reserva, envia e confirma. Sem chat autorizado configurado, claim retorna 503 sem perder mensagens ou consumir tentativas. Falhas do bot não bloqueiam ingestão.

## Comandos locais

```bash
python -m app.manage inspect-db
python -m app.manage issue-token gateway-demo-01
python -m app.manage issue-bot-token
python -m app.manage seed-alert-demo
python -m app.manage add-rule caminho/regra.json
python -m app.manage disable-rule ID_DA_REGRA
python -m app.manage requeue-notification ID_DA_NOTIFICACAO
```

Execute os comandos que precisar, não todos como sequência automática. Emissão rotaciona o token correspondente, exibido uma vez; somente o hash fica no banco. As regras não são ativadas pela migração ou pelo seed comum. `seed-alert-demo` cadastra explicitamente o exemplo numérico experimental. Uma regra é imutável por ID; desativar não inventa recuperação das ocorrências anteriores. Reenqueue só opera em notificações `dead`, por ação explícita do operador.

## Configuração

| Variável | Padrão |
| --- | --- |
| `DATABASE_PATH` | `data/monitoramento.sqlite3`, relativo a `backend/`. |
| `SQLITE_TIMEOUT_SECONDS` | 5. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173`. |
| `STALE_AFTER_SECONDS` | 300; canais podem ter valor específico. |
| `AUTHORIZED_TELEGRAM_CHAT_ID` | Vazio; necessário para reservar notificações. |
| `DASHBOARD_URL` | Vazio; configurar IP/URL que o agricultor consegue abrir. |
| `NOTIFICATION_LEASE_SECONDS` | 60. |
| `NOTIFICATION_MAX_ATTEMPTS` | 5. |
| `NOTIFICATION_RETRY_SECONDS` | 10; atraso exponencial limitado a uma hora. |

Ambiente do processo prevalece sobre `.env`. Reinicie a API após editar configuração. Bancos, WAL/SHM, `.env`, venv e logs são ignorados pelo Git. Não há credenciais padrão no código.

## Integridade e limites do motor

- Leitura nova, duplicada, rejeitada ou conflitante retorna status individual; confirmação só depois do commit. Falha inesperada de banco reverte o lote.
- Unidade e tipo vêm do perfil; zero e falso não viram ausência. Erro usa resultado nulo. ADC não vira percentual sem calibração.
- Comunicação do gateway, contato de rádio estimado e aquisição são informações diferentes. Histórico antigo não faz o ponto parecer recém-medido.
- Alertas numéricos usam observações consecutivas, histerese, janela de idade, intervalo máximo e cooldown; duplicados não contam novamente. Estado, ocorrência e outbox são persistidos na mesma transação.
- **Horário desconhecido, futuro, atrasado ou sessão incerta não abre nem recupera alerta automaticamente.** O motivo fica registrado. O firmware que hoje envia horário nulo continua aceito, mas precisa de referência temporal confiável para esse motor.
- Regras categóricas/booleanas e reprocessamento retrospectivo são evoluções futuras; armazenamento e consulta desses resultados já funcionam.
- Entrega exatamente uma vez ao Telegram não é garantida se houver falha entre aceite externo e confirmação. A fila tem retentativa limitada e diagnóstico persistente.

## Testes e integração

```bash
python -m unittest discover -s tests -v
```

Foram aprovados **53 testes ASGI/SQLite** em bancos temporários. Cobrem as entregas anteriores, migrações, alertas, reserva, expiração, retentativas e confirmação idempotente. O executor restringe portas locais e o despertar entre threads; as verificações usaram temporizador auxiliar no loop sem substituir a aplicação. A validação TCP e o envio real pelo bot devem ser feitos no notebook.

Roteiros anteriores: [entrega 2](TESTE-MANUAL-ENTREGA-2.md) e [entrega 3](TESTE-MANUAL-ENTREGA-3.md). Para o backend atual, use o [aceite final](ENTREGA-FINAL-BACKEND.md). O frontend e os sketches não foram conectados automaticamente nesta entrega. Organização do repositório ficará para depois desse aceite.

Plano da frente: [PLANO-BACKEND.md](../PLANO-BACKEND.md). Contrato da equipe: [PLANO-DO-PROJETO.md](../PLANO-DO-PROJETO.md).
