const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Data ───────────────────────────────────────────────────────── */
const users = {
  'usr-001': { id: 'usr-001', username: 'trader', password: 'trade2024', email: 'trader@cryptotrade.io', role: 'trader', balance: 5000 },
  'usr-002': { id: 'usr-002', username: 'whale', password: 'W#al3_Deep!', email: 'whale@cryptotrade.io', role: 'whale', balance: 2500000 },
  'usr-003': { id: 'usr-003', username: 'admin', password: 'X!9v_Km#2$pQ_Adm', email: 'admin@cryptotrade.io', role: 'admin', balance: 0 }
};

const adminToken = 'ct_admin_' + Buffer.from('CryptoTrade-Internal-2024').toString('base64');
const FLAG = 'VBANK{ch41n3d_ssrf_t0_4dm1n_pwn}';

const markets = [
  { pair: 'BTC/USDT', price: 67234.50, change24h: 2.34 },
  { pair: 'ETH/USDT', price: 3456.78, change24h: -1.22 },
  { pair: 'SOL/USDT', price: 178.90, change24h: 5.67 },
  { pair: 'XRP/USDT', price: 0.6234, change24h: -0.45 },
  { pair: 'ADA/USDT', price: 0.4567, change24h: 3.21 }
];

const webhooks = [];
let sessions = {};

/* ─── Auth ────────────────────────────────────────────────────────── */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const sid = 'sess_' + Math.random().toString(36).substring(2);
  sessions[sid] = user.id;
  res.cookie('session', sid, { httpOnly: true });
  res.json({ user: { id: user.id, username: user.username, role: user.role, balance: user.balance } });
});

app.post('/api/auth/logout', (req, res) => {
  delete sessions[req.cookies.session];
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

function getUser(req) {
  const sid = req.cookies?.session;
  if (!sid || !sessions[sid]) return null;
  return users[sessions[sid]] || null;
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

/* ─── Public API ──────────────────────────────────────────────────── */
app.get('/api/markets', (req, res) => {
  res.json({ markets });
});

app.get('/api/portfolio', requireAuth, (req, res) => {
  res.json({
    portfolio: {
      username: req.user.username,
      balance: req.user.balance,
      role: req.user.role
    }
  });
});

/* ─── Verbose Error Disclosure (Step 1) ───────────────────────────── */
app.get('/api/trade/history', requireAuth, (req, res) => {
  const { from, to } = req.query;
  try {
    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) throw new Error('Invalid date format');
    }
    /* VULNERABILITY: The error response includes internal system information */
    res.json({ trades: [], message: 'No trade history found' });
  } catch (err) {
    res.status(400).json({
      error: 'Failed to process trade history request',
      debug: {
        message: err.message,
        stack: err.stack,
        internal_endpoints: {
          admin_panel: 'http://localhost:9010/internal/admin',
          config: 'http://localhost:9010/internal/config',
          health: 'http://localhost:9010/internal/health'
        },
        note: 'Internal endpoints accessible only from localhost'
      }
    });
  }
});

/* Trigger verbose error intentionally */
app.post('/api/trade/execute', requireAuth, (req, res) => {
  const { pair, amount, side } = req.body;
  if (!pair || !amount || !side) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['pair', 'amount', 'side'],
      debug: {
        server_info: {
          node_version: process.version,
          internal_api: 'http://localhost:9010/internal',
          admin_secret_header: 'X-Internal-Token'
        }
      }
    });
  }
  const market = markets.find(m => m.pair === pair);
  if (!market) return res.status(404).json({ error: 'Market pair not found' });
  const total = market.price * amount;
  if (side === 'buy' && total > req.user.balance) return res.status(400).json({ error: 'Insufficient balance' });
  res.json({ trade: { pair, amount, side, price: market.price, total, status: 'executed' } });
});

/* ─── Webhook (Step 2 — SSRF) ─────────────────────────────────── */
app.post('/api/webhooks', requireAuth, (req, res) => {
  const { url, event } = req.body;
  if (!url) return res.status(400).json({ error: 'Webhook URL required' });

  const webhook = {
    id: 'wh_' + Math.random().toString(36).substring(2),
    url,
    event: event || 'trade.executed',
    userId: req.user.id,
    created: new Date().toISOString()
  };
  webhooks.push(webhook);
  res.json({ webhook, message: 'Webhook registered' });
});

app.get('/api/webhooks', requireAuth, (req, res) => {
  res.json({ webhooks: webhooks.filter(w => w.userId === req.user.id) });
});

app.post('/api/webhooks/:id/test', requireAuth, (req, res) => {
  const webhook = webhooks.find(w => w.id === req.params.id && w.userId === req.user.id);
  if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

  /* VULNERABILITY: SSRF — no URL validation, server makes request to user-supplied URL */
  const targetUrl = new URL(webhook.url);
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: targetUrl.pathname + targetUrl.search,
    method: 'GET',
    timeout: 5000
  };

  const proxyReq = http.request(options, proxyRes => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        /* Leak the full response back to attacker */
        res.json({
          test: 'completed',
          statusCode: proxyRes.statusCode,
          response: parsed
        });
      } catch {
        res.json({
          test: 'completed',
          statusCode: proxyRes.statusCode,
          response: body.substring(0, 500)
        });
      }
    });
  });
  proxyReq.on('error', err => {
    res.status(502).json({ error: 'Webhook test failed', detail: err.message });
  });
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Webhook test timeout' });
  });
  proxyReq.end();
});

/* ─── Internal Endpoints (Step 3 — Target) ────────────────────── */
app.get('/internal/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/internal/config', (req, res) => {
  /* Leak the admin token via internal-only config endpoint */
  res.json({
    service: 'CryptoTrade Exchange',
    version: '3.2.1',
    admin_token: adminToken,
    database: 'mongodb://db:27017/cryptotrade',
    redis: 'redis://cache:6379'
  });
});

app.get('/internal/admin', (req, res) => {
  /* This endpoint requires the internal admin token */
  const token = req.headers['x-internal-token'];
  if (token !== adminToken) {
    return res.status(403).json({ error: 'Invalid admin token. Provide X-Internal-Token header.' });
  }
  res.json({
    admin_dashboard: {
      total_users: Object.keys(users).length,
      total_volume: '$12,345,678',
      system_status: 'operational',
      flag: FLAG
    }
  });
});

/* But SSRF GET won't send custom headers. So we also allow token as query param for internal */
app.get('/internal/admin/backdoor', (req, res) => {
  const token = req.query.token || req.headers['x-internal-token'];
  if (token !== adminToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  res.json({
    message: 'Admin access granted via internal backdoor',
    flag: FLAG,
    users: Object.values(users).map(u => ({ id: u.id, username: u.username, role: u.role, balance: u.balance }))
  });
});

app.listen(9010, '0.0.0.0', () => console.log('[Lab-10 CryptoTrade] Port 9010'));
