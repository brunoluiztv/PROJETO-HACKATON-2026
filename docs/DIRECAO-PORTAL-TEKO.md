# Direção do portal tekó biotech — reunião de 13/11/2026

## Produto

O webapp é um portal mobile first para o agricultor acompanhar lavouras e pontos de monitoramento. A versão atual em `frontend/` reúne triagem, simulação e consulta à API. A proposta antiga do saco de gel em `legacy/web/` e no bot não faz parte do produto atual.

## Navegação recomendada para o MVP

1. **Visão geral:** área, pontos, última atualização, ocorrências e diferença entre comunicação atrasada e desativação intencional.
2. **Histórico:** seleção de nó/canal, gráfico com nome da grandeza, unidade, origem e tabela de leituras.
3. **Alertas:** ocorrências persistidas e estado técnico do ponto, com horários de aquisição e recebimento.
4. **Lavoura:** triagem completa em uma página; simulação de estiagem, alagamento/pós-enchente e vendaval; receita/funcionamento em página própria.

O pote de barro e a água devem ser explicados separadamente da célula microbiana. A composição e os passos de montagem permanecem pendentes de definição técnica. Nenhuma leitura genérica em `%` deve ser chamada de nível de água ou estado do caule sem um perfil de medição que sustente esse significado.

## Contrato de dados e lacunas

| Necessidade do portal | Estado atual | Próxima decisão |
| --- | --- | --- |
| Lista de pontos e comunicação | `GET /api/v1/devices` informa nós e contato por rádio | Aceitar no celular com dados físicos |
| Última leitura, recência e histórico | Endpoints de últimas leituras e histórico estão disponíveis | Definir perfis dos sensores reais e nomes claros |
| Ponto desativado | Não há campo explícito de desativação no contrato atual | Acrescentar estado administrativo, horário e motivo; não inferir de `stale` |
| Alertas de manutenção do gateway | API expõe ocorrências, mas o painel embarcado e suas regras técnicas são trabalho próprio | Definir eventos para sensor com falha, falta de envio, gateway sem contato e recuperação |
| Triagem da lavoura | Solo, cultura e irrigação ficam somente no navegador | Definir se a API persistirá esses dados por área e quem pode editá-los |
| Economia | A interface calcula um valor ilustrativo a partir de litros e R$/m³ informados | Definir método validado, origem do volume e referência monetária |
| Vendaval | Cenário informativo/manual no frontend | Definir sensor ou fonte meteorológica e critérios antes de alerta automático |
| Bot Tekó | Código atual ainda descreve a proposta antiga | Redesenhar comandos e mensagens antes de configurar o nome no Telegram |

## Demonstração de cinco minutos

Uma pessoa pode apresentar o fluxo: preencher triagem, mostrar a simulação de alagamento com litros e custo de referência, abrir um ponto e explicar o gráfico, depois mostrar a diferença entre ocorrência, comunicação atrasada e desativação. Treinar no celular e no notebook; deixar explícito quais dados são simulação e quais vieram da API.
