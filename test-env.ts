import dotenv from 'dotenv';
dotenv.config();
console.log('Subdomain:', process.env.REPAIRSHOPR_SUBDOMAIN);
console.log('API Key start:', process.env.REPAIRSHOPR_API_KEY?.substring(0, 5));
