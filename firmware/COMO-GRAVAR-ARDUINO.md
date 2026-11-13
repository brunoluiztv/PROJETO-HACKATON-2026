# Guia Passo a Passo: Gravando o Firmware ESP32 na Arduino IDE

> **Tekó Biotech — Hackathon das Engenharias UERGS 2026**  
> Desafio 02: Água para o Futuro e Drenagem Urbana (Agricultura Familiar no RS)

Este guia prático foi elaborado para você que já instalou a **Arduino IDE** no computador e deseja compilar e gravar o protótipo do **Sensor Físico de Potencial Matricial ($\Psi_m$)** no **ESP32** em poucos minutos, **sem precisar instalar bibliotecas externas complexas**.

---

## 📋 Sumário
1. [Lista de Materiais Necessários](#1-lista-de-materiais-necessários)
2. [Esquema de Ligação Elétrica (Pinout)](#2-esquema-de-ligação-elétrica-pinout)
3. [Configuração da Arduino IDE para o ESP32](#3-configuração-da-arduino-ide-para-o-esp32)
4. [Ajustes Rápidos no Código (Wi-Fi e IP)](#4-ajustes-rápidos-no-código-wi-fi-e-ip)
5. [Compilação e Gravação na Placa](#5-compilação-e-gravação-na-placa)
6. [Monitoramento Serial e Demonstração no Palco](#6-monitoramento-serial-e-demonstração-no-palco)
7. [Resolução de Problemas Comuns (Troubleshooting)](#7-resolução-de-problemas-comuns-troubleshooting)

---

## 1. Lista de Materiais Necessários

| Item | Descrição / Modelo | Quantidade |
| :--- | :--- | :---: |
| **Placa Microcontroladora** | ESP32 DevKit v1 / NodeMCU-32S (30 ou 38 pinos) | 1 un |
| **Sensor Físico** | Sensor de Matriz Granular (estilo *Watermark 200SS* / bloco de gesso poroso ou 2 eletrodos resistivos no substrato) | 1 un |
| **Resistor de Precisão** | Resistor de **$10\text{ k}\Omega$** (marrom-preto-laranja) | 1 un |
| **Protoboard & Jumpers** | Protoboard pequena e fios jumpers macho-macho / macho-fêmea | 1 kit |
| **Cabo USB** | Cabo Micro-USB ou USB-C com linhas de dados ativas | 1 un |
| **Ponto de Acesso** | Celular 4G com Roteador Wi-Fi ativado (2.4 GHz) | 1 un |

---

## 2. Esquema de Ligação Elétrica (Pinout)

O circuito utiliza uma topologia de **Divisor de Tensão Resistivo** no canal analógico **GPIO 34 (ADC1_CH6)**.  
> 💡 *Por que o GPIO 34?* O ADC1 opera independentemente do rádio Wi-Fi do ESP32, garantindo leituras analógicas precisas sem ruídos causados pela antena de transmissão!

### Diagrama de Conexão na Bancada:

```text
               +3.3V (Pino 3V3 do ESP32)
                 |
                 +---+
                     |
                   [10 kΩ]  Resistor Fixo
                     |
                     +----------------------> GPIO 34 (Pino ADC do ESP32)
                     |
               +-----+-----+
               |           |
               |  SENSOR   |  Sensor de Matriz Granular / Bloco Poroso
               |           |
               +-----+-----+
                     |
                    GND (Pino GND do ESP32)
```

### Ligação Fio a Fio:
1. Conecte uma perna do **Resistor de $10\text{ k}\Omega$** no pino **3V3** do ESP32.
2. Conecte a outra perna do **Resistor** no pino **GPIO 34** do ESP32.
3. Conecte o **Fio A do Sensor** no mesmo nó do pino **GPIO 34**.
4. Conecte o **Fio B do Sensor** no pino **GND** do ESP32.

*(Nota: Sensores resistivos de matriz granular não possuem polaridade fixa, logo qualquer um dos fios pode ir ao pino analógico e o outro ao GND).*

---

## 3. Configuração da Arduino IDE para o ESP32

Se esta for sua primeira vez utilizando o ESP32 na Arduino IDE:

### Passo 3.1 — Adicionar o pacote Espressif
1. Abra a Arduino IDE.
2. Vá em **Arquivo** $\rightarrow$ **Preferências** (ou `Ctrl + Vírgula`).
3. No campo **URLs do Gerenciador de Placas Adicionais**, cole a URL oficial da Espressif:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Clique em **OK**.

### Passo 3.2 — Instalar as Placas ESP32
1. No menu lateral esquerdo, clique no ícone do **Gerenciador de Placas** (ícone com formato de chip).
2. Na barra de pesquisa, digite `esp32`.
3. Localize o pacote **esp32** por *Espressif Systems* e clique em **Instalar** (recomenda-se a versão mais recente 2.x ou 3.x).

---

## 4. Ajustes Rápidos no Código (Wi-Fi e IP)

1. Na Arduino IDE, abra o arquivo:
   `firmware/esp32_phytosense_arduino/esp32_phytosense_arduino.ino`
2. Localize o bloco de configuração inicial no topo do arquivo (linhas 30 a 45):

```cpp
// Rede 1: Roteador 4G / Hotspot do Smartphone (Recomendado para apresentação)
const char* WIFI_SSID_1 = "PhytoSense_Hotspot"; 
const char* WIFI_PASS_1 = "rural123456";

// Rede 2: Wi-Fi do Evento / Bancada Local
const char* WIFI_SSID_2 = "UERGS_HACKATON";
const char* WIFI_PASS_2 = "hackathon2026";

// URL do Backend FastAPI
const char* BACKEND_URL = "http://192.168.1.150:8000/api/telemetria";

// Tipo de Solo da Lavoura ("arenoso", "franco" ou "argiloso")
const char* TIPO_SOLO = "franco";
```

### Calibração Agronômica por Tipo de Solo:
O solo altera profundamente a retenção de água e a força que as raízes fazem para beber:
- **`arenoso`:** Capacidade de Campo (10 kPa) e Estresse precoce (30 kPa). A água desce rápido como num coador.
- **`franco`:** Equilibrado (CC: 22 kPa, Estresse: 45 kPa). Padrão recomendado.
- **`argiloso`:** Terra roxa / várzea (CC: 33 kPa, Estresse: 65 kPa). Retém muita água com forte tensão capilar; em 33 kPa ainda há água plena!

*(Nota: O agricultor também pode trocar o solo diretamente no formulário visual do WebApp ou pelo Bot do Telegram sem precisar regravar o ESP32).*

### Como descobrir o IP do seu computador na rede local:
- No Windows, abra o prompt de comando (`Win + R`, digite `cmd` e dê Enter).
- Digite `ipconfig` e localize o seu **Endereço IPv4** (ex: `192.168.43.120`).
- Substitua no código: `http://192.168.43.120:8000/api/telemetria`.

---

## 5. Compilação e Gravação na Placa

1. Conecte o ESP32 no computador usando o cabo USB.
2. Na barra superior da Arduino IDE:
   - **Placa:** Selecione `ESP32 Dev Module` (ou `NodeMCU-32S`).
   - **Porta:** Selecione a porta correspondente (ex: `COM3`, `COM4`, etc.).
3. Clique no botão de seta **Carregar** (`Ctrl + U`).
4. Durante a gravação:
   - Caso o terminal da IDE mostre `Connecting........_____.....`, **mantenha pressionado o botão "BOOT"** na placa ESP32 por 2 segundos até iniciar a contagem percentual (`Writing at 0x00010000... (10%)`), depois solte.
5. Ao concluir, você verá a mensagem `Leaving... Hard resetting via RTS pin...` e o LED onboard piscará.

---

## 6. Monitoramento Serial e Demonstração no Palco

1. Abra o **Monitor Serial** da Arduino IDE (`Ctrl + Shift + M`).
2. No canto inferior direito da janela serial, certifique-se de configurar a velocidade para:
   **`115200 baud`**.
3. Pressione o botão **EN / RST** no ESP32 para reiniciar.
4. O ESP32 exibirá a inicialização e o gráfico ASCII em tempo real:

```text
========================================================
🌱  TEKÓ BIOTECH — BIOSSENSOR FITOELETRÔNICO IN-PLANTA
    Hackathon UERGS 2026 — Desafio 02: Água e Drenagem
    Nó Sentinela ESP32 com Sensor de Potencial Matricial
========================================================
[Hardware] Pino do Sensor: GPIO 34 (ADC1)
[Destino] Endpoint: http://192.168.43.120:8000/api/telemetria

[Wi-Fi] Tentando Rede 1 (Hotspot): 'PhytoSense_Hotspot'.....
✅ [Wi-Fi] CONECTADO COM SUCESSO!
   IP do ESP32: 192.168.43.45 | Sinal RSSI: -54 dBm

------------------------------------------------------------------
[Telemetria Sentinela] Ψm: 21.4 kPa | R_sensor: 2420 Ω | Estado: hidratada
Tensão [======>             ] 21.4 kPa 🟢 [PLENA HIDRATAÇÃO - BOMBA DESLIGADA]
Biometria: Z_50k: 1514 Ω | Z_1k: 1185 Ω | ORP: 321 mV | CE: 1.28 dS/m | Bio-MFC: 580 mV
Rede: Wi-Fi RSSI: -54 dBm | Bateria: 3300 mV
🚀 [HTTP POST] Sucesso! Código 200 enviado para API.
```

### 🎯 Dicas de Demonstração Interativa na Bancada:
- **Demonstrando Solo Hidratado (10 a 30 kPa):** O sensor mergulhado em substrato úmido indica seiva fluindo e bomba desligada.
- **Demonstrando Início de Seca (30 a 60 kPa):** Retire o sensor e encoste apenas levemente com os dedos ou substrato seco; o valor de tensão sobe para 45 kPa e o sistema alerta para programar irrigação às 06h.
- **Demonstrando Encharcamento / Enchente (< 10 kPa):** Coloque o sensor em um copo com água; o potencial cai para ~3 kPa, o ORP despenca para -140 mV e o sistema aciona o alerta de asfixia radicular e gera o laudo PROAGRO.

---

## 7. Resolução de Problemas Comuns (Troubleshooting)

### A porta COM não aparece na Arduino IDE
- Quase sempre é ausência do driver do conversor USB-Serial da placa. Baixe e instale:
  - Para placas com chip **CP2102**: Driver Silicon Labs CP210x.
  - Para placas com chip **CH340 / CH341**: Driver WCH CH341SER.
- Verifique se o cabo USB é de dados e não apenas de carga.

### Erro: `Failed to connect to ESP32: Timed out waiting for packet header`
- O ESP32 não entrou no modo de bootloader automaticamente. Segure o botão **BOOT** quando o log de upload começar e solte assim que começar a transferir os bytes.

### O Wi-Fi não conecta
- O ESP32 opera apenas na frequência de **2.4 GHz**. Em roteadores ou hotspots móveis, certifique-se de ativar o modo 2.4 GHz (desative a opção "Apenas 5 GHz").

### O HTTP POST retorna erro no monitor serial
- Verifique se o backend FastAPI está rodando (`uvicorn backend.server:app --host 0.0.0.0 --port 8000`).
- Confirme se o firewall do Windows não está bloqueando a porta 8000.
- Certifique-se de que o computador e o ESP32 estão conectados **exatamente na mesma rede Wi-Fi** (ex: ambos no mesmo Hotspot 4G do celular).
