---
name: teko-rural-accessibility-ux
description: Diretrizes de acessibilidade rural, ergonomia visual e usabilidade zero digitação para agricultores familiares gaúchos (WCAG 2.2 AA). Usar sempre que alterar componentes de interface, layouts mobile, temas de alto contraste (Dark Mode / Light Mode rural), botões do Telegram Bot ou rotinas de síntese de voz (TTS).
category: accessibility-ux
risk: safe
tools:
  - web
  - node
  - bash
platforms:
  - antigravity
  - claude
  - codex
  - cursor
  - gemini
license: MIT
author: Teko Biotech Team
---

# 🚜 Tekó Rural Accessibility & UX: Zero Digitação no Campo

Este playbook estabelece os padrões ergonômicos e de acessibilidade inclusiva do projeto **Tekó Biotech**, desenhados especificamente para atender pequenos agricultores sob condições de campo no Rio Grande do Sul (mãos na lida, terra, reflexo solar direto, smartphones populares e baixa conectividade).

---

## 📌 When to Use (Quando Acionar)

Carregue e aplique esta skill quando:
- Desenvolver ou ajustar componentes web no WebApp / Telegram Mini App (`web/index.html`, `web/css/styles.css`, `web/js/`).
- Criar novos fluxos de conversação no Bot do Telegram (`bot/phytosense_bot.py`, `bot/conteudo.py`).
- Implementar ou recalibrar temas visuais (Modo Escuro com bordas nítidas e Modo Claro para luz solar direta).
- Auditar conformidade com a norma internacional **WCAG 2.2 Nível AA**.
- Desenvolver recursos de leitura de tela e narração por voz (Web Speech API).

---

## 🌾 Core Workflow & Princípios de Design

### 1. Paradigma "Zero Digitação"
* O produtor rural não deve ser forçado a digitar números ou palavras no teclado do celular.
* **No Telegram:** Uso exclusivo de botões fixos de resposta rápida (`ReplyKeyboardMarkup` com `resize_keyboard=True`) e botões inline com ícones expressivos (`🌱`, `💧`, `🌧️`, `🔋`, `🚜`).
* **No WebApp:** Seletores segmentados de toque único, dropdowns com regiões pré-configuradas e inputs pré-preenchidos com valores de referência do IBGE e Embrapa.

### 2. Ergonomia Tátil Mobile (Alvos de Toque $\ge 48\text{px}$)
* Todo botão, aba e seletor deve ter área útil de toque de no mínimo **$48 \times 48\text{ pixels}$** com margens de separação ($\ge 8\text{px}$) para evitar toques acidentais por dedos sujos de terra ou molhados.
* Classes de interação: `min-height: 48px; touch-action: manipulation;`.

### 3. Sistema Dual de Alto Contraste

#### A. Modo Escuro (Foco em Profundidade com Bordas Nítidas)
* Projetado para economia de bateria em telas OLED e conforto visual em ambientes sombreados ou no galpão.
* **Cores Chave:**
  * Fundo principal: `#09090b` (preto profundo).
  * Cartões e contêineres: `#141416` (superfície grafite com elevação sutil).
  * Bordas e contornos: `#3f3f46` (cinza grafite nítido, eliminando blocos sem definição).
  * Destaques de ação: Laranja da marca `#ff6b00` e verde esmeralda `#10b981`.

#### B. Modo Claro (Daylight Rural para Luz Solar Direta)
* Projetado para visibilidade sob sol escaldante no canteiro da lavoura, onde telas reflexivas perdem contraste.
* **Cores Chave:**
  * Fundo principal: `#f4f4f5` (cinza claro suave anti-ofuscamento).
  * Cartões: `#ffffff` com contornos bem definidos em `#d4d4d8`.
  * Tipografia principal: `#09090b` (preto de alto contraste, contraste $\ge 12:1$ WCAG AAA).
  * Subtítulos e dados secundários: `#475569` / `#52525b`.

### 4. Narração por Voz Nativa Coloquial (Web Speech API)
* Síntese de voz executada no dispositivo do produtor (`window.speechSynthesis`).
* Linguagem empática, acolhedora e direta, utilizando termos gaúchos respeitosos (*"Buenas!", "lavoura", "lida", "talhão"*).
* Botão acessível no topo (`#btn-ouvir-planta`) com `aria-pressed` e controle de pausa.

---

## 🚫 Rules & Anti-Patterns (Regras Invioláveis)

> [!CAUTION]
> 1. **NUNCA usar alvos de toque menores que 48px:** Nenhum botão interativo pode ter dimensão inferior a 48px.
> 2. **NUNCA usar fontes minúsculas:** O tamanho de texto para diagnósticos e alertas principais deve ser $\ge 16\text{px}$.
> 3. **NUNCA usar jargões técnicos herméticos:** O agricultor não precisa ler *"impedância bioelétrica em 4.800 Ohms"*; a mensagem prioritária deve ser *"Alerta de Sede: ligar o gotejamento amanhã às 6h por 40 minutos"*.
> 4. **NUNCA depender de cores como único canal informativo:** Todo indicador semafórico (verde, amarelo, vermelho) deve vir acompanhado de ícone textual explícito (`🟢`, `🟡`, `🔴`, `🚨`) e texto em negrito para produtores daltônicos.

---

## ✅ Verification & Quality Gates

1. Testes de sintaxe: `node --check web/js/app.js` deve rodar sem erros.
2. Contraste de cores: Razão de contraste mínima de $4,5:1$ para textos normais e $3:1$ para botões grandes.
3. Compatibilidade com leitores de tela: Regiões de anúncio dinâmico (`#sr-anuncios`) com `role="status"` e `aria-live="polite"`.
