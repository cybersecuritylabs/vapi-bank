const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9004;
app.use(express.json());

// VULNERABLE: Weak JWT secret — easily brute-forced
const JWT_SECRET = 's3cret';

const users = [
  { id: 1, username: 'developer', password: 'dev2024', name: 'Dev User', role: 'user' },
  { id: 2, username: 'admin', password: 'Sv@dm1n!Pr0d', name: 'Admin', role: 'admin' },
];

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user: { username: user.username, name: user.name, role: user.role } });
});

app.get('/api/user/profile', requireAuth, (req, res) => {
  res.json({ username: req.user.sub, name: req.user.name, role: req.user.role });
});

app.get('/api/user/keys', requireAuth, (req, res) => {
  res.json({ keys: [
    { id: 'key-001', name: 'Development API Key', prefix: 'dev_sk_...a3f', created: '2024-09-01', status: 'active' },
    { id: 'key-002', name: 'Staging API Key', prefix: 'stg_sk_...b7e', created: '2024-10-15', status: 'active' },
  ]});
});

// Admin-only endpoint
app.get('/api/admin/vault', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required. Your role: ' + req.user.role });
  }
  res.json({
    vault: {
      masterKey: 'aes-256-gcm-prod-key-xxx',
      dbCredentials: 'postgresql://admin:****@vault-db:5432/secrets',
      flag: 'VBANK{jwt_w34k_s3cr3t_f0rg3ry}',
    }
  });
});

app.get('/api/admin/logs', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  res.json({ logs: [
    { timestamp: '2024-12-01T10:30:00Z', event: 'vault.access', user: 'admin' },
    { timestamp: '2024-12-01T09:15:00Z', event: 'key.rotate', user: 'admin' },
  ]});
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-04] SecureVault API Gateway on port ${PORT}`));
