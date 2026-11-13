# Teste manual — entrega 2

Registro da fase anterior: na versão atual, o banco já utiliza esquema 3. Para validar as novas rotas sem perder os dados existentes, siga o [roteiro da entrega 3](TESTE-MANUAL-ENTREGA-3.md).

Objetivo: confirmar ingestão, autenticação, persistência, reenvio e conflito. Histórico via GET e alertas ficam para próximas entregas.

## 1. Atualizar o banco sem apagar dados

No terminal, a partir da raiz do repositório:

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m app.manage init-db
python -m app.manage seed-demo
python -m app.manage inspect-db
```

O esquema agora é versão **2**. A migração preserva o catálogo e acrescenta credencial de gateway e tabela `readings`. Um banco novo terá 1 gateway, 2 nós, 4 perfis, 8 canais e zero leituras. Se já houver dados, a contagem não será necessariamente zero.

Não copie `.env.example` sobre seu `.env` existente. Não é necessário mudar seu caminho de banco.

## 2. Gerar credencial do gateway

```bash
python -m app.manage issue-token gateway-demo-01
```

Guarde o valor de `token` mostrado no terminal. Ele não é o token do Telegram. O banco armazena somente seu hash; não há token padrão no código. **Executar novamente esse comando invalida o token anterior.** Não envie o valor pelo GitHub ou em capturas compartilhadas.

## 3. Iniciar o servidor

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Se o servidor já está rodando com reload, confira se reiniciou sem erros e se `/health` retorna:

```json
{"status":"ok","database":"ok","schema_version":2}
```

## 4. Enviar pela documentação interativa

Abra http://localhost:8000/docs.

1. Clique em **Authorize**, no esquema `GatewayToken`, e cole apenas o token gerado.
2. Abra **POST /api/v1/readings** e clique em **Try it out**.
3. Use o exemplo completo já exibido no corpo. Ele também está em [examples/readings-batch.json](examples/readings-batch.json).
4. Clique em **Execute**.

Na primeira gravação desse exemplo, espere HTTP **200** com um resultado `accepted` e `reading_id`. Se já enviou exatamente o exemplo antes, o resultado pode ser `duplicate`.

```json
{
  "schema_version": 1,
  "gateway_id": "gateway-demo-01",
  "results": [
    {
      "node_id": "node-demo-01",
      "node_boot_id": "boot-demo-001",
      "sequence": 42,
      "channel_id": "signal-01",
      "status": "accepted",
      "reading_id": "identificador-gerado-pela-api"
    }
  ]
}
```

O HTTP 200 indica que o lote foi processado. Para saber o resultado de cada leitura, veja seu `status` em `results`.

## 5. Reenvio e conflito

- Execute novamente o mesmo corpo: espere `duplicate`, com o mesmo `reading_id`.
- Altere apenas `result.value`, conservando nó, sessão, sequência e canal: espere `conflict`. A leitura anterior não deve ser sobrescrita.
- Para uma nova leitura legítima, aumente `sequence`: espere `accepted`.
- Use um novo `node_boot_id` para representar uma nova inicialização. Reiniciar a sequência nessa nova sessão não causa colisão com a anterior.

Em outro terminal, com a venv ativa e dentro de `backend/`:

```bash
python -m app.manage inspect-db
```

O campo `readings` deve aumentar somente para registros novos aceitos. Reenvios e conflitos não aumentam o total.

## 6. Credencial e conteúdo inválidos

| Tentativa | Resultado esperado |
| --- | --- |
| Sem token ou token inválido | HTTP 401. |
| Token válido, `gateway_id` do corpo diferente | HTTP 403. |
| Envelope inválido, sequência booleana ou mais de 32 itens | HTTP 422; nenhum registro desse lote é gravado. |
| Corpo maior que 32 KiB, mesmo sem Content-Length confiável | HTTP 413. |
| Identidade válida, mas nó/canal não autorizado | HTTP 200 com item `rejected`. |
| Identidade válida, mas valor/tipo/perfil incorreto | HTTP 200 com item `rejected` e código de erro. |
| Mesmo ID com conteúdo de aquisição diferente | HTTP 200 com item `conflict`. |
| Banco indisponível | HTTP 503, sem confirmação parcial de gravação. |

Em um lote estruturalmente válido com várias leituras, um item rejeitado por resultado/perfil não impede os demais válidos de serem aceitos. Zero e falso são resultados válidos; erro de sensor utiliza `quality: "sensor_error"` e `result: null`.

## 7. Catálogo de perfis

Abra http://localhost:8000/api/v1/profiles. Após o seed, a resposta contém `items` com os quatro perfis demonstrativos, incluindo tipo, unidade ou categorias. Esta consulta da demonstração não exige o token de ingestão.

## Alternativa pelo terminal

Em um segundo terminal na pasta `backend/`, leia o token sem deixá-lo literalmente no histórico do shell:

```bash
read -r -s -p "Cole o token e pressione Enter: " GATEWAY_TOKEN
```

Envie o arquivo:

```bash
curl -i http://localhost:8000/api/v1/readings \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @examples/readings-batch.json
```

Repita o envio para conferir `duplicate`. Não confunda recarregar uma página GET no navegador com executar esse POST autenticado.

## Aceite antes da entrega 3

Confirmar `accepted → duplicate → conflict`, contagem persistida, credencial exigida e catálogo acessível. Só então avançar para consulta HTTP do histórico, listagem dos nós e últimas leituras por canal.
