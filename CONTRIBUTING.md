# Guia de Contribuição & Governança de Código — Tekó Biotech 🌿

Bem-vindo ao repositório do **Tekó Biotech** (Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural).

Para manter a qualidade e evitar conflitos entre as frentes de trabalho (**Davi Caetano** no Firmware, **Eduardo Padilha** no Backend e **Bruno Luiz** no Frontend/Bot), este repositório adota um fluxo estrito de **Pull Requests obrigatórios**.

---

## 🚫 Regra de Ouro: Pushes Diretos na `main` estão Bloqueados
* A branch `main` possui **Branch Protection** ativada.
* Qualquer tentativa de `git push origin main` será rejeitada pelo GitHub.
* Todas as alterações devem ser enviadas por meio de uma branch de funcionalidade e submetidas via Pull Request.

---

## 🚀 Como Criar e Submeter Alterações

### 1. Criar uma Branch Específica
Antes de alterar qualquer arquivo, crie uma branch a partir da `main` atualizada:
```bash
git checkout main
git pull origin main
git checkout -b feature/nome-da-sua-tarefa
# ou para correções:
git checkout -b fix/nome-do-bug
```

### 2. Desenvolver e Testar Localmente
Antes de enviar, valide os testes automatizados da sua máquina:
```bash
# Testes do Bot e do Backend
pytest bot/tests/ backend/tests/ -v

# Validação Sintática dos arquivos JavaScript
node --check web/js/app.js
node --check web/js/charts.js
node --check web/js/content.js
node --check web/js/telegram.js
node --check web/js/canvas_planta.js
```

### 3. Enviar a Branch e Abrir o Pull Request
```bash
git add .
git commit -m "feat(modulo): descricao concisa da alteracao"
git push origin feature/nome-da-sua-tarefa
```
1. Acesse o GitHub: [PROJETO-HACKATON-2026/pulls](https://github.com/brunoluiztv/PROJETO-HACKATON-2026/pulls).
2. Clique em **New Pull Request** e selecione a sua branch.
3. Preencha o checklist do template (Acessibilidade WCAG, Fisiologia, Segurança, Testes).

---

## 🤖 Revisão de Código com Inteligência Artificial

Este repositório conta com agentes inteligentes de revisão em cada PR:

### 1. CodeRabbit AI
* Analisa automaticamente o diff do PR.
* Gera um resumo executivo com diagrama de sequência das chamadas em Mermaid.
* Faz comentários linha a linha com sugestões aplicáveis em 1 clique (*"Apply Suggestion"*).

### 2. Qodo Merge (PR-Agent)
* Analisa as regras específicas do agronegócio rural definidas em `.pr_agent.toml`.
* Você pode interagir com o bot nos comentários do PR usando os comandos:
  * `/review`: Solicita uma nova revisão detalhada do código.
  * `/improve`: Sugere refatorações de segurança e performance no diff.
  * `/ask <pergunta>`: Faz uma pergunta técnica sobre o PR para a IA.
  * `/describe`: Gera uma descrição completa do PR baseada nos commits.

---

## ✅ Critérios para Aprovação e Merge
1. **Status Checks Verdes:** O workflow do GitHub Actions deve passar 100% nos testes de Python e verificações de sintaxe do JavaScript.
2. **Revisão Aprovada:** Pelo menos 1 aprovação formal de um par da equipe ou do revisor de código.
3. **Deploy Automático:** Ao fazer o merge para a branch `main`, o GitHub Actions atualiza automaticamente a versão de produção no GitHub Pages!
