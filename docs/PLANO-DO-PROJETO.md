# 🎯 Plano Mestre do Projeto: Hackathon das Engenharias UERGS 2026

**Desafio 02:** Água para o Futuro e Drenagem Urbana (Agricultura Familiar no Rio Grande do Sul)  
**Produto:** Tekó Biotech — Biossensor Eletrofisiológico In-Planta & Previsão Preditiva de Estresse Hídrico  

---

## 1. O Problema & Oportunidade no RS

- **A Armadilha do Sensor de Solo Comum:** Mede umidade volumétrica (%) e engana o produtor rural. Durante estiagens com ventos quentes no RS, a evapotranspiração acelera e a planta sofre estresse hídrico mesmo com água residual no solo.
- **A Solução Tekó Biotech:** Substitui o "achismo" por **tensiometria de precisão (kPa)** ancorada na **Embrapa** combinada com **bioimpedância celular no caule**. O sistema calcula a **velocidade de secagem ($\Delta \text{kPa}/\text{dia}$)** e prevê exatamente quantos dias restam até a planta entrar em estresse severo.

---

## 2. A Estratégia "90% Histórico Simulado + 10% Gatilho de Bancada ao Vivo"

Para garantir que a apresentação de **5 minutos** seja perfeita, sem gráficos vazios ou risco de falha na internet:

```
[ 90% Histórico Simulado no SQLite ] ───► Dashboard React preenchido com 7 dias de dados
                                          Curva de secagem subindo de 14 kPa até 32 kPa
                                          Status: ATENÇÃO PREVENTIVA (Restam 9 dias)

[ 10% Gatilho de Bancada ao Vivo ]   ───► Caetano puxa o sensor do vaso molhado para o ar seco
                                          ESP32 lê ADC 3800 e envia via HTTP para a API local
                                          Tensão salta instantaneamente para 48 kPa
                                          Disparo imediato no Telegram e tela vermelha:
                                          🚨 CRÍTICO: Irrigar Já (Falta < 24h)
```

---

## 3. Roteiro do Pitch de 5 Minutos (Minuto a Minuto)

> 📽️ **Apresentação de Slides Pronta no Navegador:**  
> Abra [web/slides.html](file:///C:/Users/ResTIC55/.gemini/antigravity/scratch/PROJETO-HACKATON-2026/web/slides.html) ou acesse online em [https://brunoluiztv.github.io/PROJETO-HACKATON-2026/slides.html](https://brunoluiztv.github.io/PROJETO-HACKATON-2026/slides.html) e pressione `F11` para tela cheia com navegação por teclado e QR Code ao vivo.

| Minuto | Momento da Apresentação | O que a Bancada Vê na Tela / Bancada | Mensagem Chave |
| :---: | :--- | :--- | :--- |
| **0:00 - 1:00** | **O Problema no RS** | Slides com dados de estiagem e quebra de safra no RS. | "O agricultor irriga no escuro ou gasta diesel sem necessidade." |
| **1:00 - 2:00** | **A Solução Fitoeletrônica** | Apresentação física do Nó Sentinela e clipe biocompatível. | "Biossensor que mede a planta por dentro e a força da raiz no solo." |
| **2:00 - 3:30** | **Dashboard & Tendência de 7 Dias** | Compartilhamento do WebApp exibindo o gráfico de secagem suave. | "Os dados mostram a lavoura secando a 2 kPa/dia. A Embrapa define o limite em 28 kPa para alface." |
| **3:30 - 4:15** | **O Clímax: Demonstração ao Vivo** | **Caetano tira o sensor do vaso molhado para o ar.** | **Salto para 48 kPa. Alerta vermelho no painel e o Bot do Telegram vibra ao vivo!** |
| **4:15 - 5:00** | **BOM de R$ 42,00 & Viabilidade** | Aba 3 de Engenharia com custo de R$ 42,00 e payback de 1 safra. | "Tecnologia de ponta acessível para o agricultor familiar do RS." |

---

## 4. Arquitetura Geral da Ninhura (Topologia Mesh ESP-NOW + Gateway)

```
[ Nó 01 - Canteiro Alface ] ──┐
  (ESP32 + Sensor Matriz)     │
[ Nó 02 - Lavoura Milho ]   ──┼──► (ESP-NOW) ──► [ ESP32 Gateway ] ──(Wi-Fi/4G HTTP POST)──► [ Backend FastAPI + SQLite ]
  (ESP32 + Sensor Matriz)     │                                                                      ├── [ Dashboard Web ]
[ Nó 03 - Lavoura Feijão ]  ──┘                                                                      └── [ Bot Telegram ]
  (ESP32 + Sensor Matriz)
```

> **Decisão de Engenharia:** O ESP32 não fala direto com o Telegram. Os nós de campo operam em Deep Sleep via rádio leve ESP-NOW (transmissão de 4 ms / 10 µA em sleep), enquanto o FastAPI centraliza o banco de dados, motor de alertas Embrapa e despachos para o Telegram.

---

## 5. Tabela de Física do Solo & Água Disponível (AD %)

| Estado Hídrico | $\Psi_m$ | Água Disp. (AD) | Condição para a Planta |
| :--- | :--- | :--- | :--- |
| **Saturação** | $0\text{ kPa}$ | $100\%$ | Excesso de água e falta de oxigênio nas raízes (hipóxia). |
| **Capacidade de Campo** | $-10\text{ a }-33\text{ kPa}$ | $100\%$ (Lim. sup.) | Condição ideal de umidade e aeração. |
| **Início do Estresse ($p$)** | $-30\text{ a }-70\text{ kPa}$ | $40\%\text{ a }60\%$ | Ponto crítico para irrigação sem perda produtiva. |
| **Estresse Severo** | $-100\text{ a }-500\text{ kPa}$ | $15\%\text{ a }35\%$ | Fechamento estomático, queda fotossintética e murcha. |
| **Ponto de Murcha** | $-1.500\text{ kPa}$ | $0\%$ | Água retida irreversivelmente; planta não recupera o turgor. |

---

## 5. Checklist Pré-Apresentação
- [ ] Executar `python backend/seed.py` para resetar o SQLite com os 7 dias ideais.
- [ ] Iniciar API local: `uvicorn backend.server:app --reload --port 8000`.
- [ ] Conectar ESP32 no Wi-Fi / Hotspot e verificar leitura ADC no Monitor Serial (115200 baud).
- [ ] Abrir navegador em `web/index.html` ou no link público do GitHub Pages.
- [ ] Ter um copo com água/terra molhada e um guardanapo seco para o teste de bancada.
