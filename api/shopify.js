// api/shopify.js — Création produit Shopify
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { store, token, title, body_html, price, vendor } = req.body || {};
  if (!store || !token || !title) {
    return res.status(400).json({ error: 'store, token et title sont obligatoires' });
  }

  try {
    const shopifyUrl = `https://${store}/admin/api/2024-01/products.json`;

    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
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

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.errors ? JSON.stringify(data.errors) : 'Erreur Shopify ' + response.status;
      console.error('Shopify error:', errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    const product = data.product;
    const productUrl = `https://${store}/admin/products/${product.id}`;

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
