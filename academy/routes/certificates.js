const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/db');
const LABS = require('../lib/labs-config');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const cert = db.getCertificate(req.user.id);
  if (cert) {
    return res.json({ hasCertificate: true, certificate: cert });
  }

  const progress = db.getProgress(req.user.id);
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const allCompleted = completedCount === LABS.length;

  res.json({
    hasCertificate: false,
    eligible: allCompleted,
    completedCount,
    totalCount: LABS.length,
  });
});

router.post('/generate', authMiddleware, (req, res) => {
  const existing = db.getCertificate(req.user.id);
  if (existing) {
    return res.json({ certificate: existing });
  }

  const progress = db.getProgress(req.user.id);
  const completedCount = progress.filter(p => p.status === 'completed').length;
  if (completedCount < LABS.length) {
    return res.status(403).json({ error: 'Complete all labs to earn your certificate.' });
  }

  const user = db.findUserById(req.user.id);
  const cert = {
    id: `VBANK-CERT-${uuidv4().split('-')[0].toUpperCase()}`,
    userId: req.user.id,
    username: user.username,
    issuedAt: new Date().toISOString(),
    labsCompleted: LABS.length,
    platformName: 'V-API-Bank Academy',
  };

  db.addCertificate(cert);
  res.status(201).json({ certificate: cert });
});

module.exports = router;
