import { Router } from 'express';
import axios from 'axios';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';

export const zohoRouter = Router();

export function normalizeZohoRegion(region: string) {
  if (!region) return 'com';
  let r = region.toLowerCase().trim().replace(/^\.+/, '');
  
  if (r === 'us') return 'com';
  if (r === 'au') return 'com.au';
  if (r === 'com.au') return 'com.au';
  if (r === 'eu') return 'eu';
  if (r === 'in') return 'in';
  
  return r;
}

export async function getZohoToken(db: any) {
  const snap = await getDoc(doc(db, 'crm_integrations', 'zoho'));
  const data = snap.data();
  if (!data) throw new Error('Zoho not integrated');
  return data;
}

export async function refreshZohoToken(db: any, refreshToken: string, region: string) {
  const normalizedRegion = normalizeZohoRegion(region);
  
  const response = await axios.post(`https://accounts.zoho.${normalizedRegion}/oauth/v2/token`, null, {
    params: {
      refresh_token: refreshToken,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }
  });

  if (response.data && response.data.error) {
    throw new Error(`Zoho token refresh failed: ${response.data.error}`);
  }

  const { access_token } = response.data;
  
  if (!access_token) {
     throw new Error(`Zoho refresh token failed, missing access_token in response: ${JSON.stringify(response.data)}`);
  }

  await updateDoc(doc(db, 'crm_integrations', 'zoho'), {
    access_token,
    updated_at: serverTimestamp()
  });
  return access_token;
}

zohoRouter.get('/api/debug/zoho', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ error: "No DB" });
  try {
    const snap = await getDoc(doc(db, 'crm_integrations', 'zoho'));
    res.json({ exists: snap.exists(), data: snap.data() });
  } catch (e: any) {
    res.status(500).json({ err: e.message });
  }
});

zohoRouter.get('/api/auth/zoho/url', (req, res) => {
  const region = normalizeZohoRegion((process.env.ZOHO_REGION || 'au').trim());
  const clientId = (process.env.ZOHO_CLIENT_ID || '').trim();
  
  const envRedirect = (process.env.ZOHO_REDIRECT_URI || '').trim();
  const protocol = 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const dynamicRedirectUri = envRedirect || `${protocol}://${host}/api/auth/zoho/callback`;
  
  const scope = 'ZohoMail.messages.ALL,ZohoMail.accounts.READ';
  
  if (!clientId) return res.status(500).json({ error: 'Zoho Client ID missing' });

  const params = new URLSearchParams({
    scope: scope,
    client_id: clientId,
    response_type: 'code',
    access_type: 'offline',
    redirect_uri: dynamicRedirectUri,
    prompt: 'consent',
    state: 'zoho_auth_v1'
  });

  const authUrl = `https://accounts.zoho.${region}/oauth/v2/auth?${params.toString()}`;
  console.log(`[AUTH] Login URL for ${region}: ${authUrl}`);
  res.json({ url: authUrl, redirect_uri: dynamicRedirectUri });
});

zohoRouter.get('/api/auth/zoho/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const region = normalizeZohoRegion((process.env.ZOHO_REGION || 'au').trim()); 
  const db = getDb();
  if (!db) return res.status(500).send("DB missing");

  if (error) return res.status(500).send(`Zoho Error: ${error}`);
  
  const envRedirect = (process.env.ZOHO_REDIRECT_URI || '').trim();
  const protocol = 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const dynamicRedirectUri = envRedirect || `${protocol}://${host}/api/auth/zoho/callback`;

  try {
    if (!code) throw new Error('No code provided');

    console.log(`[AUTH] Starting token exchange for ${region}...`);

    const cid = (process.env.ZOHO_CLIENT_ID || '').trim();
    const csec = (process.env.ZOHO_CLIENT_SECRET || '').trim();

    const response = await axios.post(`https://accounts.zoho.${region}/oauth/v2/token`, null, {
      params: {
        code,
        client_id: cid,
        client_secret: csec,
        redirect_uri: dynamicRedirectUri,
        grant_type: 'authorization_code'
      }
    });

    console.log('[AUTH] Token exchange success. Now writing to Firestore...', response.data);

    if (response.data && response.data.error) {
      if (response.data.error === 'invalid_client_secret') {
        throw new Error('Invalid Client Secret. Please check your ZOHO_CLIENT_SECRET environment variable.');
      } else if (response.data.error === 'invalid_client') {
        throw new Error('Invalid Client ID. Please check your ZOHO_CLIENT_ID environment variable.');
      } else if (response.data.error === 'invalid_code') {
        throw new Error('Authorization code expired or invalid. Please try logging in again.');
      }
      throw new Error(`Token exchange failed: ${response.data.error}`);
    }

    if (!response.data || !response.data.access_token) {
      throw new Error(`Token exchange missing access_token. Response: ${JSON.stringify(response.data)}`);
    }

    const docRef = doc(db, 'crm_integrations', 'zoho');
    
    await setDoc(docRef, {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || null, 
      region,
      updated_at: serverTimestamp()
    }, { merge: true });

    res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', integration: 'zoho' }, '*'); window.close();</script></body></html>`);
  } catch (e: any) {
    console.error('Zoho Auth Callback Failed', e);
    const errorMsg = e.response?.data 
      ? (typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data)
      : e.message;

    res.status(500).send(`Authentication flow failed. Error details: ${errorMsg}`);
  }
});

zohoRouter.get('/api/zoho/status', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ status: 'inactive' });
    const snap = await getDoc(doc(db, 'crm_integrations', 'zoho'));
    if (snap.exists()) {
      res.json({ status: 'active' });
    } else {
      res.json({ status: 'inactive' });
    }
  } catch (e) {
    res.json({ status: 'inactive' });
  }
});

