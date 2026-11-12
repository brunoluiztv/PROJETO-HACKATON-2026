# PROJETO-HACKATON-2026 — AgroSponge RS

Projeto do biossensor (Hackathon das Engenharias UERGS): ajuda a agricultura familiar a **guardar água limpa para a seca** e a saber, pela cor do selo do saco, onde usar essa água.

| Parte | Pasta | O que é |
|---|---|---|
| Bot do Telegram | [`bot/`](bot) | Menu de botões grandes, leitura da cor do selo por foto, laudo verde/amarelo/vermelho, FAQ e receita |
| Site / PWA | [`web/`](web) | Site mobile-first que o bot abre (`?lote=cor`, `#graficos`). Funciona offline |
| Extensão de acessibilidade | [`extension/`](extension) | Chrome/Edge (Manifest V3): texto maior, contraste, dislexia, leitura em voz alta |
| Documentação | [`docs/`](docs) | Resumo do chat de desenvolvimento e boas práticas de UX/acessibilidade |

## Como rodar

### Site
```bash
cd web
python -m http.server 8080      # abre http://localhost:8080
```
Para o Telegram abrir o site é preciso **HTTPS**: publique a pasta `web/` no Netlify ou GitHub Pages e use a URL em `WEBAPP_URL`.

### Bot
```bash
cd bot
python -m venv .venv && .venv\Scripts\activate     # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env      # preencha TELEGRAM_TOKEN (crie no @BotFather) e WEBAPP_URL
python agrosponge_telegram_bot.py
```
Testes: `python -m pytest -q`. **Nunca** versione o `.env` ou o token.

### Extensão
1. Abra `chrome://extensions` (ou `edge://extensions`) e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `extension/`.
3. Se o seu site tiver outro domínio, ajuste `host_permissions` e `matches` em `extension/manifest.json`.
4. Abra o site e use o ícone da extensão (ou `Alt+A`).

## Decisão de segurança no bot
Se a foto do selo não for claramente verde, amarela ou vermelha, o bot **não chuta**: pede que a pessoa toque na cor que está vendo. (No primeiro rascunho, foto ambígua virava "verde, pode usar na horta".)
