const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9006;
app.use(express.json());
app.use(cookieParser());

const sessions = {};
const products = [
  { id: 1, name: 'USB Security Key', price: 29.99, image: 'key' },
  { id: 2, name: 'Encrypted SSD 1TB', price: 149.99, image: 'ssd' },
  { id: 3, name: 'Hardware Wallet', price: 79.99, image: 'wallet' },
  { id: 4, name: 'VPN Router Pro', price: 199.99, image: 'router' },
  { id: 5, name: 'Premium Security Bundle', price: 999.99, image: 'bundle' },
];

const userState = { balance: 50, cart: [], orders: [] };

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }
function requireAuth(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: 'Authentication required' });
  next();
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'shopper' && password === 'shop2024') {
    const sid = crypto.randomBytes(24).toString('hex');
    sessions[sid] = { username };
    res.cookie('session', sid, { httpOnly: true });
    return res.json({ user: { name: 'Demo Shopper', username } });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session; if (sid) delete sessions[sid];
  res.clearCookie('session').json({ message: 'Logged out' });
});

app.get('/api/products', requireAuth, (req, res) => res.json({ products }));

app.get('/api/wallet', requireAuth, (req, res) => res.json({ balance: userState.balance }));

// VULNERABLE: No validation on quantity — accepts negative values
app.post('/api/cart', requireAuth, (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  // No quantity validation!
  const existing = userState.cart.find(c => c.productId === productId);
  if (existing) {
    existing.quantity += quantity;
    if (existing.quantity === 0) userState.cart = userState.cart.filter(c => c.productId !== productId);
  } else {
    userState.cart.push({ productId, name: product.name, price: product.price, quantity });
  }
  res.json({ message: 'Cart updated', cart: userState.cart });
});

app.get('/api/cart', requireAuth, (req, res) => {
  const total = userState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ items: userState.cart, total: Math.round(total * 100) / 100 });
});

app.delete('/api/cart', requireAuth, (req, res) => {
  userState.cart = [];
  res.json({ message: 'Cart cleared' });
});

// VULNERABLE: Processes checkout if total <= balance (negative totals always pass)
app.post('/api/checkout', requireAuth, (req, res) => {
  if (userState.cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  const total = userState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const roundedTotal = Math.round(total * 100) / 100;

  if (roundedTotal > userState.balance) {
    return res.status(400).json({ error: 'Insufficient balance', total: roundedTotal, balance: userState.balance });
  }

  userState.balance -= roundedTotal;
  const order = {
    id: 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    items: [...userState.cart],
    total: roundedTotal,
    date: new Date().toISOString(),
  };

  if (roundedTotal <= 0) {
    order.flag = 'VBANK{bus1n3ss_l0g1c_pr1c3_m4n1p}';
  }

  userState.orders.push(order);
  userState.cart = [];
  res.json({ message: 'Order placed successfully', order });
});

app.get('/api/orders', requireAuth, (req, res) => res.json({ orders: userState.orders }));

// Reset
app.post('/api/reset', requireAuth, (req, res) => {
  userState.balance = 50; userState.cart = []; userState.orders = [];
  res.json({ message: 'Account reset' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-06] ShopAPI E-Commerce on port ${PORT}`));
