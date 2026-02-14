const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9001;

app.use(express.json());
app.use(cookieParser());

// ── In-memory data ──────────────────────
const sessions = {};
const accounts = [
  { id: 1, accountNumber: 'ACC-1001', name: 'Alice Johnson', username: 'customer1', password: 'password123', balance: 500, transferToken: 'tok_cust1_a8f3e' },
  { id: 2, accountNumber: 'ACC-1002', name: 'Robert Chen', username: 'customer2', password: 'robert2024!', balance: 50000, transferToken: 'tok_cust2_b7d4c' },
  { id: 3, accountNumber: 'ACC-1000', name: 'Admin Reserve', username: 'admin', password: 'Adm!n$ecure99', balance: 1000000, transferToken: 'tok_admin_x9k2m' },
];

function getSession(req) {
  const sid = req.cookies.session;
  return sid ? sessions[sid] : null;
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  req.session = session;
  req.account = accounts.find(a => a.id === session.userId);
  next();
}

// ── Static files ────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth ─────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const account = accounts.find(a => a.username === username && a.password === password);
  if (!account) return res.status(401).json({ error: 'Invalid credentials' });

  const sid = crypto.randomBytes(24).toString('hex');
  sessions[sid] = { userId: account.id, username: account.username };
  res.cookie('session', sid, { httpOnly: true });
  res.json({ message: 'Login successful', account: { name: account.name, accountNumber: account.accountNumber, balance: account.balance } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session;
  if (sid) delete sessions[sid];
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

// ── Account endpoints ────────────────────
app.get('/api/accounts/me', requireAuth, (req, res) => {
  const a = req.account;
  const response = { accountNumber: a.accountNumber, name: a.name, balance: a.balance };
  if (a.balance > 10000 && a.id === 1) {
    response.flag = 'VBANK{ch41n3d_1d0r_t0_4cc0unt_t4k30v3r}';
  }
  // Hint: API docs available
  res.set('X-API-Version', '2.0');
  res.set('Link', '</api/docs>; rel="documentation"');
  res.json(response);
});

// Hidden API documentation endpoint - discoverable via Link header
app.get('/api/docs', (req, res) => {
  res.json({
    version: '2.0',
    endpoints: [
      { method: 'GET', path: '/api/accounts/me', description: 'Get current user account details', auth: 'session' },
      { method: 'GET', path: '/api/accounts/:id', description: 'Get account details by account ID', auth: 'session' },
      { method: 'POST', path: '/api/transfers', description: 'Transfer funds between accounts', auth: 'session', body: { fromAccount: 'string', toAccount: 'string', amount: 'number', transferToken: 'string' } },
      { method: 'GET', path: '/api/transactions', description: 'Get transaction history', auth: 'session' },
    ],
  });
});

// VULNERABLE: IDOR - any authenticated user can view any account by ID
app.get('/api/accounts/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const account = accounts.find(a => a.id === id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  // Exposes transferToken — should not be visible to other users
  res.json({
    id: account.id,
    accountNumber: account.accountNumber,
    name: account.name,
    balance: account.balance,
    transferToken: account.transferToken,
  });
});

// VULNERABLE: Transfer uses transferToken from request (not session-bound)
app.post('/api/transfers', requireAuth, (req, res) => {
  const { fromAccount, toAccount, amount, transferToken } = req.body;
  if (!fromAccount || !toAccount || !amount || !transferToken) {
    return res.status(400).json({ error: 'Missing required fields: fromAccount, toAccount, amount, transferToken' });
  }
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const source = accounts.find(a => a.accountNumber === fromAccount);
  const target = accounts.find(a => a.accountNumber === toAccount);
  if (!source) return res.status(404).json({ error: 'Source account not found' });
  if (!target) return res.status(404).json({ error: 'Target account not found' });

  // Checks transferToken but doesn't verify it belongs to the requesting user
  if (source.transferToken !== transferToken) {
    return res.status(403).json({ error: 'Invalid transfer token' });
  }

  if (source.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

  source.balance -= amount;
  target.balance += amount;

  res.json({
    message: 'Transfer successful',
    transactionId: 'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    from: fromAccount,
    to: toAccount,
    amount,
    newBalance: target.accountNumber === req.account.accountNumber ? target.balance : undefined,
  });
});

app.get('/api/transactions', requireAuth, (req, res) => {
  res.json({ transactions: [
    { id: 'TXN-INIT', date: '2024-01-15', description: 'Initial deposit', amount: 500, type: 'credit' },
  ]});
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Lab-01] NexaPay Digital Bank running on port ${PORT}`);
});
