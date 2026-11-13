---
name: teko-inplanta-biomonitoring
description: Guia e playbook de biomonitoramento fitoeletrônico in-planta para agricultura familiar no Rio Grande do Sul. Usar sempre que trabalhar com bioimpedância de caule (50 kHz / 1 kHz), potencial redox da rizosfera (ORP < -100 mV para detecção de asfixia radicular em enchentes), célula microbiana de combustível P-MFC (Geobacter), curvas de retenção hídrica Embrapa (Alface 28 kPa, Milho 50 kPa) e emissão de laudo pericial para o PROAGRO.
category: agriculture-iot
risk: safe
tools:
  - web
  - bash
  - python
platforms:
  - antigravity
  - claude
  - codex
  - cursor
  - gemini
license: MIT
author: Teko Biotech Team
---

# 🌿 Tekó In-Planta Biomonitoring: Eletrofisiologia & Fisiologia do Estresse

Este playbook padroniza os conceitos biofísicos, modelos matemáticos e regras invioláveis do sistema **Tekó Biotech** para agentes e IAs de engenharia.

---

## 📌 When to Use (Quando Acionar)

Carregue e aplique esta skill quando:
- Implementar ou revisar lógicas de leitura bioelétrica de plantas (caule e rizosfera).
- Calcular a **taxa de secagem ($\Delta \text{kPa}/\text{dia}$)** ou **dias até o estresse hídrico**.
- Detectar anóxia e hipóxia radicular decorrentes de inundações pluviais no Rio Grande do Sul.
- Gerar ou auditar laudos periciais de perda de safra para o **PROAGRO / Seguridade Rural**.
- Validar se os parâmetros fisiológicos respeitam os limites científicos da **Embrapa**.

---

## 🔬 Core Workflow & Especificações Científicas

### 1. Frequências do Clipe de Caule Biocompatível
* **Frequência Alta ($50\text{ kHz}$):**
  * Mede o volume de água simplástico e o **turgor celular intracelular**.
  * Em planta hidratada: $Z \approx 1,4\text{ k}\Omega$.
  * Em início de desidratação (estresse invisível): $Z \ge 4,8\text{ k}\Omega$ (as células perdem volume antes de a folha murchar).
* **Frequência Baixa ($1\text{ kHz}$):**
  * Mede a condução de íons e o **fluxo apoplástico no xilema**.
  * Detecta embolia, cavitação e bloqueio do transporte de seiva bruta.
* **Interface Biocompatível:** Eletrodos de grafite com almofada de bio-hidrogel isotônico (ágar, glicerol vegetal e $\text{KCl}$ a 0,1%), não citotóxico e flexível.

### 2. Haste Basal na Rizosfera (Potencial Redox / ORP)
* **Oxigenação Normal:** $\text{ORP} > +250\text{ mV}$ (solo aeróbico, respiração celular ativa).
* **Colapso por Enchente (Hipóxia/Anóxia):** $\text{ORP} < -100\text{ mV}$ (consumo total de oxigênio dissolvido).
* **Paradoxo da Enchente:** O solo atinge $0\text{ kPa}$ ($100\%$ de saturação), porém a falta de oxigênio bloqueia a fosforilação oxidativa radicular $\to$ desativa as aquaporinas PIP $\to$ a planta entra em **seca fisiológica** e morre desidratada dentro da água.
* **Ação Recomendada:** Proibição imediata de acionamento de motobombas e abertura de valetas de drenagem.

### 3. Célula Microbiana de Combustível em Rizosfera (P-MFC)
* Eletrodo de feltro de carbono colonizado por bactérias exoeletrogênicas (*Geobacter sulfurreducens / Geobacteraceae*).
* Oxidação de exsudatos radiculares (ácidos orgânicos e carboidratos) gerando elétrons livres e prótons.
* Potencial gerado em circuito aberto: $450\text{ mV a }650\text{ mV}$ contínuos, alimentando o sistema de gerenciamento bioenergético (BQ25504/BQ25570).

---

## 🚫 Rules & Anti-Patterns (Regras Invioláveis)

> [!CAUTION]
> 1. **NUNCA usar termos herdados e obsoletos:** É terminantemente proibido referenciar "sacos biodegradáveis", "casca de arroz", "leitura colorimétrica por câmera", "tanino" ou "pote de barro como tecnologia do projeto".
> 2. **NUNCA inventar limites de manejo agronômico:** Toda tensão matricial deve obedecer à tabela da Embrapa.
> 3. **NUNCA confundir umidade volumétrica (%) com potencial matricial (kPa):** Sensores de % da terra enganam o produtor rural; a grandeza fitoeletrônica oficial é o **Potencial Matricial ($\Psi_m$ em kPa)**.
> 4. **NUNCA recomendar irrigação em solo saturado (0 kPa):** Mesmo que as folhas murchem, se $\text{ORP} < -100\text{ mV}$, a causa é asfixia e irrigar queima a bomba e agrava a hipóxia.

---

## 📊 Tabela de Referência Oficial da Embrapa

| Cultura | Solo Típico RS | Capacidade de Campo ($\text{kPa}$) | Alerta Atenção ($\text{kPa}$) | Limite Crítico Manejo ($\text{kPa}$) | Fonte Embrapa |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Alface Crespa** | Argissolo Vermelho | 12.0 | 20.0 | **28.0** | Embrapa Hortaliças |
| **Tomate / Morango** | Argissolo Média | 15.0 | 30.0 | **38.0** | Embrapa Hortaliças |
| **Feijão** | Textura Média | 20.0 | 35.0 | **45.0** | Embrapa Arroz e Feijão |
| **Milho (Vegetativo)**| Argissolo Média | 18.0 | 35.0 | **50.0** | Embrapa Milho e Sorgo |

---

## 🧮 Modelos Matemáticos

### Taxa de Secagem do Solo ($\Delta \text{kPa}/\text{dia}$):
$$\Delta \text{kPa}/\text{dia} = \frac{\text{kPa}_{\text{atual}} - \text{kPa}_{\text{inicial}}}{N - 1}$$

### Contagem Regressiva até o Estresse Hídrico Crítico:
$$\text{Dias Restantes} = \frac{\text{kPa}_{\text{limite\_Embrapa}} - \text{kPa}_{\text{atual}}}{\Delta \text{kPa}/\text{dia}}$$

---

## ✅ Verification & Acceptance Criteria

Para aprovação de qualquer PR ou código que altere a fisiologia vegetal:
1. `pytest backend/tests/test_alerts.py` deve aprovar sem erros.
2. Nenhuma string obsoleta deve existir no diff (`git diff | grep -iE "casca de arroz|saco biodegradavel"` retorna vazio).
3. Todo cálculo de dias restantes com taxa negativa ou zero deve retornar salvaguarda segura (`>= 7 dias`).
