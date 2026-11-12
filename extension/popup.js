const PADRAO = {
  escala: 100,
  contraste: false,
  escuro: false,
  dislexia: false,
  espacamento: false,
  foco: false,
  semMovimento: false,
};
const PASSO = 10, MIN = 100, MAX = 200;

const $ = (s) => document.querySelector(s);
let prefs = { ...PADRAO };

function desenhar() {
  $("#valor-escala").textContent = prefs.escala + "%";
  for (const b of document.querySelectorAll("[data-pref]")) {
    b.setAttribute("aria-pressed", String(!!prefs[b.dataset.pref]));
  }
  $("#menor").disabled = prefs.escala <= MIN;
  $("#maior").disabled = prefs.escala >= MAX;
}

function salvar(mudanca) {
  prefs = { ...prefs, ...mudanca };
  chrome.storage.sync.set(prefs);
  desenhar();
}

function avisar(texto) {
  $("#status").textContent = texto;
}

async function enviar(tipo) {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba || !aba.id) return avisar("Abra o site AgroSponge RS para usar esta função.");
  try {
    const r = await chrome.tabs.sendMessage(aba.id, { tipo });
    if (r && !r.ok) {
      avisar(r.erro === "sem-voz" ? "Este navegador não tem leitura em voz." : "Não achei texto para ler.");
    } else {
      avisar(tipo === "ler" ? "Lendo…" : "Leitura parada.");
    }
  } catch (_) {
    avisar("Abra o site AgroSponge RS para usar esta função.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(PADRAO, (salvo) => {
    prefs = { ...PADRAO, ...salvo };
    desenhar();
    $("#ouvir").focus();
  });

  $("#menor").addEventListener("click", () => salvar({ escala: Math.max(MIN, prefs.escala - PASSO) }));
  $("#maior").addEventListener("click", () => salvar({ escala: Math.min(MAX, prefs.escala + PASSO) }));
  $("#normal").addEventListener("click", () => salvar({ escala: 100 }));

  for (const b of document.querySelectorAll("[data-pref]")) {
    b.addEventListener("click", () => salvar({ [b.dataset.pref]: !prefs[b.dataset.pref] }));
  }

  $("#ouvir").addEventListener("click", () => enviar("ler"));
  $("#parar").addEventListener("click", () => enviar("parar"));
  $("#restaurar").addEventListener("click", () => {
    salvar({ ...PADRAO });
    enviar("parar");
    avisar("Tudo voltou ao normal.");
  });
});
