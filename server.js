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
// Telegram config
const TELEGRAM_TOKEN = '8720691335:AAFv4b61P8DJ7PMbY-MJklNbk1WIgEvG4ug';
const TELEGRAM_CHAT_ID = '6553332754';

async function sendTelegram(order) {
  const text = `🛒 *Nouvelle commande \\#${order.id}*\n👤 ${order.customer}\n💰 ${order.amount} FCFA\n📦 ${order.product || 'Produit'}`;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

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
let expoTokens = []; 

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

// Expo Push Tokens
app.post('/api/subscribe-expo', (req, res) => {
  const { token } = req.body;
  if(token && !expoTokens.includes(token)) {
    expoTokens.push(token);
    console.log(`📱 Expo token enregistré. Total: ${expoTokens.length}`);
  }
  res.status(201).json({ message: 'Token enregistré' });
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
  await sendTelegram(order);
  res.json({ message: `Notif envoyée à ${sent} appareil(s)` });

  // Envoie aussi via Expo
  if(expoTokens.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expoTokens.map(token => ({
        to: token,
        title: `🛒 Commande #${order.id}`,
        body: `${order.customer} · ${order.amount} FCFA`,
        data: { order }
      })))
    });
  }
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
