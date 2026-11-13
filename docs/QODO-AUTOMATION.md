# 🤖 Qodo Merge (PR-Agent) & Automações Gratuitas de Revisão de PRs

Este repositório está integrado ao **Qodo Merge** (antigo PR-Agent), uma ferramenta de Inteligência Artificial para análise, revisão e governança de código executada gratuitamente via GitHub Actions.

---

## ⚡ Como Funciona no Repositório

Sempre que um **Pull Request (PR)** é aberto ou atualizado:
1. O workflow [`.github/workflows/qodo_review.yml`](../.github/workflows/qodo_review.yml) é acionado.
2. O Qodo analisa o diff, os testes e o contexto da tarefa.
3. Um comentário estruturado é publicado no PR contendo:
   - **Resumo do PR & Changelog**: O que mudou e o impacto nos componentes.
   - **Score de Qualidade**: Avaliação de esforço, risco e complexidade.
   - **Sugestões de Código Aplicáveis**: Dicas com botão *"Commit suggestion"*.
   - **Auditoria de Segurança & Acessibilidade**: Alertas contra vazamento de credenciais e quebra de padrões WCAG.

---

## 💬 Comandos Disponíveis nos Comentários de PRs

Qualquer desenvolvedor ou revisor pode interagir diretamente com o Qodo digitando comandos no campo de comentários do Pull Request:

| Comando | O que faz |
|---|---|
| `/review` | Executa uma nova rodada completa de revisão do código. |
| `/describe` | Gera uma descrição detalhada e atualizada do PR, com marcadores e rótulos. |
| `/improve` | Analisa o código e gera blocos de código com melhorias concretas para commit direto. |
| `/ask <sua pergunta>` | Responde dúvidas técnicas sobre trechos específicos do diff. |
| `/help` | Exibe a lista completa de comandos e opções do Qodo Merge. |

---

## ⚙️ Regras Personalizadas em `.pr_agent.toml`

O arquivo [`.pr_agent.toml`](../.pr_agent.toml) orienta o modelo de linguagem com regras específicas da **Tekó Biotech**:
- **Acessibilidade Rural**: Garantir alvos de toque ≥ 48px e paleta de alto contraste para visibilidade sob sol forte no campo.
- **Bioprocessos e Eletrofisiologia**: Validar as frequências de bioimpedância (50 kHz para turgor celular, 1 kHz para fluxo do xilema) e o limiar de hipóxia da rizosfera (ORP < -100 mV).
- **Proteção de Segredos**: Alerta imediato contra commit acidental de tokens do Telegram (`TELEGRAM_TOKEN`).

---

## 🚀 Pipeline de CI (`.github/workflows/ci.yml`)

Além do Qodo, a pipeline gratuita executa:
- `pytest`: Valida a suite de testes de telemetria e o bot.
- `node --check`: Valida a integridade sintática do JavaScript e dos manifestos PWA.
- `deploy-pages`: Realiza o deploy automático da pasta `web/` para o GitHub Pages ao mesclar na branch `main`.
