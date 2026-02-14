const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9005;
app.use(express.json());
app.use(cookieParser());

const sessions = {};
const accounts = {
  sender:   { username: 'sender',   password: 'quick2024', name: 'Alex Rivera', balance: 1000, totalTransferred: 0 },
  receiver: { username: 'receiver', password: 'recv2024',  name: 'Pat Morgan',  balance: 0,    totalTransferred: 0 },
};

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }
function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Authentication required' });
  req.account = accounts[s.username];
  req.sessionData = s;
  next();
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const acc = accounts[username];
  if (!acc || acc.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  const sid = crypto.randomBytes(24).toString('hex');
  sessions[sid] = { username };
  res.cookie('session', sid, { httpOnly: true });
  res.json({ user: { name: acc.name, username: acc.username } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session; if (sid) delete sessions[sid];
  res.clearCookie('session').json({ message: 'Logged out' });
});

app.get('/api/account', requireAuth, (req, res) => {
  const a = req.account;
  const response = { name: a.name, username: a.username, balance: a.balance, totalTransferred: a.totalTransferred };
  if (a.totalTransferred > 5000) {
    response.flag = 'VBANK{r4c3_c0nd1t10n_d0ubl3_sp3nd}';
  }
  res.json(response);
});

// VULNERABLE: Race condition — async delay between balance check and deduction
app.post('/api/transfer', requireAuth, (req, res) => {
  const { to, amount } = req.body;
  if (!to || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid transfer parameters' });

  const sender = req.account;
  const receiver = accounts[to];
  if (!receiver) return res.status(404).json({ error: 'Recipient not found' });
  if (sender.username === to) return res.status(400).json({ error: 'Cannot transfer to yourself' });

  // Read balance (snapshot before async gap)
  const currentBalance = sender.balance;
  if (currentBalance < amount) {
    return res.status(400).json({ error: 'Insufficient funds', balance: currentBalance });
  }

  // Simulated processing delay — creates the race window
  setTimeout(() => {
    sender.balance -= amount;
    sender.totalTransferred += amount;
    receiver.balance += amount;

    res.json({
      message: 'Transfer successful',
      transactionId: 'QT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      amount,
      newBalance: sender.balance,
      totalTransferred: sender.totalTransferred,
    });
  }, 100);
});

app.get('/api/recipient', requireAuth, (req, res) => {
  res.json({ available: Object.keys(accounts).filter(u => u !== req.sessionData.username).map(u => ({ username: u, name: accounts[u].name })) });
});

// Reset endpoint for retrying
app.post('/api/reset', requireAuth, (req, res) => {
  accounts.sender.balance = 1000;
  accounts.sender.totalTransferred = 0;
  accounts.receiver.balance = 0;
  accounts.receiver.totalTransferred = 0;
  res.json({ message: 'Accounts reset to initial state' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-05] QuickTransfer Payments on port ${PORT}`));
