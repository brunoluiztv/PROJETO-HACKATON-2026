# Resumo do chat de desenvolvimento (Antigravity)

Registro da implementação anterior. O site citado como `web/` está preservado em `legacy/web/`; o portal atual fica em [frontend/](../frontend/README.md). Consulte a [organização atual](ORGANIZACAO-REPOSITORIO.md).

Data: 12/11/2026. Este arquivo registra o que foi pedido e decidido na conversa com o Antigravity, para dar continuidade ao projeto neste repositório.

## Pedido
Clonar este repositório, aplicar a lógica do bot do Telegram (`agrosponge_telegram_bot.py`), criar um site acessível com foco mobile e uma extensão de acessibilidade, seguindo boas práticas de UX e frontend.

## Ponto de partida
O repositório só tinha o `README.md`. O site `agrosponge_rs_mvp-v3.html`, citado no bot, não existia, então foi recriado do zero.

## Decisões
- Site em HTML/CSS/JS puro (sem build), PWA, mobile-first.
- Extensão de navegador Manifest V3, só no domínio do site.
- Bot refatorado em módulos (`conteudo`, `classificador`, `roteamento`), com a lógica original preservada.
- Correções no bot: foto ambígua não vira "verde" (pede confirmação); roteamento de texto não confunde mais dígitos soltos (`"1" in txt`); mensagens sem texto (sticker, vídeo) não quebram.
- Contratos entre bot e site: `?lote=verde|amarelo|vermelho` e `#graficos`.
- Token do bot só por variável de ambiente (`.env`, ignorado pelo Git).

## Estrutura
`bot/`, `web/`, `extension/`, `docs/`. Veja o [README](../README.md).

## Pendências (para o time)
1. Publicar `web/` em HTTPS (Netlify/GitHub Pages) e atualizar `WEBAPP_URL`, e `host_permissions` da extensão se o domínio mudar.
2. Criar o bot no @BotFather e rodar com o token.
3. Calibrar o classificador de cor com fotos reais dos selos do biossensor (limiares em `bot/classificador.py`).
4. Validar os números (13 L/saco, ~58 L/dia de consumo da lavoura, R$ 5,80) com o time técnico.
5. Testar a extensão com leitores de tela e com usuários reais.
6. Substituir o ícone provisório pela identidade visual do hackathon.

## Como continuar no Antigravity
Abra esta pasta como workspace (Arquivo → Abrir pasta) e continue a conversa a partir daqui.
