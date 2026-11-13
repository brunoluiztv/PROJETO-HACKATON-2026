# Campo Vivo — dashboard histórico

O portal atual fica em [frontend/](../../frontend/README.md). Este diretório preserva o primeiro protótipo.

Dashboard público em React, TypeScript e Vite. Não há login ou autenticação. Todos os dados são fictícios e gerados no navegador; nenhuma API, placa ou bot está conectado nesta etapa.

## Organização do repositório

Este dashboard está dentro do [repositório da equipe](../../README.md). Ele permanece como protótipo demonstrativo e ainda não foi integrado funcionalmente à aplicação `legacy/web/`. O [relatório consolidado](../../docs/RELATORIO-PROJETO.md) registra a arquitetura atual e as pendências.

Os sensores e grandezas continuam em definição. Referências a umidade, índice percentual, imunossensor e limiar de 30% descrevem apenas a simulação inicial. O cenário “sem sinal” não implementa armazenamento offline nem sincronização com a ESP32.

## Executar

Com Node.js e npm instalados, a partir da raiz do repositório da equipe:

```bash
cd legacy/dashboard
npm install
npm run dev
```

Abra o endereço informado pelo Vite. Para testar no celular, use o IP do computador na mesma rede e a porta informada pelo servidor. O navegador precisa alcançar esse computador.

## Build

```bash
npm run build
npm run preview
```

O build executa a verificação de tipos e gera `dist/`, que pode ser publicada em uma hospedagem estática pública. Depois de publicar, o bot poderá enviar essa URL diretamente, sem etapa de login.

## Funcionalidades

- Resumo do sinal, situação da área e média do período.
- Gráfico de 1, 6 ou 24 horas, com consulta por ponteiro e exportação CSV.
- Atualização automática a cada 10 segundos, com opção de pausar e atualização manual.
- Cenários normal, atenção e dispositivo sem sinal.
- Histórico demonstrativo de alertas e informações da unidade ESP32.
- Botão para copiar o link e layout adaptado ao celular.

O cenário sem sinal exibe uma leitura de 12 minutos atrás e interrompe as atualizações. O cenário de atenção usa um sinal abaixo do limiar demonstrativo de 30%. O histórico é recriado na memória; não há persistência. As mudanças de cenário são locais a cada visitante.

## Arquivos principais

- `src/main.tsx`: componentes e interações do dashboard.
- `src/mock.ts`: modelo da leitura, dados fictícios, formatação e exportação CSV.
- `src/style.css`: estilos responsivos.
- `.openai/hosting.json`: identificação do site e configuração de hospedagem estática.

Na integração com a API, substituir `createReadings` pela consulta de medições e mapear `recorded_at`, `signal_percent` e `raw_adc` para `time`, `value` e `raw`. Os controles de cenário são exclusivos da demonstração. O cálculo real de alertas deverá vir da API.

## Verificação nesta implementação

Sintaxe TSX/TypeScript, sintaxe CSS e cenários dos dados simulados verificados localmente. A instalação de dependências e o envio do código para hospedagem foram bloqueados por falhas de resolução de DNS neste ambiente. O build completo e a verificação visual no navegador ainda precisam ser executados em um ambiente com acesso ao npm. Não existe publicação concluída desta versão.
