# tekó biotech — portal de monitoramento

Webapp mobile first para acompanhar nós e canais da API, com modo de demonstração separado. Os dados da demonstração são simulados; o modo API mostra a origem de cada leitura recebida. Sensores e critérios finais permanecem em definição.

Para conectar vários nós à API no notebook, seguir o [contrato v1](../docs/CONTRATO-API-V1.md) e o [plano da equipe](../docs/PLANO-EQUIPE-MVP.md). A seleção de nó/canal, a sessão informada e a recência vêm da API. O mock continua com uma sessão por canal para demonstração.

As consultas de histórico, nós/canais, últimas leituras, catálogo e ocorrências estão conectadas no modo API. O [roteiro de integração](../backend/TESTE-MANUAL-ENTREGA-3.md) detalha filtros, paginação e estados de recência. A interface nunca troca para dados simulados quando a API falha.

## Executar

Com Node.js compatível com Vite 6 e npm:

```bash
cd frontend
npm install
npm run dev
```

Abra o endereço que o Vite informar, normalmente http://localhost:5173. Se a porta estiver ocupada, ele pode escolher outra. No celular na mesma rede, use o IP do computador e a porta informada; o servidor já escuta em `0.0.0.0`.

```bash
npm run build
npm test
npm run preview
```

O build verifica tipos e gera `dist/`. Não há publicação automática. Esta interface não usa a antiga receita do saco de gel. A aplicação em `../legacy/web/` é um protótipo histórico separado e não deve ser apresentada como a solução atual.

## Conectar à API

Inicie a API conforme [backend/README.md](../backend/README.md) e abra o frontend. Toque em **Conectar API**. No notebook, use `http://localhost:8000`; no celular na mesma rede, use `http://IP_DO_NOTEBOOK:8000` no campo de conexão. O navegador guarda o endereço escolhido e o modo entre visitas. Se preferir, defina `VITE_API_BASE_URL` antes de iniciar o Vite ou gerar o build; nesse caso, o modo API abre primeiro. Uma página publicada em HTTPS precisa acessar uma API HTTPS.

Para abrir pelo celular, o backend deve permitir a origem exata do frontend em `CORS_ORIGINS`, por exemplo `http://IP_DO_NOTEBOOK:5173`. O Vite já escuta em `0.0.0.0`. O painel consulta dispositivos, perfis, última leitura, histórico e ocorrências sem token; somente a ingestão requer a credencial do gateway. Os links compartilhados incluem nó e canal selecionados. O histórico carrega 500 registros por página e oferece **Carregar mais leituras**; a consulta de horários desconhecidos mostra até 100 registros recentes.

## Implementado

- Perfis versionados: sinal em %, temperatura com valores negativos, categorias e estado booleano. São exemplos de formato, não sensores escolhidos.
- Cartões, seleção de análise, gráfico numérico com eixo adaptável, distribuição categórica/booleana e tabela acessível.
- Períodos filtrados por timestamp, exportação CSV com identificação, unidade, origem, qualidade e horários.
- Mocks que acrescentam amostras sem recriar o histórico anterior durante a sessão; modo API com seleção de área/nó/canal e atualização periódica.
- Cenários vazio, erro de aquisição, atualização remota atrasada e horário desconhecido. O último usa tabela por sequência, sem inventar posição no tempo.
- Avaliação sem regra por padrão no modo de demonstração, com regra numérica de teste opcional. O modo API consulta ocorrências persistidas, quando disponíveis; o envio de notificação pertence ao backend e ao bot.
- Seção Lavoura com triagem em página única (área, solo, cultura e irrigação), simulação de estiagem, alagamento/pós-enchente e vendaval, além de explicações separadas para pote e célula microbiana.
- Indicadores ilustrativos de litros e valor equivalente estimado usam entradas explícitas do usuário. O percentual de água no pote é apenas um controle da simulação; nenhuma dessas entradas é medição do sensor.
- Links antigos `?lote=...` e hashes `#selo`, `#graficos`, `#usar`, `#receita` abrem a seção correspondente sem apresentar o laudo antigo.
- SDK Telegram opcional ao abrir no contexto WebApp. A navegação comum funciona sem ele. Compartilhamento remove parâmetros transitórios do Telegram.

## Organização

- `src/domain/`: tipos, perfis, seleção temporal, formatação, avaliação demonstrativa e CSV.
- `src/data/mock.ts` e `src/data/api.ts`: simulação e adaptação do contrato HTTP.
- `src/components/`: gráficos, tabela e conteúdos do projeto.
- `src/integrations/telegram.ts`: inicialização opcional do SDK.
- `src/App.tsx`: navegação e composição das seções.
- `src/style.css`: estilos responsivos, sem fontes ou imagens externas obrigatórias.

O mock usa uma única sessão por canal. No modo API, a escolha da última leitura entre sessões é feita pelo backend; o CSV inclui `node_boot_id` e `channel_id`. A triagem fica apenas no navegador e ainda não está conectada a uma área da API. O backend ainda não informa desativação intencional de um ponto; a interface diferencia esse campo ausente dos estados de comunicação. A interface ainda não tem cache persistente. A sincronização de hardware, a calibração, a receita da nova solução e o painel embarcado da ESP32 são etapas próprias.

## Verificação

`npm run build` e `npm test` passaram em 13/11/2026. Os testes cobrem domínio e conversão das respostas do contrato da API. Ainda falta um ensaio visual em navegador no celular e no PC, e um ensaio ponta a ponta com o backend executando no notebook.

No ensaio integrado, conferir:

1. Alternar os quatro perfis, incluindo valores negativos, categorias e booleanos.
2. Exercitar os cinco cenários, atualização manual, pausa e atualização automática.
3. Conferir período, tabela, CSV e regra de teste opcional.
4. Abrir no celular e PC, testar teclado, zoom e largura de 360 px.
5. Abrir links antigos na nova origem e testar a integração dentro e fora do Telegram.
6. Conectar a API, alternar entre nós/canais e conferir sessão, recência, paginação, ocorrências e falha de rede sem troca automática para simulação.
7. Preencher a triagem, alternar os três cenários, conferir o cálculo ilustrativo e verificar a distinção entre dados simulados, leituras físicas, falta de comunicação e desativação informada.

A aplicação da equipe em `../legacy/web/` e o dashboard anterior em `../legacy/dashboard/` continuam disponíveis. Para a visão geral, consultar o [plano](../docs/PLANO-FRONTEND-ADAPTAVEL.md) e o [relatório](../docs/RELATORIO-PROJETO.md).
