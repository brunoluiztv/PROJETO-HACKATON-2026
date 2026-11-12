# UX e acessibilidade aplicados

Referência: WCAG 2.2 AA (com partes AAA), Material Design e boas práticas de mobile-first.

## Site (`web/`)
| Prática | Onde |
|---|---|
| CSS mobile-first (360 px; `min-width` só para tablet/desktop) | `css/styles.css` |
| Alvos de toque ≥ 48 px (`--toque: 3rem`) e espaçamento entre eles | `.cor`, `.mais-menos`, `.nav-inferior a` |
| Navegação inferior (zona do polegar), `aria-current` na aba ativa | `.nav-inferior` |
| Texto base de 18 px em `rem`, `clamp()` nos títulos, respeita zoom | `html`, `h1` |
| Cor nunca é a única informação (cor + ícone + texto) | cartões de selo e laudos |
| Contraste ≥ 4.5:1, tema escuro (`prefers-color-scheme`), `prefers-contrast` | `:root` |
| Landmarks, ordem de títulos, skip-link, foco visível, `aria-live` nos resultados | `index.html` |
| Gráfico SVG com alternativa em tabela | `#grafico` + `#tabela` |
| `prefers-reduced-motion` | fim do CSS |
| Sem framework e sem CDN (só `telegram-web-app.js`, opcional) | `js/` |
| PWA: manifest + service worker (rede ruim no campo) | `manifest.webmanifest`, `sw.js` |
| CSP sem scripts/estilos inline | `netlify.toml` |
| Linguagem simples, verbo no botão, reconhecimento em vez de memorização | todo o texto |

## Extensão (`extension/`)
Texto de 100% a 200%, alto contraste, modo escuro, foco destacado, fonte e espaçamento para dislexia (WCAG 1.4.12), sem animações e leitura em voz alta pt-BR. Atua só no domínio do site (permissões mínimas). O popup tem rótulos claros, `aria-pressed` e navegação por teclado.

## Bot (`bot/`)
Teclado fixo com botões grandes, respostas curtas e acolhedoras, aceita áudio e foto, e não exige digitar. Na dúvida, não conclui e pede confirmação.
