# AgroSponge RS — frontend integrado

Primeira implementação do plano de frontend adaptável. Combina o acompanhamento do protótipo React com navegação para celular e computador, identidade AgroSponge e conteúdos da aplicação da equipe. Toda medição é explicitamente simulada. Sensores e critérios finais permanecem em definição.

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

O build verifica tipos e gera `dist/`. Não há publicação automática. O conteúdo compartilhado é importado de `../web/js/content.js`; execute o projeto dentro deste repositório para resolver essa dependência. O build incorpora os textos e constantes, sem requisitar arquivos da versão anterior em produção.

## Implementado

- Perfis versionados: sinal em %, temperatura com valores negativos, categorias e estado booleano. São exemplos de formato, não sensores escolhidos.
- Cartões, seleção de análise, gráfico numérico com eixo adaptável, distribuição categórica/booleana e tabela acessível.
- Períodos filtrados por timestamp, exportação CSV com identificação, unidade, origem, qualidade e horários.
- Mocks que acrescentam amostras sem recriar o histórico anterior durante a sessão.
- Cenários vazio, erro de aquisição, atualização remota atrasada e horário desconhecido. O último usa tabela por sequência, sem inventar posição no tempo.
- Avaliação sem regra por padrão, com regra numérica de teste opcional. Não há alerta persistente ou envio de notificação.
- Conteúdos originais da equipe: calculadora, selo, orientações e composição, identificados como demonstração sem validação nesta implementação.
- Links `?lote=verde|amarelo|vermelho` e hashes `#selo`, `#graficos`, `#usar`, `#receita` abrem a seção Projeto. Esses caminhos se aplicam à URL da nova interface; a publicação antiga não foi substituída.
- SDK Telegram opcional ao abrir no contexto WebApp. A navegação comum funciona sem ele. Compartilhamento remove parâmetros transitórios do Telegram.

## Organização

- `src/domain/`: tipos, perfis, seleção temporal, formatação, avaliação demonstrativa e CSV.
- `src/data/mock.ts`: aquisição simulada e cenários.
- `src/components/`: gráficos, tabela e conteúdos do projeto.
- `src/integrations/telegram.ts`: inicialização opcional do SDK.
- `src/App.tsx`: navegação e composição das seções.
- `src/style.css`: estilos responsivos, sem fontes ou imagens externas obrigatórias.

O mock usa uma única sessão por canal. O contrato final deverá acrescentar a identidade de inicialização (`boot_id`) e ordenação entre sessões antes de conectar a API. O catálogo é local nesta etapa. Falta implementar API, cache persistente, sincronização, ocorrências, dados físicos e painel embarcado da ESP32.

## Verificação inicial e próxima validação

A instalação neste ambiente falhou por DNS (`ENOTFOUND registry.npmjs.org`). O build e a checagem completa de tipos ainda não puderam rodar. A sintaxe TS/TSX foi conferida com Babel disponível no sistema; sete testes do domínio foram executados após transpilar esses módulos, cobrindo zero/false, tipos e versões incompatíveis, filtro temporal, reenvio fora de ordem, escala do gráfico, avaliação sem critério e CSV. Isso não substitui o build TypeScript nem a validação no navegador.

Após instalar as dependências, executar os comandos acima e conferir:

1. Alternar os quatro perfis, incluindo valores negativos, categorias e booleanos.
2. Exercitar os cinco cenários, atualização manual, pausa e atualização automática.
3. Conferir período, tabela, CSV e regra de teste opcional.
4. Abrir no celular e PC, testar teclado, zoom e largura de 360 px.
5. Abrir links antigos na nova origem e testar a integração dentro e fora do Telegram.
6. Verificar a seção Projeto e suas estimativas contra os parâmetros originais.

A aplicação da equipe em `../web/` e o dashboard anterior em `../dashboard/` continuam disponíveis. Para a visão geral, consultar o [plano](../docs/PLANO-FRONTEND-ADAPTAVEL.md) e o [relatório](../docs/RELATORIO-PROJETO.md).
