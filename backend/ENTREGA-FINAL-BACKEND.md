# Backend MVP — aceite das entregas 4 e 5

**Registro de aceite:** em 13/11/2026, o usuário confirmou que os testes manuais do backend foram validados. O roteiro abaixo permanece disponível para repetição e integração dos colegas.

O backend agora inclui ingestão, catálogo, consultas, sessões, motor de alertas e outbox persistente para o bot. Versão da API: `0.5.0`; esquema SQLite: **4**; contrato das mensagens de aquisição/heartbeat: **1**.

O backend não envia mensagens ao Telegram. Ele prepara e reserva as notificações, e o processo do Dev 2 realiza o envio e confirma o resultado. Frontend, firmware e bot ainda precisam do ensaio integrado; não se afirma entrega de uma mensagem real nesta validação.

## 1. Atualizar o banco existente

Na pasta `backend/`, com a venv ativa:

```bash
python -m app.manage init-db
python -m app.manage seed-demo
python -m app.manage inspect-db
```

A migração preserva leituras, sessões e token do gateway. Não é necessário apagar o banco nem recriar a credencial de ingestão. O seed normal não ativa alertas automaticamente.

Inicie/recarregue a API como nas etapas anteriores. `/health` deve responder com `schema_version: 4`. `/` agora mostra identificação da API e links para saúde/documentação.

## 2. Ensaio isolado recomendado

Para testar alertas sem misturar a simulação com nós de hardware ou dados que já existem, use outro terminal com um banco de ensaio e porta 8001. Os exports abaixo valem para esse terminal; não substituem seu `.env`:

```bash
cd backend
source .venv/bin/activate
export DATABASE_PATH=data/ensaio-backend.sqlite3
export AUTHORIZED_TELEGRAM_CHAT_ID=123456
export DASHBOARD_URL=http://127.0.0.1:5173
export NOTIFICATION_LEASE_SECONDS=300
python -m app.manage init-db
python -m app.manage seed-demo
python -m app.manage seed-alert-demo
python -m app.manage issue-token gateway-demo-01
python -m app.manage issue-bot-token
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Nesse ensaio, as reservas duram 300 segundos para facilitar a confirmação manual. O chat é fictício e o link aponta para o notebook. Não execute um bot real enviando ao chat fictício. Para a integração real, configure o chat autorizado correto e uma URL do dashboard acessível pelo celular, usando o IP da LAN.

Guarde separadamente os dois tokens exibidos. O primeiro é do gateway; o segundo é interno da API para o bot. Nenhum deles é o token do BotFather. Emitir de novo rotaciona a credencial correspondente. Não envie tokens ao GitHub nem em capturas compartilhadas.

Se reutilizar o banco de ensaio, ele preservará o histórico e o estado. Para uma demonstração nova, escolha outro nome de arquivo em `DATABASE_PATH`; não há exclusão automática de dados.

## 3. Gerar uma ocorrência demonstrativa

Em outro terminal na pasta `backend/`, execute:

```bash
python3 examples/send-demo-readings.py
```

O script pede o token do gateway do ensaio, sem imprimi-lo, e envia por HTTP seis leituras simuladas com horário UTC atual. Os valores padrão são 20, 21, 22, 36, 37 e 38: os três primeiros abrem uma ocorrência e os três últimos registram a recuperação. São dados fictícios, não leitura de um sensor.

O script usa `http://127.0.0.1:8001` por padrão. Não roda o servidor nem grava diretamente no banco. Ele também não fala com o Telegram.

Consulte:

- http://localhost:8001/api/v1/alerts — uma ocorrência resolvida após o ciclo completo.
- http://localhost:8001/api/v1/alert-rules — regra e estado persistido.
- http://localhost:8001/api/v1/alert-evaluations/summary — avaliações por motivo.
- http://localhost:8001/api/v1/readings — medições armazenadas.

Para observar abertura e recuperação separadamente, escolha um boot_id novo para o ensaio:

```bash
python3 examples/send-demo-readings.py --values 20 21 22 --boot-id ensaio-manual-001 --start-sequence 1
python3 examples/send-demo-readings.py --values 36 37 38 --boot-id ensaio-manual-001 --start-sequence 4
```

