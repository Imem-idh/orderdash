/**
 * OrderDash — Serveur Node.js
 * Reçoit les webhooks de ton plugin et envoie les push notifications
 * 
 * Installation :
 *   npm install express web-push cors body-parser
 *   node server.js
 */

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Sert tes fichiers PWA

// ─── VAPID KEYS (génère les tiennes avec : npx web-push generate-vapid-keys) ───
const VAPID_KEYS = {
  publicKey:  'BOCZaBXqoT_YXLmoVlIo1FvnAjnVRmxYELA1gXiQ8O9sXLMCmzwEjWTgruBi2h9piUbCKgMcpTXDTOpk4AIHRXA',
  privateKey: 'F0llQHcRkKkkCYsAO298XcD_paLYZRXQ0nfWyRuqgcY'
};

webpush.setVapidDetails(
  'mailto:elhadimem5@gmail.com',
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

// ─── STOCKAGE DES SUBSCRIPTIONS ─────────────────────
// En production : utilise une base de données (SQLite, MongoDB, etc.)
let subscriptions = [];

// ─── ENDPOINT : Enregistrer un appareil ─────────────
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
  if(!exists) {
    subscriptions.push(subscription);
    console.log(`📱 Nouvel appareil enregistré. Total: ${subscriptions.length}`);
  }
  res.status(201).json({ message: 'Abonnement enregistré' });
});

// ─── ENDPOINT : Webhook depuis ton plugin ────────────
// Configure ton plugin pour envoyer un POST ici quand une commande arrive
app.post('/api/webhook/new-order', async (req, res) => {
  const order = req.body;
  console.log('📦 Nouvelle commande reçue:', order);

  const payload = JSON.stringify({
    title: `🛒 Commande #${order.id || 'Nouvelle'}`,
    body: `${order.customer || 'Client'} · ${order.amount || ''} FCFA`,
    icon: '/icons/icon-192.png',
    url: '/'
  });

  // Envoie la notif à tous les appareils enregistrés
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, payload).catch(err => {
        // Supprime les abonnements expirés
        if(err.statusCode === 410) {
          subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  res.json({ message: `Notif envoyée à ${sent} appareil(s)` });
});

// ─── ENDPOINT : Test manuel ──────────────────────────
app.post('/api/test-push', async (req, res) => {
  const payload = JSON.stringify({
    title: '🔔 Test OrderDash',
    body: 'Les notifications fonctionnent !',
    icon: '/icons/icon-192.png'
  });

  await Promise.allSettled(subscriptions.map(sub => webpush.sendNotification(sub, payload)));
  res.json({ message: 'Test envoyé !' });
});

app.listen(3000, () => {
  console.log('🚀 OrderDash server running on http://localhost:3000');
  console.log('📋 Endpoints disponibles:');
  console.log('   POST /api/subscribe       → Enregistre un appareil mobile');
  console.log('   POST /api/webhook/new-order → Ton plugin appelle ça');
  console.log('   POST /api/test-push       → Test manuel');
});
