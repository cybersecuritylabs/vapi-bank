const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9002;
app.use(express.json());
app.use(cookieParser());

const ADMIN_TOKEN = 'fv-admin-tk-8a3b9c2d1e';
const sessions = {};
const users = [
  { id: 1, username: 'analyst', password: 'analyst2024', name: 'Sarah Mitchell', role: 'analyst', email: 'sarah@finvault.io' },
  { id: 2, username: 'admin', password: 'Fv@dmin!2024', name: 'James Wilson', role: 'administrator', email: 'james@finvault.io' },
  { id: 3, username: 'viewer', password: 'viewer2024', name: 'Mike Torres', role: 'viewer', email: 'mike@finvault.io' },
];

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }
function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Authentication required' });
  req.sessionData = s;
  req.currentUser = users.find(u => u.id === s.userId);
  next();
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const sid = crypto.randomBytes(24).toString('hex');
  sessions[sid] = { userId: user.id };
  res.cookie('session', sid, { httpOnly: true });
  res.json({ user: { id: user.id, name: user.name, role: user.role, email: user.email } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session;
  if (sid) delete sessions[sid];
  res.clearCookie('session').json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
  const u = req.currentUser;
  res.json({ id: u.id, name: u.name, role: u.role, email: u.email });
});

// Regular analyst endpoints
app.get('/api/reports', requireAuth, (req, res) => {
  res.json({ reports: [
    { id: 1, title: 'Q4 Revenue Summary', date: '2024-12-01', status: 'published' },
    { id: 2, title: 'Risk Assessment — Portfolio A', date: '2024-11-15', status: 'draft' },
    { id: 3, title: 'Compliance Audit Results', date: '2024-10-30', status: 'published' },
  ]});
});

// VULNERABLE: Admin endpoints - only check authentication, NOT authorization
app.get('/api/admin/users', requireAuth, (req, res) => {
  res.json({ users: users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, email: u.email })) });
});

// VULNERABLE: Leaks admin token in configuration
app.get('/api/admin/config', requireAuth, (req, res) => {
  res.json({
    appName: 'FinVault',
    version: '3.2.1',
    features: { darkMode: true, notifications: true, twoFactor: false },
    adminToken: ADMIN_TOKEN,
    apiRateLimit: 1000,
  });
});

// VULNERABLE: Role change - requires X-Admin-Token header but doesn't check if requester is admin
app.put('/api/admin/users/:id/role', requireAuth, (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid admin token. Include X-Admin-Token header.' });
  }
  const userId = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (!['analyst', 'administrator', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  res.json({ message: `Role updated to ${role}`, user: { id: user.id, name: user.name, role: user.role } });
});

// Admin secrets - properly checks role
app.get('/api/admin/secrets', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'administrator') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  res.json({
    secrets: [
      { key: 'DB_CONNECTION', value: 'postgresql://prod:****@db.finvault.io:5432/main' },
      { key: 'ENCRYPTION_KEY', value: 'aes-256-gcm-****' },
      { key: 'FLAG', value: 'VBANK{br0k3n_funct10n_l3v3l_4uth}' },
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-02] FinVault Admin Portal on port ${PORT}`));
