const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9003;
app.use(express.json());
app.use(cookieParser());

const sessions = {};
const users = [
  {
    id: 1, email: 'user@cloudpay.io', password: 'wallet2024', name: 'Demo User', phone: '+1-555-0100',
    wallet: { balance: 100, currency: 'USD' },
    settings: {
      notifications: true,
      theme: 'light',
      limits: { daily_transfer: 1000, credit_line: 500 },
    },
  },
];

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }
function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Authentication required' });
  req.currentUser = users.find(u => u.id === s.userId);
  next();
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const sid = crypto.randomBytes(24).toString('hex');
  sessions[sid] = { userId: user.id };
  res.cookie('session', sid, { httpOnly: true });
  res.json({ user: { name: user.name, email: user.email } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session;
  if (sid) delete sessions[sid];
  res.clearCookie('session').json({ message: 'Logged out' });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const u = req.currentUser;
  res.json({ name: u.name, email: u.email, phone: u.phone, settings: { notifications: u.settings.notifications, theme: u.settings.theme } });
});

// VULNERABLE: Deep merges entire request body into user object
app.put('/api/profile', requireAuth, (req, res) => {
  const u = req.currentUser;
  const allowed = req.body;
  deepMerge(u, allowed);
  res.json({ message: 'Profile updated', profile: { name: u.name, email: u.email, phone: u.phone } });
});

app.get('/api/wallet', requireAuth, (req, res) => {
  const u = req.currentUser;
  res.json({ balance: u.wallet.balance, currency: u.wallet.currency, creditLine: u.settings.limits.credit_line, dailyLimit: u.settings.limits.daily_transfer });
});

// Credit draw endpoint —  draws from credit line
app.post('/api/wallet/credit', requireAuth, (req, res) => {
  const u = req.currentUser;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (amount > u.settings.limits.credit_line) return res.status(400).json({ error: `Amount exceeds credit line of $${u.settings.limits.credit_line}` });

  u.wallet.balance += amount;
  const response = { message: 'Credit drawn successfully', newBalance: u.wallet.balance, amount };
  if (u.wallet.balance > 50000) {
    response.flag = 'VBANK{m4ss_4ss1gn_h1dd3n_pr0p3rty}';
  }
  res.json(response);
});

app.post('/api/wallet/transfer', requireAuth, (req, res) => {
  const u = req.currentUser;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (amount > u.wallet.balance) return res.status(400).json({ error: 'Insufficient balance' });
  if (amount > u.settings.limits.daily_transfer) return res.status(400).json({ error: 'Exceeds daily transfer limit' });
  u.wallet.balance -= amount;
  res.json({ message: 'Transfer successful', newBalance: u.wallet.balance });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-03] CloudPay Wallet on port ${PORT}`));