Entre os comandos, consulte `GET /api/v1/alerts?status=active`. Não repita uma identidade com horário/conteúdo diferente; isso corretamente retorna conflito. Um novo teste deve usar outro boot_id ou continuar a sequência.

Na instância real, um heartbeat pode ter confirmado uma sessão de hardware. Não use essa sessão para inventar medições: mantenha o ensaio isolado. A API ignora para alertas leituras de sessões que não correspondem à sessão atual confirmada.

## 4. Regra e critérios de avaliação

A regra de exemplo em [examples/alert-rule.json](examples/alert-rule.json) vale apenas para `source: simulation`, nó `node-demo-01`, canal `signal-01`, perfil `signal-demo` v1:

- Abertura após três observações válidas consecutivas abaixo de 30.
- Recuperação após três observações válidas em 35 ou mais.
- Entre os limites, não há nova abertura/recuperação; o estado ativo é mantido.
- Erro de sensor, horário inválido, troca de sessão ou intervalo superior a `max_gap_seconds` interrompem a contagem. Uma ocorrência ativa não é considerada recuperada apenas por falta de dados.
- `max_age_seconds` limita a idade da amostra no recebimento. É independente do intervalo entre amostras.
- Duplicação não incrementa contadores e não cria outra mensagem.
- Durante uma ocorrência ativa, novas leituras fora do limite não criam avisos a cada amostra.
- `cooldown_seconds` adia a elegibilidade de avisos seguintes sem descartar ocorrências. O exemplo usa zero para facilitar o ensaio.

Regras automáticas desta entrega são numéricas. Resultados categóricos e booleanos continuam aceitos e consultáveis, mas não têm motor de regras nesta versão.

Os contadores, a última leitura avaliada e a ocorrência ativa sobrevivem ao reinício. A ingestão confirma somente após persistir leitura, avaliação, ocorrência e outbox na mesma transação.

Regras adicionais são configuradas localmente, sem endpoint público de escrita:

```bash
python -m app.manage add-rule caminho/para/regra.json
python -m app.manage disable-rule ID_DA_REGRA
```

Um ID de regra identifica uma configuração imutável. Para mudar critérios, desative a anterior e crie outro ID. Desativar para novas avaliações não inventa uma recuperação das ocorrências existentes, nem apaga suas notificações históricas. A API informa `rule_enabled` para distinguir essa situação.

**Limite importante do MVP:** somente horários de aquisição conhecidos, não futuros e dentro de `max_age_seconds` podem abrir ou recuperar alertas. O firmware atual que envia `measured_at: null` continua sendo aceito e armazenado, mas não dispara automaticamente essas regras. É necessário implementar referência de tempo confiável no hardware ou um mecanismo explícito de estimativa antes de ampliar esse comportamento. Não converter horário de upload em aquisição para contornar a validação.

Dados atrasados, sem horário ou de sessão incerta têm motivo registrado em `alert_evaluations`; não há reprocessamento retrospectivo automático. O resumo conta avaliações por regra, não necessariamente leituras distintas. Nenhum dado antigo é anunciado como condição atual para satisfazer o teste.

## 5. Testar a fila pelo Swagger

Abra http://localhost:8001/docs e autorize `BotServiceToken` com o token interno gerado para a API do ensaio. O `GatewayToken` não autoriza essas rotas.

Execute `POST /api/v1/internal/notifications/claim`:

```json
{"worker_id":"bot-local-1","limit":1}
```

A resposta deve ter uma mensagem com ID, evento, chat de destino, texto, tentativa, `lease_token` e prazo de expiração. Copie a reserva e confirme antes de expirar. Uma nova reserva do mesmo item não é emitida enquanto essa estiver válida.

Para simular o protocolo de confirmação, execute `POST /api/v1/internal/notifications/{id}/delivered`:

```json
{"worker_id":"bot-local-1","lease_token":"TOKEN_DA_RESERVA","telegram_message_id":999}
```

