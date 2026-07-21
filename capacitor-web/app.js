/* global Capacitor */

(() => {
  const WEB_APP_URL =
    'https://repairsync.ai.studio';
  const PUSH_REGISTER_URL = `${WEB_APP_URL}/api/push/register`;

  const root = document.getElementById('app');
  if (!root) return;

  root.style.fontFamily =
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  root.style.margin = '0 auto';
  root.style.maxWidth = '320px';
  root.style.textAlign = 'center';

  function renderStatus(message) {
    root.innerHTML = `
      <div style="background:#ffffff;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,0.12);padding:28px 24px;">
        <img
          src="./RepairSync_logo.png"
          alt="RepairSync SMS"
          style="border-radius:20px;display:block;height:88px;margin:0 auto 18px;object-fit:cover;width:88px;"
        />
        <div style="color:#0f172a;font-size:1.35rem;font-weight:800;line-height:1.1;margin-bottom:6px;">RepairSync SMS</div>
        <p style="color:#64748b;font-size:0.95rem;line-height:1.5;margin:0;">${message}</p>
      </div>
    `;
  }

  renderStatus('Opening app...');

  function logPushStatus(message, detail) {
    const text = `[RepairSyncPush] ${message}`;
    if (detail) {
      console.log(text, detail);
    } else {
      console.log(text);
    }
    renderStatus(text);
  }

  function logPushError(message, error) {
    const detail = error?.message || String(error || '');
    console.error(`[RepairSyncPush] ${message}`, error);
    renderStatus(`[RepairSyncPush] ${message}${detail ? `: ${detail}` : ''}`);
  }

  async function ensureNotificationChannel() {
    // Android-only; safe to call everywhere. iOS foreground display is handled
    // by FirebaseMessaging.presentationOptions in capacitor.config.ts.
    if (globalThis.Capacitor?.getPlatform?.() !== 'android') return;

    const plugins = globalThis.Capacitor?.Plugins;
    const FirebaseMessaging = plugins?.FirebaseMessaging;
    if (!FirebaseMessaging?.createChannel) return;

    try {
      const createChannel = FirebaseMessaging?.createChannel?.bind(FirebaseMessaging);
      await createChannel({
        id: 'messages',
        name: 'Messages',
        description: 'Inbound message alerts',
        importance: 5,
        visibility: 1,
      });
      logPushStatus('Android notification channel ready');
    } catch (error) {
      logPushError('Notification channel setup skipped', error);
    }
  }

  async function registerForPush() {
    const plugins = globalThis.Capacitor?.Plugins;
    const FirebaseMessaging = plugins?.FirebaseMessaging;

    if (!FirebaseMessaging?.getToken) {
      logPushStatus('FirebaseMessaging plugin unavailable');
      return;
    }

    async function postToken(value) {
      if (!value) {
        throw new Error('FCM token was empty');
      }
      logPushStatus('Registering FCM token with backend');
      try {
        const response = await fetch(PUSH_REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: value,
            platform: globalThis.Capacitor?.getPlatform?.() || 'unknown',
          }),
        });
        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }
        logPushStatus('FCM token registered with backend');
      } catch (error) {
        logPushError('FCM token backend registration failed', error);
        throw error;
      }
    }

    try {
      const permission = await FirebaseMessaging.requestPermissions();
      logPushStatus('Notification permission result', permission);
    } catch (error) {
      logPushError('Notification permission request failed', error);
    }

    try {
      logPushStatus('Requesting FCM token');
      const tokenResult = await FirebaseMessaging.getToken();
      logPushStatus('FCM token received', {
        tokenPrefix: tokenResult?.token?.slice?.(0, 12),
      });
      await postToken(tokenResult?.token);
    } catch (error) {
      logPushError('FCM token setup failed', error);
    }

    FirebaseMessaging.addListener('notificationReceived', (event) => {
      logPushStatus('Foreground notification received', event);
    });

    FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      logPushStatus('Notification action performed', event);
    });
  }

  async function init() {
    await ensureNotificationChannel();
    await registerForPush();

    // Navigate the WebView to the real app URL so Google Sign-In/Firebase Auth
    // runs on a normal https origin (not inside an iframe on capacitor://localhost).
    window.location.replace(WEB_APP_URL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
