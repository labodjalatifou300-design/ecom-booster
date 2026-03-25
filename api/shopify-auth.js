// api/shopify-auth.js — OAuth Shopify multi-utilisateurs
// /api/shopify-auth?mode=connect  → initie OAuth
// /api/shopify-callback            → reçoit le code de Shopify (URL sans paramètre réservé)

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const APP_URL = process.env.APP_URL || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mode } = req.query;

  // ── MODE connect : initier OAuth
  if (mode === 'connect') {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Nom de boutique manquant' });

    let shopDomain = shop.trim().toLowerCase()
      .replace('https://', '').replace('http://', '').replace(/\/$/, '');
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = shopDomain.replace('.myshopify.com', '') + '.myshopify.com';
    }

    const scopes = 'write_products,read_products';
    const redirectUri = `${APP_URL}/api/shopify-callback`;
    const state = Buffer.from(JSON.stringify({ shop: shopDomain, ts: Date.now() })).toString('base64');
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return res.status(200).json({ success: true, authUrl, shop: shopDomain });
  }

  return res.status(400).json({ error: 'Mode non reconnu. Utilise ?mode=connect' });
};
