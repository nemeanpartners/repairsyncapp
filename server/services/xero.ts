import { XeroClient } from 'xero-node';
import { XeroSyncEngine } from '../../xeroSyncEngine.js';

export const xero = new XeroClient({
  clientId: (process.env.XERO_CLIENT_ID || '').trim(),
  clientSecret: (process.env.XERO_CLIENT_SECRET || '').trim(),
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://ais-dev-lb5osczayhuesptlbuidis-781642394561.asia-southeast1.run.app/api/auth/xero/callback'],
  scopes: (process.env.XERO_SCOPES || 'openid profile email accounting.invoices accounting.contacts offline_access').split(' '),
});

// Avoid circular generic DI by directly instantiating
var _xeroEngine: any = null;

export function initXeroEngine(db: any) {
  if (!_xeroEngine) {
    _xeroEngine = new XeroSyncEngine(db, xero);
  }
  return _xeroEngine;
}

export function getXeroEngine() {
  return _xeroEngine;
}
