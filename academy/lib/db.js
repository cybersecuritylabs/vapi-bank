const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    const initial = { users: [], progress: [], certificates: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  findUserByEmail(email) {
    return load().users.find(u => u.email === email);
  },

  findUserById(id) {
    return load().users.find(u => u.id === id);
  },

  findUserByUsername(username) {
    return load().users.find(u => u.username === username);
  },

  addUser(user) {
    const db = load();
    db.users.push(user);
    save(db);
    return user;
  },

  getProgress(userId) {
    return load().progress.filter(p => p.userId === userId);
  },

  getProgressEntry(userId, labId) {
    return load().progress.find(p => p.userId === userId && p.labId === labId);
  },

  upsertProgress(userId, labId, data) {
    const db = load();
    const idx = db.progress.findIndex(p => p.userId === userId && p.labId === labId);
    if (idx >= 0) {
      db.progress[idx] = { ...db.progress[idx], ...data };
    } else {
      db.progress.push({ userId, labId, ...data });
    }
    save(db);
  },

  getCertificate(userId) {
    return load().certificates.find(c => c.userId === userId);
  },

  addCertificate(cert) {
    const db = load();
    db.certificates.push(cert);
    save(db);
    return cert;
  },
};
