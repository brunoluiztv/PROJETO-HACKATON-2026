import { LITROS_POR_SACO, CONSUMO_DIA_LITROS, BOMBONA_LITROS } from "./content.js";

export function calcular(sacos) {
  const litros = sacos * LITROS_POR_SACO;
  return {
    sacos,
    litros,
    bombonas: litros / BOMBONA_LITROS,
    dias: Math.round(litros / CONSUMO_DIA_LITROS), // 80 sacos (1.040 L / 58) = 18 dias; 15 sacos = 3 dias
  };
}

export const fmt = (n) => n.toLocaleString("pt-BR");

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Cenários: o do usuário e referências Horta/Sítio (sem repetir se forem iguais). */
export function cenarios(sacos) {
  const lista = [{ nome: "Você", ...calcular(sacos) }];
  if (sacos !== 15) lista.push({ nome: "Horta", ...calcular(15) });
  if (sacos !== 80) lista.push({ nome: "Sítio", ...calcular(80) });
  return lista;
}

export function desenharGrafico(container, lista) {
  container.replaceChildren();
  const largura = 320;
  const altura = 40 * lista.length + 10;
  const max = Math.max(...lista.map((c) => c.litros), 1);
  const svg = el("svg", { viewBox: `0 0 ${largura} ${altura}`, class: "svg-barras", focusable: "false" });
  const area = largura - 90;

  lista.forEach((c, i) => {
    const y = 8 + i * 40;
    const w = Math.max(6, (c.litros / max) * (area - 70));
    svg.appendChild(el("text", { x: 0, y: y + 22, class: "rotulo" }, c.nome));
    svg.appendChild(el("rect", { x: 56, y, width: w, height: 28, rx: 6, class: i === 0 ? "barra barra-vc" : "barra" }));
    svg.appendChild(el("text", { x: 56 + w + 6, y: y + 20, class: "valor" }, `${fmt(c.litros)} L`));
  });
  container.appendChild(svg);
}

export function preencherTabela(tbody, lista) {
  tbody.replaceChildren();
  for (const c of lista) {
    const tr = document.createElement("tr");
    [c.nome, fmt(c.sacos), fmt(c.litros), fmt(c.dias)].forEach((v, i) => {
      const cell = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) cell.scope = "row";
      cell.textContent = v;
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  }
}
