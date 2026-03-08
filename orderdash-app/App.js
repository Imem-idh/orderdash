import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const SERVER = 'https://orderdash-production.up.railway.app';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, pending: 0 });
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();

  useEffect(() => {
    registerForPush();
    notificationListener.current = Notifications.addNotificationReceivedListener(n => {
      const data = n.request.content.data;
      if(data?.order) addOrder(data.order);
    });
    return () => Notifications.removeNotificationSubscription(notificationListener.current);
  }, []);

  async function registerForPush() {
    if(!Device.isDevice) { Alert.alert('Fonctionne uniquement sur appareil réel'); return; }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if(existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if(finalStatus !== 'granted') { Alert.alert('Permission refusée !'); return; }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    setExpoPushToken(token);

    // Enregistre le token sur le serveur
    await fetch(`${SERVER}/api/subscribe-expo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  }

  function addOrder(order) {
    setOrders(prev => [order, ...prev].slice(0, 20));
    setStats(prev => ({
      total: prev.total + 1,
      revenue: prev.revenue + Number(order.amount || 0),
      pending: prev.pending + 1
    }));
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Order<Text style={styles.accent}>Dash</Text></Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>REVENUS AUJOURD'HUI</Text>
        <Text style={styles.revenueAmount}>{stats.revenue.toLocaleString('fr-FR')} FCFA</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Commandes récentes</Text>

      {orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>En attente de commandes...</Text>
          <Text style={styles.emptySubText}>Les nouvelles commandes apparaîtront ici</Text>
        </View>
      ) : orders.map((o, i) => (
        <View key={i} style={styles.orderCard}>
          <View style={styles.orderLeft}>
            <Text style={styles.orderName}>{o.customer}</Text>
            <Text style={styles.orderId}>Commande #{o.id}</Text>
          </View>
          <View style={styles.orderRight}>
            <Text style={styles.orderPrice}>{Number(o.amount).toLocaleString('fr-FR')} F</Text>
            <View style={styles.newBadge}><Text style={styles.newBadgeText}>Nouveau</Text></View>
          </View>
        </View>
      ))}

      {expoPushToken ? (
        <Text style={styles.tokenText}>✅ Notifications activées</Text>
      ) : (
        <Text style={styles.tokenText}>⏳ Activation en cours...</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 50, marginBottom: 24 },
  logo: { fontSize: 24, fontWeight: '900', color: '#f0f0f0' },
  accent: { color: '#c8f135' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1c1c1c', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#35f178' },
  liveText: { color: '#35f178', fontSize: 11, fontWeight: '700' },
  revenueCard: { backgroundColor: '#c8f135', borderRadius: 20, padding: 24, marginBottom: 16 },
  revenueLabel: { fontSize: 11, fontWeight: '600', color: '#0a0a0a', opacity: 0.6, letterSpacing: 1 },
  revenueAmount: { fontSize: 36, fontWeight: '900', color: '#0a0a0a', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#141414', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2a2a2a' },
  statValue: { fontSize: 32, fontWeight: '900', color: '#f0f0f0' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f0f0f0', marginBottom: 12 },
  emptyCard: { backgroundColor: '#141414', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  emptyText: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  emptySubText: { color: '#666', fontSize: 12, marginTop: 6 },
  orderCard: { backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 3, borderLeftColor: '#c8f135' },
  orderLeft: { flex: 1 },
  orderName: { color: '#f0f0f0', fontSize: 13, fontWeight: '600' },
  orderId: { color: '#666', fontSize: 11, marginTop: 3 },
  orderRight: { alignItems: 'flex-end' },
  orderPrice: { color: '#f0f0f0', fontSize: 15, fontWeight: '700' },
  newBadge: { backgroundColor: 'rgba(200,241,53,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
  newBadgeText: { color: '#c8f135', fontSize: 10, fontWeight: '600' },
  tokenText: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 20, marginBottom: 40 },
});