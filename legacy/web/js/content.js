/* Fonte única de conteúdo do site. Espelha bot/conteudo.py (números e textos). */

export const LITROS_POR_SACO = 13;
export const CONSUMO_DIA_LITROS = 58; // 1.040 L ≈ 18 dias de lavoura
export const BOMBONA_LITROS = 20;

export const LAUDOS = {
  verde: {
    icone: "✔",
    titulo: "SELO VERDE: ÁGUA BOA PRA ROÇA!",
    fazer: "Pode cortar o saco de algodão com a enxada e misturar o gel direto nos canteiros de verdura, milho ou feijão.",
    extra: "Cada saco guarda 13 litros de água e já tem fungo bom (Trichoderma) que protege a raiz na estiagem.",
    rotuloFazer: "O que fazer",
    rotuloExtra: "Vantagem",
  },
  amarelo: {
    icone: "!",
    titulo: "SELO AMARELO: ÁGUA COM MUITO BARRO",
    fazer: "Não coloque em alface ou morango agora. Deixe esse saco descansar na composteira por 15 dias ou use apenas no pé de árvores frutíferas e acácia.",
    extra: "O calor do monte de adubo limpa a água antes de ir pra horta.",
    rotuloFazer: "O que fazer",
    rotuloExtra: "Por quê",
  },
  vermelho: {
    icone: "✖",
    titulo: "SELO VERMELHO: PERIGO - ÁGUA CONTAMINADA!",
    fazer: "PROIBIDO abrir na horta! Essa água misturou com fossa ou óleo.",
    extra: "Mantenha o saco fechado e use apenas para segurar barranco de estrada ou encosta. O carvão dentro dele prendeu a sujeira para proteger seu poço.",
    rotuloFazer: "O que fazer",
    rotuloExtra: "Uso seguro",
  },
};

export const FAQ = [
  {
    p: "Esse gel tem plástico ou veneno?",
    r: "Não! É feito de mandioca/goma natural, casca de arroz e acácia negra. Vira adubo na terra.",
  },
  {
    p: "O pano do saco some na terra?",
    r: "Sim, o algodão cru apodrece sozinho em poucas semanas e alimenta as minhocas.",
  },
  {
    p: "Quanto tempo dura fechado na chuva?",
    r: "Segura a enxurrada por até 5 dias. Depois que a chuva passar, já corte e misture nos canteiros!",
  },
];

export const RECEITA = [
  { g: 700, nome: "Casca de arroz + um punhado de carvão moído", partes: "7 partes", classe: "i1" },
  { g: 250, nome: "Pó gelificante (goma xantana ou fécula)", partes: "2 partes e meia", classe: "i2" },
  { g: 50, nome: "Tanino de acácia + Trichoderma", partes: "meia parte", classe: "i3" },
];
