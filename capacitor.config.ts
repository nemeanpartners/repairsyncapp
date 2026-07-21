import type { CapacitorConfig } from '@capacitor/cli';

const hostedServerUrl = 'https://repairsync-sms-854444042755.us-west1.run.app';
const resolvedServerUrl = process.env.CAP_SERVER_URL || hostedServerUrl;
const allowNavigationHosts = Array.from(
  new Set(
    [resolvedServerUrl, hostedServerUrl]
      .map((value) => {
        try {
          return new URL(value).host;
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value))
      .concat([
        'gen-lang-client-0477801246.firebaseapp.com',
        'accounts.google.com',
        'www.google.com',
      ]),
  ),
);

const config: CapacitorConfig = {
  appId: 'com.repairsyncios.sms',
  appName: 'RepairSync',
  webDir: 'capacitor-web',
  server: {
    url: resolvedServerUrl,
    cleartext: resolvedServerUrl.startsWith('http://'),
    allowNavigation: allowNavigationHosts
  },
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ['sound', 'alert']
    }
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