No ensaio, 999 é um ID fictício. Isso testa o protocolo interno e marca a confirmação, mas não representa uma mensagem real recebida por alguém. Em produção do MVP, o bot só confirma depois de obter o ID verdadeiro do Telegram. Repetir a mesma confirmação retorna `duplicate: true`; mudar o resultado da reserva retorna 409.

Para a próxima notificação reservada, simule falha em `/failed`:

```json
{"worker_id":"bot-local-1","lease_token":"TOKEN_DA_RESERVA","error":"timeout de rede no ensaio"}
```

Ela volta a `pending` com atraso crescente, ou passa a `dead` ao atingir o máximo de tentativas. Antes de `available_at`, um novo claim não a retorna. Após o prazo, o novo claim terá outro token e tentativa incrementada. Reserva expirada ou de outro worker não pode ser confirmada.

Diagnóstico autenticado: `GET /api/v1/internal/notifications`. Não retorna hash nem token de reserva. O token de reserva aparece somente no claim e não deve ser publicado em logs.

Recuperação manual de uma notificação em `dead`:

```bash
python -m app.manage requeue-notification ID_DA_NOTIFICACAO
```

O comando inicia um novo ciclo de tentativas, invalida a reserva anterior e permite vincular o item ao chat autorizado atual. Só atua em `dead`; mensagens enviadas ou reservadas não são reenfileiradas dessa forma.

## 6. Integração do Dev 2

O bot precisa de três configurações próprias: URL do backend, token interno da API e token do Telegram. O token do Telegram nunca entra nos nós, gateway ou frontend.

Fluxo do worker:

1. Consultar `/api/v1/internal/bot-config` com `BotServiceToken` e conferir chat autorizado e URL do painel.
2. Restringir os comandos de consulta ao chat autorizado. O backend não recebe as conversas diretamente.
3. Reservar com `worker_id` estável e inicialmente `limit: 1`.
4. Enviar o campo `text` ao `chat_id` indicado, sem interpretação de HTML/Markdown. O bot legado usa HTML e precisa ser adaptado para texto simples.
5. Confirmar `/delivered` somente após o envio; em falha, informar `/failed` com erro resumido, sem tokens.
6. Repetir polling respeitando os prazos. Não buscar nem gravar diretamente no SQLite.

Texto inclui origem, horário do evento, ocorrência e link do painel. Se a ocorrência já se resolveu antes do envio da abertura, o texto informa a situação conhecida e identifica atraso quando houver. Isso não promete a condição física atual do local.

Configurações da API:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `AUTHORIZED_TELEGRAM_CHAT_ID` | Vazio | Sem destino configurado, claim retorna 503 e a fila permanece intacta. |
| `DASHBOARD_URL` | Vazio | URL acessível ao agricultor; se ausente, a mensagem informa que o link não está configurado. |
| `NOTIFICATION_LEASE_SECONDS` | 60 | Prazo de uma reserva. |
| `NOTIFICATION_MAX_ATTEMPTS` | 5 | Limite de tentativas por ciclo. |
| `NOTIFICATION_RETRY_SECONDS` | 10 | Base do atraso exponencial, limitado a uma hora. |

Não trocar o destinatário silenciosamente: itens já vinculados a outro chat são encerrados em `dead`. O operador pode revisar e reenfileirar explicitamente. Falha entre o Telegram aceitar e o bot confirmar na API pode causar repetição; não há garantia de entrega exatamente uma vez.

## 7. Verificação e aceite

Foram aprovados 53 testes ASGI/SQLite com banco temporário, incluindo regressão das entregas anteriores, migrações, alertas, rollback atômico, reserva concorrente, expiração, idempotência, chat autorizado e retentativas. O executor exige temporizador auxiliar para despertar threads e restringe a abertura de porta; o ensaio TCP e o recebimento no Telegram precisam ser confirmados no notebook, com o worker real.

Critérios finais: ocorrência abre e recupera, reinício preserva estado, ausência de Telegram não bloqueia ingestão, fila aguarda configuração quando necessário, confirmação não duplica registros e testes anteriores continuam válidos. Depois desse aceite, organizar o repositório e integrar o trabalho das três frentes.
