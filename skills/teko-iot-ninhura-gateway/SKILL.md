---
name: teko-iot-ninhura-gateway
description: Engenharia de hardware, firmware C++ e protocolo de comunicação para os nós sentinelas ESP32-C3 e o gateway rural Ninhura da Tekó Biotech. Usar sempre que alterar sketches de firmware (ESP-NOW, conversão analógica ADC, calibração bioelétrica, LittleFS), rotinas de Deep Sleep (10 µA), balanço energético bio-solar P-MFC ou integração gateway Ninhura com a API FastAPI.
category: embedded-iot
risk: safe
tools:
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

# ⚡ Tekó IoT: Firmware ESP32-C3 & Gateway Ninhura

Este playbook documenta os padrões de engenharia embarcada, topologia de comunicação por rádio e arquitetura de ultra-baixo consumo energético do sistema **Tekó Biotech**.

---

## 📌 When to Use (Quando Acionar)

Carregue e aplique esta skill quando:
- Escrever, depurar ou revisar código de firmware C++/Arduino em `firmware/`.
- Ajustar calibrações de ADC (12 bits) para Potencial Matricial ($\Psi_m$) e Bioimpedância ($Z$).
- Configurar ou modificar pacotes de rádio **ESP-NOW** (camada física sem fio de campo).
- Otimizar o ciclo de sono profundo (**Deep Sleep**) e balanço energético da bateria LiFePO4.
- Implementar buffers circulares em memória Flash (**LittleFS**) para resiliência offline de 30 dias.
- Integrar a ponte do **Gateway Ninhura** com o backend FastAPI (`POST /api/telemetria/gateway`).

---

## 📡 Core Workflow & Arquitetura de Campo

```
+-------------------------------------------------------------+
| NÓS SENTINELAS DE CAMPO (ESP32-C3 · Ultra-Low Power)        |
| - Coleta Z (50 kHz / 1 kHz), ORP (-140 a +310 mV) e Tensão |
| - Deep Sleep 99,8% do tempo (10 µA)                         |
| - LittleFS: Armazenamento local de 30 dias se gateway cair  |
+-------------------------------------------------------------+
                              |
                              | Rádio ESP-NOW (2.4 GHz · 4 ms)
                              v
+-------------------------------------------------------------+
| GATEWAY NINHURA (ESP32 Central na Sede Rural)               |
| - Alimentação contínua na rede ou painel solar da sede      |
| - Recebe ESP-NOW dos nós 1, 2 e 3                           |
| - Converte para JSON REST e despacha via Wi-Fi ou 4G        |
+-------------------------------------------------------------+
                              |
                              | HTTP POST (FastAPI REST)
                              v
+-------------------------------------------------------------+
| SERVIDOR FASTAPI / BANCO SQLITE / WEBAPP & BOT TELEGRAM     |
+-------------------------------------------------------------+
```

### 1. Balanço Energético Perpétuo
* **Consumo Diário do ESP32-C3 em Deep Sleep:**
  * Modo ativo: $80\text{ mA}$ durante apenas $1,5\text{ segundos}$ a cada 30 minutos (leitura + transmissão ESP-NOW).
  * Modo Deep Sleep: $10\text{ }\mu\text{A}$ nos 29,9 minutos restantes.
  * **Consumo total diário:** $\approx 14\text{ mAh/dia}$.
* **Geração Bio-Solar Diária:**
  * Célula microbiana P-MFC (*Geobacter* na raiz): $450\text{ a }650\text{ mV}$ contínuos (dia e noite) $\to \approx 20\text{ mAh/dia}$.
  * Micro painel solar complementar ($50\times 50\text{ mm}$): $\approx 25\text{ mAh/dia}$.
  * **Geração total diária:** $\approx 45\text{ mAh/dia}$.
  * **Saldo:** Superávit de $+31\text{ mAh/dia}$ (Autonomia perpétua sem troca de baterias).

### 2. Blindagem e Resiliência Física (IP68)
* Encapsulamento em resina vegetal biodegradável de óleo de mamona (*Ricinus communis*).
* Resistente à imersão total em água de enchente (até 1,5 metro de coluna d'água por 72 horas).
* Proteção contra orvalho matinal e radiação UV intensa no campo.

### 3. Buffer Circular Local (LittleFS)
* Em caso de queda de energia na sede rural ou vendaval derrubando o gateway:
  * O nó sentinela armazena até **1.440 leituras** (30 dias) na memória Flash interna SPIFFS/LittleFS.
  * Quando o Gateway Ninhura volta ao ar, o nó descarrega o histórico cronológico em rajada (*burst upload*).

---

## 🚫 Rules & Anti-Patterns (Regras Invioláveis)

> [!CAUTION]
> 1. **NUNCA conectar o Nó de Campo diretamente ao Telegram:** O nó de campo usa ESP-NOW e não possui pilha TLS/HTTPS pesada; todo tráfego passa obrigatoriamente pelo Gateway Ninhura.
> 2. **NUNCA manter o rádio Wi-Fi ligado no nó sentinela:** Usar exclusivamente ESP-NOW para manter o tempo de transmissão abaixo de $5\text{ ms}$.
> 3. **NUNCA gravar credenciais ou tokens no código C++:** Parâmetros de rede são injetados no Gateway Ninhura via menu serial ou captive portal de configuração.

---

## 📦 Contrato de Payload ESP-NOW / Gateway REST

```json
{
  "gateway_id": "ninhura_gateway_01",
  "no_id": "esp32_no_01",
  "timestamp_ms": 1794580000,
  "tensao_kpa": 21.5,
  "z_50k_ohms": 1420.0,
  "z_1k_ohms": 3850.0,
  "orp_mv": 310.0,
  "ce_dsm": 1.2,
  "pmfc_mv": 480.0,
  "bateria_mv": 3320,
  "rssi_espnow": -64
}
```

---

## ✅ Verification & Quality Gates

1. O sketch Arduino deve compilar sem warnings de estouro de stack no ESP32-C3.
2. O payload JSON gerado pelo gateway deve validar contra os schemas Pydantic do backend (`backend/app/schemas/telemetry.py`).
