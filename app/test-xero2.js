const { XeroClient } = require('xero-node');
const x = new XeroClient({});
x.apiCallback('/foobar?code=123').catch(e => console.error(e));
