const express = require('express');
const db = require('../lib/db');
const LABS = require('../lib/labs-config');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const progress = db.getProgress(req.user.id);
  const completedIds = progress.filter(p => p.status === 'completed').map(p => p.labId);

  const labs = LABS.map(lab => {
    const isUnlocked = lab.id === 1 || completedIds.includes(lab.id - 1);
    const entry = progress.find(p => p.labId === lab.id);
    return {
      id: lab.id,
      title: lab.title,
      appName: lab.appName,
      difficulty: lab.difficulty,
      category: lab.category,
      estimatedTime: lab.estimatedTime,
      unlocked: isUnlocked,
      status: entry ? entry.status : 'not-started',
    };
  });

  res.json({ labs, completedCount: completedIds.length, totalCount: LABS.length });
});

router.get('/:id', authMiddleware, (req, res) => {
  const labId = parseInt(req.params.id, 10);
  const lab = LABS.find(l => l.id === labId);
  if (!lab) return res.status(404).json({ error: 'Lab not found' });

  const progress = db.getProgress(req.user.id);
  const completedIds = progress.filter(p => p.status === 'completed').map(p => p.labId);
  const isUnlocked = lab.id === 1 || completedIds.includes(lab.id - 1);

  if (!isUnlocked) {
    return res.status(403).json({ error: 'Lab is locked. Complete previous labs first.' });
  }

  const entry = progress.find(p => p.labId === labId);
  if (!entry) {
    db.upsertProgress(req.user.id, labId, { status: 'in-progress', startedAt: new Date().toISOString() });
  }

  res.json({
    id: lab.id,
    title: lab.title,
    slug: lab.slug,
    appName: lab.appName,
    port: lab.port,
    difficulty: lab.difficulty,
    category: lab.category,
    estimatedTime: lab.estimatedTime,
    description: lab.description,
    objective: lab.objective,
    hints: lab.hints,
    credentials: lab.credentials,
    unlocked: true,
    status: entry ? entry.status : 'in-progress',
  });
});

router.post('/:id/submit', authMiddleware, (req, res) => {
  const labId = parseInt(req.params.id, 10);
  const lab = LABS.find(l => l.id === labId);
  if (!lab) return res.status(404).json({ error: 'Lab not found' });

  const progress = db.getProgress(req.user.id);
  const completedIds = progress.filter(p => p.status === 'completed').map(p => p.labId);
  const isUnlocked = lab.id === 1 || completedIds.includes(lab.id - 1);

  if (!isUnlocked) {
    return res.status(403).json({ error: 'Lab is locked.' });
  }

  const existing = progress.find(p => p.labId === labId);
  if (existing && existing.status === 'completed') {
    return res.json({ success: true, message: 'Lab already completed.' });
  }

  const { flag } = req.body;
  if (!flag) {
    return res.status(400).json({ error: 'Flag is required' });
  }

  if (flag.trim() !== lab.flag) {
    return res.status(400).json({ error: 'Incorrect flag. Keep trying!' });
  }

  db.upsertProgress(req.user.id, labId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    flag: flag.trim(),
  });

  const allCompleted = LABS.every(l => {
    if (l.id === labId) return true;
    return completedIds.includes(l.id);
  });

  res.json({
    success: true,
    message: `Congratulations! Lab ${labId} completed.`,
    nextLabUnlocked: labId < LABS.length,
    allCompleted,
  });
});

module.exports = router;
