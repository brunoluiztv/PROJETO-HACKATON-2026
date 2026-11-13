# Teste manual — entrega 3

Esta entrega acrescenta histórico HTTP, dispositivos/canais, últimas leituras e heartbeat. Os alertas e a integração automática do frontend continuam para próximas etapas. As consultas da demonstração são públicas na LAN; ingestão e heartbeat exigem token do gateway.

## 1. Atualizar e iniciar

Na pasta `backend/`, com a venv ativa:

```bash
python -m app.manage init-db
python -m app.manage seed-demo
python -m app.manage inspect-db
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Se a API já estiver executando com reload, confira sua reinicialização em vez de abrir outro processo na mesma porta. Não precisa emitir outro token: a migração preserva o token, catálogo e leituras da entrega 2. O esquema do banco passa para **3**:

```json
{"status":"ok","database":"ok","schema_version":3}
```

O `schema_version` das mensagens JSON continua **1**. Ele versiona o contrato de comunicação, não as tabelas do banco.

## 2. Conferir dispositivos e catálogo

Abra:

- http://localhost:8000/api/v1/devices
- http://localhost:8000/api/v1/profiles

Dispositivos retorna `items` com um gateway (`role: "gateway"`) e dois nós (`role: "node"`), após o seed. Cada nó lista seus quatro canais e os perfis associados. Hashes e tokens não são expostos.

O estado de comunicação do gateway se refere às requisições autenticadas recebidas. O estado `radio_contact` dos nós depende de informação explícita no heartbeat, não de um lote antigo enviado à API.

## 3. Consultar o histórico

Abra http://localhost:8000/api/v1/readings. A resposta possui `items` e `next_cursor`.

Para o primeiro ponto e seu canal de sinal:

```text
http://localhost:8000/api/v1/readings?node_id=node-demo-01&channel_id=signal-01
```

Para as amostras sem horário absoluto:

```text
http://localhost:8000/api/v1/readings?time_quality=unknown
```

Os exemplos enviados na entrega 2 tinham `measured_at: null`, portanto devem aparecer nessa consulta. O recebimento pela API não transforma esse horário desconhecido em data de aquisição.

### Período e origem

Em http://localhost:8000/docs, execute `GET /api/v1/readings`. Os filtros disponíveis são:

| Parâmetro | Exemplo/semântica |
| --- | --- |
| `node_id` | `node-demo-01`. |
| `channel_id` | `signal-01`; sem nó, filtra o mesmo ID em todos os nós. |
| `source` | `simulation` ou `physical_sensor`. |
| `time_quality` | `unknown` ou `synchronized`. |
| `from` / `to` | Limites inclusivos em ISO 8601 com fuso, por exemplo `2026-11-13T00:00:00Z`. |
| `limit` | Padrão 100; entre 1 e 500. |
| `cursor` | Valor opaco retornado pela página anterior. |

Filtros por período só alcançam amostras com horário conhecido. `time_quality=unknown` junto de `from`/`to` retorna 422, evitando uma combinação sem significado. Um intervalo invertido ou horário sem fuso também retorna 422. Em URLs escritas à mão, codifique o sinal `+` de um fuso como `%2B`; o Swagger faz a codificação dos parâmetros.

Para testar período, envie uma leitura nova em `POST /api/v1/readings` com sequência livre, `measured_at` UTC conhecido e `time_quality: "synchronized"`, mantendo a origem como simulação. Use o período desse horário na consulta. Não apenas altere o horário de uma leitura já identificada: isso geraria `conflict` corretamente.

### Paginação

Use `limit=1` com pelo menos duas leituras disponíveis. Copie `next_cursor` para a próxima consulta, repetindo os mesmos filtros. Quando terminar, `next_cursor` será `null`.

A ordem é aquisição conhecida mais recente primeiro, com ID como desempate; registros de horário desconhecido vêm depois em ordem técnica de ID, sem alegar cronologia entre sessões. O cursor preserva um snapshot das inserções existentes no começo da navegação. Novas inserções só aparecem ao reiniciar a consulta sem cursor. Isso pressupõe o histórico append-only do MVP; não há endpoint de exclusão de leituras.

É possível mudar o tamanho da página, mas mudar os filtros com o mesmo cursor retorna 422. Cursor não é credencial de acesso.

## 4. Conferir últimas leituras por canal

Abra:

```text
http://localhost:8000/api/v1/devices/node-demo-01/latest
```

A resposta lista todos os canais, incluindo os que ainda não têm amostras. Para cada canal:

- `reading`: resultado e identidade completos, ou `null` quando não é possível selecionar uma leitura.
- `selection`: critério usado para selecionar a amostra.
- `freshness`: idade da aquisição e qualidade dessa informação.

| `freshness.status` | Significado |
| --- | --- |
| `fresh` | Aquisição conhecida com idade dentro do limite configurado. |
| `stale` | Aquisição conhecida mais antiga que esse limite. |
| `unknown` | Horário desconhecido, horário futuro ou sessões sem ordenação confiável. |
| `no_data` | Sem leituras elegíveis para o canal/sessão selecionada. |

O limite inicial é 300 segundos. `STALE_AFTER_SECONDS` permite alterar o padrão no ambiente; um canal pode ter `stale_after_seconds` próprio no banco. Isso avalia atualização, não a qualidade física do resultado. Uma amostra recente com `quality: "sensor_error"` continua sendo um erro de aquisição.

Dentro da mesma sessão, a maior sequência define a última aquisição. Um upload atrasado de sequência menor não a substitui. Sem sessão informada pelo gateway, múltiplas sessões só são comparadas quando suas últimas amostras têm horários confiáveis distintos. Empate ou incerteza retorna `selection: "ambiguous_sessions"`, `reading: null` e recência desconhecida.

Se o gateway informou a sessão atual, a API seleciona apenas amostras dessa sessão. Se ainda não há amostra nela, informa `no_data`, mesmo que existam registros de sessões anteriores no histórico.

## 5. Testar heartbeat

Em `/docs`, autorize o mesmo `GatewayToken` da entrega 2. Execute:

```text
POST /api/v1/gateways/gateway-demo-01/heartbeat
```

O exemplo completo está no Swagger e em [examples/heartbeat.json](examples/heartbeat.json):

```json
{
  "schema_version": 1,
  "gateway_boot_id": "gateway-boot-demo-001",
  "gateway_boot_count": 0,
  "sequence": 1,
  "nodes": [
    {
      "node_id": "node-demo-01",
      "node_boot_id": "boot-demo-001",
      "node_boot_count": 0,
      "last_radio_age_ms": 1000
    }
  ]
}
```

Use no `node_boot_id` a sessão das suas leituras, quando estiver testando a seleção da sessão. Se já enviou outros heartbeats, confira os contadores em `/devices` e avance a sequência da sessão atual em vez de reutilizar uma identidade com outro conteúdo.

No primeiro envio, espere `status: "accepted"`. Depois confira `/devices` e `/devices/node-demo-01/latest`. O heartbeat não insere medições: ele informa comunicação e sessões.

Repita exatamente o corpo: `duplicate`. A API reconhece nova comunicação HTTP do gateway, mas não renova o último contato de rádio do nó nem a data das medições. Reutilizar a mesma identidade de heartbeat com conteúdo diferente retorna 409. Relatórios antigos retornam `ignored`, sem retroceder o estado atual.

### Contrato para o Dev 3

- `gateway_boot_count` e `node_boot_count` são contadores persistidos, incrementados a cada inicialização, independentemente de `sequence`.
- `gateway_boot_id` e `node_boot_id` identificam de forma única essas inicializações. Não podem ser reutilizados sob outro contador.
- `sequence` do heartbeat aumenta dentro da inicialização do gateway; não é a sequência de aquisição do nó.
- O gateway monta o heartbeat com seu estado atual. Não colocar heartbeats na fila de histórico nem derivar a sessão atual de pacotes antigos que estão sendo reenviados.
- `last_radio_age_ms` é a idade do último contato de rádio conhecida no instante do envio; pode ser `null` se desconhecida. A API estima o horário como recepção menos essa idade. A latência de transporte não é conhecida, portanto o campo é marcado como estimado e não é horário de medição.
- Nós omitidos de um heartbeat mantêm seu último estado, que envelhece. O gateway ativo não implica que todos os nós estejam ativos.
- Um novo contador do gateway admite reiniciar sua sequência; relatórios de inicializações anteriores não substituem o estado atual. Um novo heartbeat pode conter um relatório antigo de nó: esse item é ignorado.
- Um nó não autorizado causa 403; conflito de associação contador/boot_id causa 409 e reverte o relatório inteiro.
- Se perder os contadores persistidos numa restauração de fábrica, revisar o cadastro de sessões de forma administrada. A API não aceita automaticamente um contador menor para apagar o histórico de ordenação.

Essa extensão de heartbeat ainda precisa ser incorporada ao firmware; os sketches existentes não são alterados pela implementação da API.

## Aceite antes da entrega 4

Confirmar histórico filtrado, paginação, nós/canais, últimas leituras e heartbeat com o token já existente. Verificar que dados antigos continuam disponíveis e que horário desconhecido não vira leitura recente. A integração visual do frontend pode usar essas rotas; ainda não foi conectada automaticamente nesta entrega.
