declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
      };
    };
  }
}
export async function initTelegram(): Promise<void> {
  // The SDK is optional: it must never prevent the application from starting.
  if (!window.Telegram?.WebApp && !location.hash.includes('tgWebAppData') && !location.search.includes('tgWebApp')) return;
  try {
    if (!window.Telegram?.WebApp) await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.append(script);
    });
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  } catch {/* regular browser operation remains available */}
}
