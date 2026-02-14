const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9008;
app.use(express.json());
app.use(cookieParser());

const sessions = {};
const resetTokens = {};
const users = [
  { id: 1, username: 'nurse.jones', password: 'nurse2024', name: 'Nurse Jones', email: 'nurse@medirecord.local', role: 'nurse' },
  { id: 2, username: 'dr.admin', password: 'MedAdm!n2024', name: 'Dr. Admin', email: 'admin@medirecord.local', role: 'admin' },
];

function getSession(req) { const s = req.cookies.session; return s ? sessions[s] : null; }
function requireAuth(req, res, next) {
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

// VULNERABLE: Predictable reset token = MD5(email + unix_timestamp_seconds)
app.post('/api/auth/reset-request', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });

  const timestamp = Math.floor(Date.now() / 1000);
  const token = crypto.createHash('md5').update(email + timestamp).digest('hex');
  resetTokens[token] = { userId: user.id, email, expires: Date.now() + 600000 };

  // In a real app this would send an email — here it's just stored
  console.log(`[Reset Token] User: ${email}, Token: ${token}, Timestamp: ${timestamp}`);

  res.json({ message: 'If the email exists, a reset link has been sent.' });
});

app.post('/api/auth/reset', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'Password too short' });

  const entry = resetTokens[token];
  if (!entry) return res.status(400).json({ error: 'Invalid or expired reset token' });
  if (Date.now() > entry.expires) { delete resetTokens[token]; return res.status(400).json({ error: 'Token expired' }); }

  const user = users.find(u => u.id === entry.userId);
  if (user) user.password = newPassword;
  delete resetTokens[token];

  res.json({ message: 'Password has been reset successfully. You can now log in.' });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ name: req.currentUser.name, role: req.currentUser.role, email: req.currentUser.email });
});

app.get('/api/patients', requireAuth, (req, res) => {
  res.json({ patients: [
    { id: 'P-001', name: 'John Smith', age: 45, ward: 'Cardiology', status: 'admitted' },
    { id: 'P-002', name: 'Jane Doe', age: 38, ward: 'Neurology', status: 'observation' },
    { id: 'P-003', name: 'Bob Wilson', age: 62, ward: 'Orthopedics', status: 'discharged' },
  ]});
});

// Admin dashboard — only accessible by admin role
app.get('/api/admin/dashboard', requireAuth, (req, res) => {
  if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  res.json({
    dashboard: {
      totalPatients: 156,
      activeCases: 42,
      staffOnDuty: 23,
      systemStatus: 'operational',
      flag: 'VBANK{pr3d1ct4bl3_r3s3t_t0k3n}',
    }
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[Lab-08] MediRecord Health Portal on port ${PORT}`));
