# Plano de desenvolvimento do backend — Dev 1

Escopo: implementar a API e a persistência da plataforma de monitoramento para agricultura familiar. O notebook local executará os serviços do MVP. Sensores continuam em definição; o backend será desenvolvido e testado com dados identificados como simulação.

Este documento detalha a frente do Dev 1 e complementa o [plano central e contrato v1](PLANO-DO-PROJETO.md). Descreve a organização e as fases do backend; o progresso atual está registrado abaixo.

Progresso: código das entregas 1 a 5 concluído para o backend MVP. Banco versão 4, API 0.5.0 e 53 testes ASGI aprovados. O [aceite final](backend/ENTREGA-FINAL-BACKEND.md) cobre alertas numéricos e outbox do bot. Em 13/11/2026, o usuário confirmou a validação dos testes manuais do backend. A reorganização posterior está registrada em [docs/ORGANIZACAO-REPOSITORIO.md](docs/ORGANIZACAO-REPOSITORIO.md). A integração real com bot/hardware e o ensaio do frontend no celular continuam pendentes.

## 1. Responsabilidade da sua frente

A API recebe dados do gateway, autentica a origem, valida, evita duplicação, armazena o histórico, oferece consultas, avalia regras e registra notificações pendentes. Frontend e bot consultam a API. A API é a única responsável por acessar o banco.

O envio ao Telegram será feito pelo processo do bot, de responsabilidade principal do Dev 2. Sua frente entrega a fila persistente, a reserva das mensagens e a confirmação de resultado. Uma falha no Telegram não pode impedir uma leitura de ser armazenada.

**Primeira meta:** um JSON simulado entra em `POST /api/v1/readings`, é gravado no SQLite, pode ser consultado e não duplica quando reenviado. Essa entrega libera os outros dois desenvolvedores.

## 2. Stack e limites iniciais

| Parte | Escolha para o MVP |
| --- | --- |
| Linguagem | Python 3.12, disponível no ambiente verificado. |
| API | FastAPI, executada com Uvicorn. |
| Validação | Pydantic, com tipos e verificações explícitos por resultado. |
| Configuração | Variáveis de ambiente; carregamento/validação centralizados. |
| Banco | SQLite em arquivo local, via `sqlite3`. |
| Migrações | Scripts SQL numerados, com controle de versão aplicado. |
| Testes | unittest e aplicação ASGI em processo; banco temporário por teste, sem dependências adicionais. |

Não acrescentar ORM, banco alternativo ou processamento distribuído na primeira entrega. Repositórios encapsulam SQL, permitindo rever essa decisão depois. Fixar as versões efetivamente instaladas e testadas nas dependências da primeira implementação; não instalar pacotes a cada inicialização do serviço.

