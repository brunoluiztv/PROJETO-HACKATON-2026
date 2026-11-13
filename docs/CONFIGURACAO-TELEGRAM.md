# Guia Prático: Configuração do Bot Tekó (Tekó Biotech) no Telegram

Este manual explica como deixar o **Bot Tekó (Tekó Biotech)** totalmente personalizado no Telegram com a identidade oficial do **Hackathon das Engenharias UERGS 2026**.

---

## 🛠️ Passo a Passo Rápido (3 Minutos)

### 1. Criar o Bot no @BotFather
1. No Telegram, pesquise por `@BotFather` e clique em **Começar / Start**.
2. Envie o comando:
   ```text
   /newbot
   ```
3. Escolha um nome amigável para o bot (ex: `Tekó — Biossensor Sentinela`).
4. Escolha um nome de usuário que termine em `bot` (ex: `phytosense_rs_bot`).
5. O @BotFather enviará o seu **TOKEN HTTP API** (algo como `7123456789:AAH...`).
6. Copie esse token.

---

### 2. Adicionar o Token no Projeto Local
Abra o arquivo `bot/.env` (ou crie a partir do `bot/.env.example`) e cole:
```bash
TELEGRAM_TOKEN=seu_token_copiado_aqui
WEBAPP_URL=https://brunoluiztv.github.io/PROJETO-HACKATON-2026/
```

---

### 3. Configurar Comandos, Bio e Menu Automaticamente ⚡
Basta rodar o script de automação:
```bash
cd bot
python setup_telegram_bot.py
```
O script chama a Bot API do Telegram e configura instantaneamente:
- ✅ Comandos: `/start`, `/painel`, `/planta`, `/irrigar`, `/chuva`, `/energia`, `/laudo`, `/ajuda`.
- ✅ Tela inicial de boas-vindas com a apresentação da Tekó Biotech e Hackathon UERGS 2026.
- ✅ Descrição curta (Bio) do perfil.
- ✅ **Botão Menu WebApp**: configura o botão fixo no canto inferior esquerdo do chat para abrir o Mini App em tela cheia com um clique.

---

### 4. Definir a Foto de Perfil (Avatar Oficial)
1. No chat com o `@BotFather`, envie:
   ```text
   /setuserpic
   ```
2. Selecione o bot que você acabou de criar.
3. Envie o arquivo de imagem preparado com a arte oficial do Hackathon:
   📁 `bot/assets/bot_avatar_hackathon.png`

---

### 5. Criar um Telegram Mini App (/newapp)
Para que o bot tenha um link direto estilo `t.me/seu_bot/app`:
1. No `@BotFather`, digite:
   ```text
   /newapp
   ```
2. Escolha o seu bot.
3. Digite o título: `Tekó Biotech`
4. Digite a descrição: `Biossensor in-planta, gestão de enchentes e laudos PROAGRO`
5. Envie a foto de capa (envie `assets/social-preview.png`).
6. Quando pedir a **Web App URL**, envie exatamente:
   ```text
   https://brunoluiztv.github.io/PROJETO-HACKATON-2026/
   ```
7. Escolha um nome curto para a URL (ex: `painel` ou `app`).
8. Pronto! Seu Mini App terá um link público `t.me/<seu_bot>/painel`.

---

## ☁️ Hospedagem 24/7 na Railway

O projeto já inclui `bot/Dockerfile` e `bot/railway.json` prontos para deploy contínuo na Railway:
1. Com o Railway CLI instalado, execute na pasta do projeto:
   ```bash
   railway up
   ```
2. No painel da Railway, configure a variável de ambiente:
   - `TELEGRAM_TOKEN`: seu token do BotFather
   - `WEBAPP_URL`: `https://brunoluiztv.github.io/PROJETO-HACKATON-2026/`
3. O bot reiniciará automaticamente e ficará ativo 24 horas por dia.