zohoRouter.get('/api/zoho/messages', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ data: [] });
    const { customer_email } = req.query;
    if (!customer_email || (customer_email as string).trim() === '') {
      return res.json({ data: [] });
    }
    
    const zohoData = await getZohoToken(db);
    let accessToken = zohoData.access_token;
    const region = normalizeZohoRegion(zohoData.region || 'com');

    try {
      const accRes = await axios.get(`https://mail.zoho.${region}/api/v1/accounts`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      if (!accRes.data.data || accRes.data.data.length === 0) {
         return res.status(404).json({ error: 'No Zoho Mail accounts found' });
      }
      const accountId = accRes.data.data[0].accountId;

      const searchEmail = `"${customer_email}"`;
      const msgResTo = await axios.get(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages/search`, {
        params: { searchKey: `to:${searchEmail}` },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      
      const msgResFrom = await axios.get(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages/search`, {
        params: { searchKey: `from:${searchEmail}` },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });

      let msgsTo = Array.isArray(msgResTo.data.data) ? msgResTo.data.data : [];
      let msgsFrom = Array.isArray(msgResFrom.data.data) ? msgResFrom.data.data : [];
      let all = [...msgsTo, ...msgsFrom];
      
      const uniqueKeys = new Set();
      const mapped = all.filter(m => {
          if (uniqueKeys.has(m.messageId)) return false;
          uniqueKeys.add(m.messageId);
          return true;
      }).map((m: any) => ({
          messageId: m.messageId,
          accountId: accountId,
          subject: m.subject,
          summary: m.summary,
          fromAddress: m.sender,
          toAddress: m.toAddress,
          receivedTime: m.receivedTime,
      }));

      // Sort recent first
      mapped.sort((a, b) => Number(b.receivedTime) - Number(a.receivedTime));

      res.json({ data: mapped.slice(0, 50) });
    } catch (apiErr: any) {
      if (apiErr.response?.status === 401 && zohoData.refresh_token) {
         try {
           accessToken = await refreshZohoToken(db, zohoData.refresh_token, region);
           // Simple retry could happen here but for now just fail and let client retry
           return res.status(401).json({ error: 'Token expired, refreshed. Please retry.' });
         } catch (refErr: any) {
           return res.status(401).json({ error: 'Zoho token refresh failed. Needs re-auth.' });
         }
      }
      throw apiErr;
    }
  } catch (e: any) {
    if (e.message === 'Zoho not integrated') {
      return res.status(400).json({ error: 'Zoho Mail is not connected.' });
    }
    console.error('Zoho Messages Error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch Zoho messages' });
  }
});

zohoRouter.post('/api/zoho/send', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ error: "DB missing" });
    const { toAddress, subject, content } = req.body;
    if (!toAddress || !content) return res.status(400).json({ error: 'Missing toAddress or content' });
    
    let zohoData;
    try {
      zohoData = await getZohoToken(db);
    } catch (e: any) {
      if (e.message === 'Zoho not integrated') {
        // Mock success for preview environments
        console.log('[MOCK] Simulating Zoho email send to:', toAddress);
        return res.json({ success: true, mocked: true, message: "Zoho is not integrated. Email simulated successfully." });
      }
      throw e;
    }

    let accessToken = zohoData.access_token;
    const region = normalizeZohoRegion(zohoData.region || 'com');

    let accRes;
    try {
      accRes = await axios.get(`https://mail.zoho.${region}/api/v1/accounts`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
    } catch (authErr: any) {
      if (authErr.response?.status === 401 && zohoData.refresh_token) {
         console.log('[ZOHO] Token expired for send, refreshing...');
         accessToken = await refreshZohoToken(db, zohoData.refresh_token, region);
         accRes = await axios.get(`https://mail.zoho.${region}/api/v1/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
         });
      } else {
         throw authErr;
      }
    }
    if (!accRes.data.data || accRes.data.data.length === 0) {
       return res.status(404).json({ error: 'No Zoho Mail accounts found' });
    }
    const accountId = accRes.data.data[0].accountId;
    const fromAddress = accRes.data.data[0].primaryEmailAddress;

    let attachments = [];
    if (req.body.attachmentBase64) {
      const b64 = req.body.attachmentBase64.includes(',') ? req.body.attachmentBase64.split(',')[1] : req.body.attachmentBase64;
      const buffer = Buffer.from(b64, 'base64');
      const fName = encodeURIComponent(req.body.attachmentName || 'document.pdf');
      
      const uploadRes = await axios.post(
        `https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages/attachments?fileName=${fName}`,
        buffer,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/octet-stream'
          }
        }
      );
      
      if (uploadRes.data?.data) {
        attachments.push({
          storeName: uploadRes.data.data.storeName,
          attachmentPath: uploadRes.data.data.attachmentPath,
          attachmentName: req.body.attachmentName || 'document.pdf'
        });
      }
    }

    const payload: any = {
        fromAddress,
        toAddress,
        subject: subject || 'No Subject',
        content,
        mailFormat: 'html' // or plaintext
    };
    if (attachments.length > 0) {
      payload.attachments = attachments;
    }

    const sendRes = await axios.post(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages`, payload, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });

    res.json({ success: true, data: sendRes.data });
  } catch (e: any) {
    console.error('Zoho Send Error:', e.response?.data || e.message);
    if (e.message === 'Zoho not integrated') {
      return res.status(400).json({ error: 'Zoho Mail is not connected. Please go to Settings > Integrations to connect your Zoho account.' });
    }
    res.status(500).json({ error: e.response?.data?.message || e.message || 'Failed to send email' });
  }
});
