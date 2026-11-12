/* Aplica as preferências de acessibilidade no site AgroSponge RS. */
(() => {
  const PADRAO = {
    escala: 100, // 100–200 (%)
    contraste: false,
    escuro: false,
    dislexia: false,
    espacamento: false,
    foco: false,
    semMovimento: false,
  };

  const raiz = document.documentElement;

  function aplicar(p) {
    p = { ...PADRAO, ...p };
    raiz.style.setProperty("--a11y-escala", String(p.escala / 100));
    raiz.toggleAttribute("data-a11y-escala", p.escala !== 100);
    raiz.toggleAttribute("data-a11y-contraste", !!p.contraste);
    raiz.toggleAttribute("data-a11y-escuro", !!p.escuro && !p.contraste);
    raiz.toggleAttribute("data-a11y-dislexia", !!p.dislexia);
    raiz.toggleAttribute("data-a11y-espacamento", !!p.espacamento);
    raiz.toggleAttribute("data-a11y-foco", !!p.foco);
    raiz.toggleAttribute("data-a11y-sem-movimento", !!p.semMovimento);
  }

  chrome.storage.sync.get(PADRAO, aplicar);
  chrome.storage.onChanged.addListener((_mudancas, area) => {
    if (area === "sync") chrome.storage.sync.get(PADRAO, aplicar);
  });

  /* ---------- Leitura em voz alta (Web Speech, pt-BR) ---------- */
  function textoParaLer() {
    const sel = String(window.getSelection() || "").trim();
    if (sel) return sel;
    const secao = document.querySelector("main section:not([hidden])") || document.querySelector("main") || document.body;
    return (secao.innerText || "").trim();
  }

  function ler() {
    if (!("speechSynthesis" in window)) return { ok: false, erro: "sem-voz" };
    speechSynthesis.cancel();
    const texto = textoParaLer();
    if (!texto) return { ok: false, erro: "sem-texto" };
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    const vozes = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
    if (vozes.length) fala.voice = vozes.find((v) => v.lang === "pt-BR") || vozes[0];
    fala.rate = 0.9; // um pouco mais devagar
    speechSynthesis.speak(fala);
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
    if (msg && msg.tipo === "ler") responder(ler());
    else if (msg && msg.tipo === "parar") {
      speechSynthesis.cancel();
      responder({ ok: true });
    }
    return false;
  });

  window.addEventListener("pagehide", () => speechSynthesis.cancel());
})();