SQLite não exige servidor de banco separado; consultar a [documentação do módulo sqlite3](https://docs.python.org/3.12/library/sqlite3.html). A definição dos modelos deve impedir coerções inadequadas de tipos; o [modo estrito do Pydantic](https://docs.pydantic.dev/latest/concepts/strict_mode/) ajuda nessa validação, complementado por regras de domínio.

## 3. Estrutura de implementação

```text
backend/
  README.md
  ENTREGA-FINAL-BACKEND.md        # Aceite e contrato interno do worker
  requirements.txt
  requirements.lock.txt         # Dependências verificadas
  .env.example
  app/
    main.py                     # Factory, rotas, CORS e erros
    config.py                   # Configuração validada
    database.py                 # Conexões, transações e migrações
    security.py                 # Credenciais de gateway e do bot
    middleware.py               # Limite do corpo HTTP
    manage.py                   # CLI de cadastro, credenciais e manutenção
    timeutils.py
    schemas/                    # Leituras, consultas, heartbeat, alertas e outbox
    routers/                    # Saúde, perfis, dispositivos e operações da API
    repositories/
      catalog.py
      readings.py
      recency.py                # Seleção da sessão/última leitura
    services/
      ingestion.py
      history.py
      devices.py
      heartbeat.py
      recency.py
      rules.py
      alert_engine.py
      alerts.py
      notifications.py
      health.py
    migrations/
      001_catalog.sql
      002_readings.sql
      003_queries_sessions.sql
      004_alerts_notifications.sql
    seed.py
    demo_catalog.json
  examples/                     # JSONs e simulador HTTP manual
  tests/
    support.py                  # Harness ASGI e banco temporário
    alert_support.py
    test_ingestion.py
    test_queries.py
    test_heartbeat.py
    test_alerts.py
    test_notifications.py
  data/                         # Execução local; ignorado pelo Git
```

A árvore reflete a implementação atual. `schemas` representa o contrato de entrada/saída; `repositories` reúne consultas reutilizadas; `services` coordena decisões, SQL e transações. Rotas permanecem pequenas. As quatro migrações aplicadas são preservadas; alterações futuras de esquema exigem nova migração.

Evitar importações circulares: rotas chamam serviços, serviços usam repositórios e funções de domínio; repositórios não importam rotas. O catálogo não deve depender do frontend para iniciar.

## 4. Banco e integridade

| Entidade | Campos/restrições essenciais |
| --- | --- |
| Gateways | ID, nome, credencial associada e última comunicação. |
| Nós | ID, gateway autorizado, área e sessão atual conhecida quando confirmada. |
| Perfis | ID + versão, tipo, unidade ou categorias, metadados de apresentação imutáveis. |
| Canais | Nó + canal, sensor, perfil/versionamento e configuração de calibração disponível. |
| Leituras | ID, origem completa, sessão, sequência, resultado tipado, qualidade, origem, horários e uptime. |
| Regras | Canal, perfil/versão aplicáveis, direção, limiar, margem e quantidade consecutiva. |
| Estado da regra | Contadores, sessão/última leitura avaliada e ocorrência ativa. |
| Ocorrências | Regra, estado, abertura/encerramento e leituras de referência. |
| Outbox | Ocorrência, destinatário, conteúdo, estado, tentativas, reserva e próxima tentativa. |

Criar no banco a restrição única `(node_id, node_boot_id, sequence, channel_id)`. Não confiar apenas em uma consulta prévia de existência. IDs de canal são únicos dentro de cada nó. Usar chaves estrangeiras para preservar associações e índices para consulta por nó/canal/período e busca de notificações pendentes.

O resultado deve preservar seu tipo: número, código categórico ou booleano. Pode ser armazenado como JSON validado acompanhado do discriminador, evitando transformar todos os valores em strings ou floats. JSON inválido, unidade incompatível e categoria inexistente são rejeitados na entrada. Perfis versionados não mudam silenciosamente a interpretação dos registros antigos.

Datas conhecidas são normalizadas em UTC; horário desconhecido continua nulo. `received_at` é atribuído pela API. Nunca usar o horário do upload como substituto da aquisição.

Migrações são aplicadas uma vez e registradas em tabela de versão; não recriar tabelas nem apagar o histórico ao iniciar. Seed cadastra um gateway, dois nós e canais de teste alinhados aos perfis simulados. Seed deve ser idempotente e não reescrever credenciais ou regras existentes silenciosamente.

## 5. Conexões e transações

Para o MVP, usar handlers síncronos nas operações com `sqlite3` e abrir a conexão dentro da operação que a utiliza. Não manter uma conexão global compartilhada nem transferir uma conexão com afinidade de thread entre tarefas. Se houver evolução para acesso assíncrono, rever a estratégia explicitamente.

Cada unidade de trabalho faz abertura, commit/rollback e fechamento no mesmo fluxo. Ativar chaves estrangeiras em cada conexão, definir timeout de contenção e usar consultas parametrizadas. Considerar WAL na inicialização para favorecer leitura concorrente; ele não transforma SQLite em banco com vários escritores simultâneos. Usar inicialmente um processo Uvicorn e transações curtas.

Em um lote, validar registros individualmente, persistir os aceitos e confirmar somente depois do commit. Se ocorrer falha inesperada de banco, reverter a transação e retornar falha de serviço; não declarar registros aceitos que não foram gravados. Rejeições de domínio previstas não abortam necessariamente os outros registros válidos.

Não depender de commit depois que a resposta HTTP já foi enviada. O fechamento precisa ser explícito mesmo após exceção; a [documentação FastAPI sobre dependências e recursos](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/) explica o ciclo de dependências, caso esse mecanismo seja usado.

## 6. Ingestão passo a passo

1. Limitar o corpo da requisição, autenticar o gateway e validar o envelope.
2. Validar a identidade estrutural de cada item: nó, sessão, sequência e canal.
3. Conferir que gateway, nó, sensor, canal e perfil pertencem ao cadastro autorizado.
4. Validar resultado, qualidade e coerência dos horários.
5. Buscar a identidade da leitura. Conteúdo igual retorna `duplicate`; conteúdo de aquisição divergente retorna `conflict`.
6. Inserir leituras novas, preservando origem e horário desconhecido.
7. Nas etapas seguintes, avaliar apenas as leituras elegíveis ainda não processadas e persistir ocorrência/outbox na mesma transação.
8. Fazer commit e responder o status individual de cada item.

A definição de conteúdo igual inclui sessão, sequência, canal, perfil, resultado, qualidade, origem e campos de aquisição. Não incluir o horário de chegada do lote na comparação. Duplicação não incrementa contador de alerta nem gera nova notificação.

Para compatibilizar o contrato com o FastAPI: envelope inválido, item sem identidade estrutural ou lote fora do limite retorna 422 antes de processamento. Com identidades válidas, erros de resultado/perfil/cadastro são respostas individuais `rejected`. Evitar um modelo aninhado que transforme todo erro de valor em rejeição global do lote. Especificar e testar essa fronteira na primeira entrega.

## 7. Consultas e integração do frontend

Prioridade inicial: `/health`, `POST /api/v1/readings`, `GET /api/v1/readings`, `GET /api/v1/devices`, `GET /api/v1/profiles` e `GET /api/v1/devices/{node_id}/latest`.

As consultas terão filtros por nó, canal e período, paginação limitada e ordenação estável. Registros sem horário absoluto ficam consultáveis explicitamente. Perfil e unidade vêm do catálogo. Datas ISO na API são adaptadas para epoch/camelCase pelo cliente do Dev 2.

Não comparar `sequence` entre nós ou sessões distintas. Inicialmente, um canal com uma única sessão conhecida pode expor sua última leitura com qualidade de recência explícita. Para múltiplas sessões, implementar heartbeat e identificação da sessão atual; se não houver evidência suficiente, informar incerteza. Um upload atrasado não faz um nó parecer recém-medido.

Definir `freshness` com estados documentados antes de integrar: `fresh`, `stale`, `unknown` e `no_data`. O cálculo usa horário de aquisição confiável e janela configurada por canal; `unknown` não é sinônimo de offline. Comunicação do gateway é exibida separadamente. Resposta básica sugerida: `{status, measured_at, received_at, age_seconds}`, com idade nula quando não puder ser determinada.

CORS permite a origem exata do frontend. No celular, a URL da API usa o IP do notebook. No MVP de demonstração, consultas públicas na LAN só expõem dados próprios para demonstração; rotas de ingestão e operações internas exigem credencial. Não colocar um segredo de gateway no frontend para contornar isso.

## 8. Motor de alertas

Começar por uma regra numérica demonstrativa por canal. Configuração inicial no seed/ambiente; interface para editar regras será uma evolução.

Exemplo fictício: abrir ocorrência após três leituras válidas e consecutivas abaixo de 30; encerrar após três leituras válidas em 35 ou mais. Os números pertencem ao teste e não a uma recomendação agronômica. Valores na faixa intermediária mantêm a ocorrência ativa sem contar como recuperação.

Persistir contadores e última leitura avaliada. Erro de aquisição, lacuna maior que a janela configurada e troca de sessão reiniciam a contagem consecutiva; não significam recuperação automática. Ao retornar dado válido, aplicar a regra a partir do estado consistente. Evento ativo sobrevive ao reinício da API.

Registros atrasados entram no histórico, mas não retrocedem o estado atual. Processamento histórico exige rotina cronológica separada, fora da primeira entrega. Sem regra, o estado é não avaliado. Regras categóricas/booleanas podem ser acrescentadas depois; a API já armazena esses resultados desde o início.

## 9. Contrato interno com o bot

Rotas internas implementadas com token exclusivo de serviço, disponíveis para integração do Dev 2:

| Método | Rota | Papel |
| --- | --- | --- |
| POST | `/api/v1/internal/notifications/claim` | Reservar mensagens pendentes para um worker. |
| POST | `/api/v1/internal/notifications/{id}/delivered` | Confirmar envio com identificador da reserva e ID da mensagem Telegram. |
| POST | `/api/v1/internal/notifications/{id}/failed` | Registrar falha e agendar próxima tentativa. |

Reserva atômica com prazo, tamanho máximo de lote e token de reserva evita dois workers assumirem a mesma mensagem. Estados propostos: `pending`, `leased`, `sent`, `dead`. Expiração devolve o item à elegibilidade; confirmação precisa corresponder à reserva válida. Definir quantidade máxima de tentativas e atraso crescente em configuração.

O bot não grava diretamente no SQLite. Confirmar novamente uma entrega já registrada com os mesmos dados deve ser idempotente. Não é possível garantir entrega exatamente uma vez em uma falha entre o Telegram aceitar a mensagem e a API receber a confirmação; incluir ID da ocorrência para facilitar identificação.

Somente chats autorizados podem consultar os dados pelo bot. O link do painel local será um link HTTP comum com IP do notebook, não um Mini App HTTP. O token do Telegram não será uma configuração da API; pertence ao processo do bot.

## 10. Entregas em ordem

| Entrega | Resultado verificável | Dependência liberada |
| --- | --- | --- |
| 1 — Base executável | Configuração, migração, seed, `/health` e exemplos de requisição. | Colegas conseguem iniciar o serviço no notebook. |
| 2 — Ingestão e catálogo | Persistência, respostas individuais, duplicate/conflict e catálogo. | Dev 3 envia HTTP; Dev 2 interpreta perfis. |
| 3 — Consulta e sessões | Histórico paginado, nós/canais, últimas leituras e heartbeat. | Dashboard deixa de depender dos mocks. |
| 4 — Alertas | Transições e ocorrência persistidas, sem envio de rede durante ingestão. | Interface mostra alertas reais de teste. |
| 5 — Notificações | Outbox, reserva e confirmação testadas com falhas. | Bot entrega alertas e retenta sem bloquear a API. |
| 6 — Ensaio | Teste integrado com rede interrompida, reenvio e reinicialização. | Demonstração ponta a ponta. |

Cada entrega deve ter pull request pequeno, instrução de execução e teste. Não esperar concluir o motor de alertas para disponibilizar ingestão e consulta aos outros desenvolvedores.

## 11. Testes necessários

- Autenticação ausente/incorreta, gateway incompatível e nó não autorizado.
- Registro válido; reenvio idêntico; mesmo ID com valor diferente; dois nós com a mesma sequência; nova sessão com sequência reiniciada.
- Numérico zero, booleano falso, categoria inválida, booleano usado como número, valor não finito e erro de aquisição com resultado nulo.
- Lote misto, limite de itens/corpo e falha de banco sem confirmação indevida.
- Intervalo temporal, paginação, horário desconhecido e upload antigo sem substituir o estado atual.
- Abertura, manutenção e recuperação de alerta; duplicação, intervalo irregular e reinício preservando estado.
- Reserva concorrente, lease expirado, confirmação inválida, retentativa e indisponibilidade do Telegram sem afetar ingestão.

Usar banco temporário por teste e chamadas do bot substituídas por simulação nos testes da API. Separar testes de software de ensaios de rádio e sensor. A camada HTTP pode ser testada sem placas e sem internet externa depois de instalar as dependências.

## 12. Configuração e operação previstas

Configurações centralizadas: `DATABASE_PATH`, origens CORS, credenciais dos gateways, token interno do bot, janela de desatualização e limites de lote/retentativa. `.env.example` terá somente placeholders; o `.env` real, banco, WAL/SHM, logs e ambiente virtual ficam fora do Git.

Na primeira implementação, documentar criação da venv, instalação reprodutível, migração, seed e inicialização Uvicorn na porta 8000 com escuta na LAN. Usar reload durante desenvolvimento; evitar reinícios inesperados no ensaio. Não versionar dados reais ou segredos para facilitar a integração.

O ambiente virtual preparado pelo usuário contém FastAPI, Pydantic e Uvicorn; o conjunto verificado está em `backend/requirements.lock.txt`. Os testes do MVP usam unittest e ASGI, sem pytest/HTTPX adicional. O executor restringe portas locais; o ensaio TCP com Uvicorn foi realizado pelo usuário no terminal do notebook, com validação manual confirmada em 13/11/2026. Os limites concretos do motor (horário confiável, somente regras numéricas e sem reprocessamento retrospectivo) estão no roteiro final.
