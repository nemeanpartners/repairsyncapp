import type { CapacitorConfig } from '@capacitor/cli';

const hostedServerUrl = 'https://repairsync.ai.studio';
const allowNavigationHosts = Array.from(
  new Set(
    [hostedServerUrl]
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
        'repairsync.ai.studio',
        'accounts.google.com',
        'www.google.com',
        'appleid.apple.com',
      ]),
  ),
);

const config: CapacitorConfig = {
  appId: 'com.repairsyncios.sms',
  appName: 'RepairSync',
  webDir: 'capacitor-web',
  server: {
    url: hostedServerUrl,
    cleartext: false,
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
