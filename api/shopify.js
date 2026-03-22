// api/shopify.js — Création produit Shopify (compatible nouveau Dev Dashboard 2026)
// Utilise Client Credentials OAuth — plus besoin de token manuel

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  // ── Clés depuis Vercel Environment Variables (jamais exposées au client)
  const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
  const STORE         = process.env.SHOPIFY_STORE; // ex: nuveria.myshopify.com

  if (!CLIENT_ID || !CLIENT_SECRET || !STORE) {
    return res.status(500).json({ error: 'Variables Shopify manquantes dans Vercel (SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE)' });
  }

  const { title, body_html, price, vendor } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'Le titre du produit est obligatoire' });
  }

  try {
    // ── ÉTAPE 1 : Obtenir un access token via Client Credentials Grant
    const tokenUrl = `https://${STORE}/admin/oauth/access_token`;

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.json().catch(() => ({}));
      console.error('Shopify token error:', tokenErr);
      return res.status(401).json({ 
        error: 'Impossible d\'obtenir un token Shopify. Vérifie ton Client ID et Client Secret dans Vercel.' 
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token Shopify vide — vérifie tes permissions dans le Dev Dashboard' });
    }

    // ── ÉTAPE 2 : Créer le produit avec le token obtenu
    const shopifyUrl = `https://${STORE}/admin/api/2025-01/products.json`;

    const productRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        product: {
          title: title,
          body_html: body_html || '',
          vendor: vendor || 'Ecom Booster',
          product_type: '',
          status: 'draft',
          variants: [{
            price: price || '0',
            inventory_management: null,
            fulfillment_service: 'manual'
          }]
        }
      })
    });

    const data = await productRes.json();

    if (!productRes.ok) {
      const errMsg = data.errors ? JSON.stringify(data.errors) : 'Erreur Shopify ' + productRes.status;
      console.error('Shopify product error:', errMsg);
      return res.status(productRes.status).json({ error: errMsg });
    }

    const product = data.product;
    const productUrl = `https://${STORE}/admin/products/${product.id}`;

    return res.status(200).json({
      success: true,
      product_id: product.id,
      url: productUrl,
      title: product.title
    });

  } catch (err) {
    console.error('Shopify error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};
