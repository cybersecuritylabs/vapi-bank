const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9007;
app.use(express.json());
app.use(cookieParser());

const INTERNAL_API_KEY = 'ds_internal_key_9x4k2m7p_admin';
const sessions = {};

const users = [
  { id: 1, username: 'viewer', password: 'view2024', name: 'Casey Lee', role: 'viewer' },
  { id: 2, username: 'admin', password: 'DSadm!nPr0d', name: 'Admin', role: 'admin' },
];

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }

function requireAuth(req, res, next) {
  // Check internal API key first
  const apiKey = req.headers['x-api-key'] || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (apiKey === INTERNAL_API_KEY) {
    req.currentUser = { role: 'admin', name: 'Internal Service' };
    return next();
  }
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Authentication required' });
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
  res.json({ user: { name: user.name, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies.session; if (sid) delete sessions[sid];
  res.clearCookie('session').json({ message: 'Logged out' });
});

// VULNERABLE: Leaks internal API key in response headers
app.get('/api/reports', requireAuth, (req, res) => {
  res.set('X-Request-Id', crypto.randomBytes(8).toString('hex'));
  res.set('X-Debug-Key', INTERNAL_API_KEY);  // Debug header left in production
  res.set('X-Powered-By', 'DataStream/3.1');
  res.json({ reports: [
    { id: 1, title: 'Monthly Active Users', date: '2024-12-01', type: 'metrics', status: 'ready' },
    { id: 2, title: 'Revenue Analytics Q4', date: '2024-11-15', type: 'financial', status: 'ready' },
    { id: 3, title: 'API Usage Trends', date: '2024-10-30', type: 'usage', status: 'ready' },
  ]});
});

app.get('/api/reports/:id', requireAuth, (req, res) => {
  res.set('X-Debug-Key', INTERNAL_API_KEY);
  res.json({ report: { id: req.params.id, title: 'Sample Report', data: { views: 15234, clicks: 8921, conversions: 342 } } });
});

// Internal endpoints — require admin/internal key access
app.get('/api/internal/users', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied — admin privileges required' });
  res.json({ users: users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role })) });
});

app.get('/api/internal/system', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  res.json({
    system: {
      version: '3.1.4',
      uptime: '42d 7h 23m',
      database: 'connected',
      cache: 'redis://cache:6379',
      flag: 'VBANK{4p1_k3y_l34k_pr1v_3sc}',
    }
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-07] DataStream Analytics on port ${PORT}`));
