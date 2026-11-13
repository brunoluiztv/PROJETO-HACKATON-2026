/* Integração opcional com o Telegram WebApp: no navegador comum não faz nada. */
export function iniciarTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    document.documentElement.dataset.telegram = "1";
  } catch (_) {
    /* ignora: o site funciona sem o Telegram */
  }
}
