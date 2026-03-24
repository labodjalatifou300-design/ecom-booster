// api/images.js — Génération 7 images produit via OpenAI DALL-E 3
// Claude génère les prompts optimisés → DALL-E 3 génère les images
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const OPENAI_KEY = process.env.OPENAI_KEY || '';
  const CLAUDE_KEY = process.env.CLAUDE_KEY || '';

  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_KEY manquante dans Vercel Environment Variables' });
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'CLAUDE_KEY manquante dans Vercel Environment Variables' });

  const { type, productName, benefits, reviewText, reviewerName, productDescription } = req.body || {};
  if (!type || !productName) return res.status(400).json({ error: 'type et productName sont obligatoires' });

  try {
    // ETAPE 1 : Claude genere un prompt DALL-E optimise selon le type
    const promptRequest = buildPromptRequest(type, productName, benefits, reviewText, reviewerName, productDescription);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: promptRequest }]
      })
    });

    if (!claudeRes.ok) {
      return res.status(500).json({ error: 'Erreur Claude lors de la generation du prompt' });
    }

    const claudeData = await claudeRes.json();
    const dallePrompt = claudeData.content[0].text.trim();
    console.log('[' + type + '] Prompt DALL-E:', dallePrompt.substring(0, 100));

    // ETAPE 2 : DALL-E 3 genere l'image
    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_KEY
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      })
    });

    if (!dalleRes.ok) {
      const err = await dalleRes.json().catch(() => ({}));
      console.error('DALL-E error:', err);
      return res.status(500).json({ error: 'Erreur DALL-E 3: ' + (err && err.error ? err.error.message : dalleRes.status) });
    }

    const dalleData = await dalleRes.json();
    const imageUrl = dalleData && dalleData.data && dalleData.data[0] ? dalleData.data[0].url : null;

    if (!imageUrl) {
      return res.status(500).json({ error: 'Aucune image generee. Reessaie.' });
    }

    return res.status(200).json({ success: true, url: imageUrl });

  } catch (err) {
    console.error('Image generation error:', err.message);
    return res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

function buildPromptRequest(type, productName, benefits, reviewText, reviewerName, productDescription) {
  const desc = productDescription || productName;
  const benefitsList = (benefits || []).slice(0, 5).join(', ');

  const base = 'Tu es expert en photographie produit e-commerce et design publicitaire. Genere UN SEUL prompt DALL-E 3 en anglais, optimise pour une image professionnelle realiste. PAS de dessin anime. Reponds UNIQUEMENT avec le prompt, rien d\'autre. Maximum 200 mots.';

  if (type === 'clean_background') {
    return base + '\n\nType: Photo produit fond blanc pur style grande marque.\nProduit: ' + productName + '\nDescription: ' + desc + '\n\nPrompt doit creer: fond blanc pur, eclairage studio professionnel, ombres douces, produit centre, qualite commerciale haut de gamme style Apple ou Nike, hyper-realiste 8K.';
  }

  if (type === 'lifestyle') {
    return base + '\n\nType: Photo lifestyle luxe, produit dans cadre africain elegant.\nProduit: ' + productName + '\nDescription: ' + desc + '\n\nPrompt doit creer: interieur moderne luxueux maison africaine urbaine, lumiere naturelle doree, produit utilise naturellement, ambiance aspirationnelle, qualite magazine haut de gamme, photorealiste.';
  }

  if (type === 'benefits') {
    return base + '\n\nType: Image marketing avec benefices du produit.\nProduit: ' + productName + '\nBenefices: ' + benefitsList + '\n\nPrompt doit creer: produit au centre sur fond sombre elegant, entoure de 4-5 points visuels representant les benefices de chaque cote, design graphique moderne style marque premium, lumieres d\'accentuation colorees (dore, orange), tres professionnel.';
  }

  if (type === 'how_to_use') {
    return base + '\n\nType: Guide visuel "Comment utiliser" en etapes.\nProduit: ' + productName + '\nDescription: ' + desc + '\n\nPrompt doit creer: composition 3-4 etapes numerotees montrant utilisation du produit, fond blanc, style infographie premium moderne, couleurs harmonieuses, fleches elegantes entre les etapes.';
  }

  if (type === 'review') {
    return base + '\n\nType: Avis client style Amazon avec profil africain.\nProduit: ' + productName + '\nAvis: "' + (reviewText || 'Excellent produit, ca marche vraiment !') + '"\nNom: ' + (reviewerName || 'Fatoumata K.') + '\n\nPrompt doit creer: photo produit en arriere-plan, carte avis client moderne avec 5 etoiles dorees, photo profil personne africaine souriante, nom client, texte avis en francais, design e-commerce premium fond sombre avec accents dores, realiste et credible.';
  }

  if (type === 'angles') {
    return base + '\n\nType: Produit sous differents angles.\nProduit: ' + productName + '\nDescription: ' + desc + '\n\nPrompt doit creer: 3-4 vues du meme produit depuis differents angles (face, cote, dessus, detail), disposees proprement sur fond blanc, eclairage studio professionnel, style catalogue produit haut de gamme.';
  }

  if (type === 'promo') {
    return base + '\n\nType: Image promotionnelle avec design percutant.\nProduit: ' + productName + '\nDescription: ' + desc + '\n\nPrompt doit creer: produit mis en avant, fond degrade moderne noir vers couleur accentuee (orange ou dore), lumieres dramatiques et dynamiques, ambiance premium et luxueuse, style publicite magazine international, photorealiste et impactant.';
  }

  return base + '\n\nProduit: ' + productName + '\nCree une image produit professionnelle, fond blanc, eclairage studio, style grande marque.';
}
