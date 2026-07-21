import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getDb } from '../utils/firebase.js';

export const botAuth = async (req: any, res: any, next: any) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      const configuredKey = process.env.BOT_API_KEY;
      
      if (!configuredKey) {
          console.warn("[botAuth] BOT_API_KEY environment variable is missing.");
          return res.status(500).json({ error: "Server Configuration Error" });
      }

      if (apiKey !== configuredKey) {
        return res.status(401).json({ error: "Unauthorized. Invalid Bot API Key." });
      }
      next();
    } catch (e) {
       res.status(500).json({ error: "Internal Auth Error" });
    }
};
