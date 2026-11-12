import { LAUDOS, FAQ, RECEITA } from "./content.js";
import { calcular, cenarios, desenharGrafico, preencherTabela, fmt } from "./charts.js";
import { iniciarTelegram } from "./telegram.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ABAS = ["selo", "graficos", "usar", "receita"];

/* ---------- Navegação por abas (hash) ---------- */
function mostrarAba(id, { foco = true } = {}) {
  if (!ABAS.includes(id)) id = "selo";
  for (const a of ABAS) $("#" + a).hidden = a !== id;
  for (const link of $$(".nav-inferior a")) {
    if (link.dataset.aba === id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
  if (foco) $("#conteudo").focus({ preventScroll: true });
}

function abaDoHash() {
  const id = location.hash.replace("#", "");
  mostrarAba(ABAS.includes(id) ? id : "selo", { foco: false });
}

/* ---------- Selo / laudo ---------- */
function mostrarLaudo(cor, { anunciar = true } = {}) {
  const l = LAUDOS[cor];
  const box = $("#laudo");
  if (!l) {
    box.hidden = true;
    return;
  }
  for (const b of $$(".cor")) b.setAttribute("aria-pressed", String(b.dataset.cor === cor));
  box.className = "laudo laudo-" + cor;
  box.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = `${l.icone} ${l.titulo}`;
  const p1 = document.createElement("p");
  p1.innerHTML = "<strong></strong> ";
  p1.firstChild.textContent = l.rotuloFazer + ":";
  p1.append(l.fazer);
  const p2 = document.createElement("p");
  p2.innerHTML = "<strong></strong> ";
  p2.firstChild.textContent = l.rotuloExtra + ":";
  p2.append(l.extra);
  box.append(h, p1, p2);
  box.hidden = false;
  if (anunciar) box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
}

/* ---------- Calculadora ---------- */
function atualizarCalculo(sacos) {
  sacos = Math.min(500, Math.max(1, Math.round(Number(sacos)) || 1));
  const r = calcular(sacos);
  $("#sacos").value = sacos;
  $("#sacos-range").value = Math.min(sacos, 200);
  $("#r-litros").textContent = fmt(r.litros);
  const bomb = r.bombonas >= 1.5 ? `quase ${Math.round(r.bombonas)} bombonas de 20 L` : "menos de 2 bombonas de 20 L";
  const dias = r.dias >= 1 ? `cerca de ${r.dias} ${r.dias === 1 ? "dia" : "dias"} sem regar` : "menos de 1 dia sem regar";
  $("#r-detalhe").textContent = `${bomb} · ${dias}`;
  const lista = cenarios(sacos);
  desenharGrafico($("#grafico"), lista);
  preencherTabela($("#tabela tbody"), lista);
}

/* ---------- FAQ e receita ---------- */
function montarFaq() {
  const box = $("#faq");
  for (const item of FAQ) {
    const d = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = item.p;
    const p = document.createElement("p");
    p.textContent = item.r;
    d.append(s, p);
    box.appendChild(d);
  }
}

function montarReceita() {
  const ol = $("#ingredientes");
  const barra = $("#barra-receita");
  const total = RECEITA.reduce((s, i) => s + i.g, 0);
  for (const i of RECEITA) {
    const li = document.createElement("li");
    li.className = i.classe;
    li.innerHTML = "<strong></strong><span></span>";
    li.firstChild.textContent = `${i.g} g (${i.partes})`;
    li.lastChild.textContent = i.nome;
    ol.appendChild(li);
    const seg = document.createElement("span");
    seg.className = "seg " + i.classe;
    seg.style.flexGrow = String(i.g / total);
    seg.textContent = `${i.g} g`;
    barra.appendChild(seg);
  }
}

/* ---------- PWA ---------- */
function registrarSW() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

/* ---------- Início ---------- */
function iniciar() {
  iniciarTelegram();
  montarFaq();
  montarReceita();

  for (const b of $$(".cor")) b.addEventListener("click", () => mostrarLaudo(b.dataset.cor));

  $("#form-calc").addEventListener("submit", (e) => e.preventDefault());
  const campo = $("#sacos");
  campo.addEventListener("input", () => campo.value !== "" && atualizarCalculo(campo.value));
  campo.addEventListener("change", () => atualizarCalculo(campo.value));
  $("#sacos-range").addEventListener("input", (e) => atualizarCalculo(e.target.value));
  $("#menos").addEventListener("click", () => atualizarCalculo(Number(campo.value) - 1));
  $("#mais").addEventListener("click", () => atualizarCalculo(Number(campo.value) + 1));
  for (const b of $$("[data-sacos]")) b.addEventListener("click", () => atualizarCalculo(b.dataset.sacos));

  atualizarCalculo(15);

  // ?lote=verde|amarelo|vermelho (vindo do bot) abre direto o laudo
  const lote = new URLSearchParams(location.search).get("lote");
  if (lote && LAUDOS[lote]) mostrarLaudo(lote, { anunciar: false });

  window.addEventListener("hashchange", abaDoHash);
  abaDoHash();
  registrarSW();
}

iniciar();
