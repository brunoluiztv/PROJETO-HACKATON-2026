# UX e Acessibilidade Rural Aplicados — Tekó Biotech

Referência: **WCAG 2.2 AA / AAA** (critérios estritos de contraste e alvos de toque), Material Design 3 e boas práticas de UX rural para agricultores familiares com baixo letramento digital.

---

## 1. Diretrizes no Web App & Telegram Mini App (`web/`)

| Prática | Implementação | Propósito para o Produtor Rural |
|---|---|---|
| **Dark Mode de Alto Contraste** | `#0b0b0b` fundo, `#151515` cards, `#ff6b00` laranja vibrante, texto `#ffffff` (contraste > 7:1) | Permite visualização nítida sob **sol forte a pino** no meio da lavoura, evitando reflexos na tela do celular. |
| **Alvos de Toque Gigantes (≥ 48 px)** | `.btn-estado`, `.nav-tab-btn`, `.btn-voz-topo` com altura mínima de 48px a 52px | Facilita a interação de agricultores com **mãos calejadas ou usando luvas de lida no campo**. |
| **Acessibilidade por Voz (TTS)** | Botão `🔊 Ouvir Planta` com `window.speechSynthesis` nativo em pt-BR cadenciado (rate: 0.95) | Agricultores idosos ou com dificuldade de leitura ouvem o diagnóstico da planta e a recomendação de irrigação/drenagem sem precisar ler. |
| **Navegação Inferior Fixa (Polegar)** | Barra fixa de 64px com 3 abas grandes (`🌱 Minha Planta`, `📊 Gráficos & Seca`, `🔬 Engenharia`) | Ergonomia com uma só mão em celulares de tela comprida (viewport 360×800 px). |
| **Sem Dependência Exclusiva de Cor** | Ícones + rótulos de texto + valores numéricos + bordas distintas | Usuários com daltonismo (protanopia/deuteranopia) identificam os estados facilmente. |
| **Canvas Interativo com Retorno Sensorial** | Desenho animado do caule com o clipe laranja, rizosfera e onda senoidal oscilante | Compreensão visual instantânea: onda vigorosa = seiva normal; onda achatada = sede; onda suprimida/errática = enchente/hipóxia. |
| **PWA Resiliente Offline** | Service Worker (`sw.js`) com cache-first | Funciona 100% mesmo quando a internet cai no interior ou durante temporais no RS. |

---

## 2. Diretrizes no Bot do Telegram (`bot/`)

- **Zero Digitação:** O bot prioriza o teclado permanente `ReplyKeyboardMarkup` com botões descritivos e emojis.
- **Suporte Total a Mensagens de Voz:** O agricultor pode gravar um áudio perguntando da lavoura e o bot responde com um tom acolhedor de extensionista da Emater.
- **Deep Linking com Parâmetros:** Abre o Telegram Mini App já no estado ou aba exata através de `?estado=hidratada|sede|hipoxia`.

---

## 3. Extensão de Navegador (`extension/`)

- Aumento de texto de 100% a 200%.
- Alto contraste e modo escuro forçado.
- Fonte OpenDyslexic e espaçamento aumentado para produtores com dislexia.
- Leitura em voz alta por síntese de fala local acionável por teclado (`Alt + A`).
