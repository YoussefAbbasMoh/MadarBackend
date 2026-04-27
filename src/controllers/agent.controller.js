const crypto = require('crypto');
const AgentSession = require('../models/AgentSession');
const { verifyAgentPayload } = require('../utils/agentHmac');
const { getQueues } = require('../queues');

async function register(req, res) {
  const { deviceFingerprint } = req.body;
  if (!deviceFingerprint) {
    res.status(400).json({ error: 'deviceFingerprint required' });
    return;
  }
  if (req.user.role !== 'student') {
    res.status(403).json({ error: 'Only students may register an agent session' });
    return;
  }
  const sessionToken = crypto.randomBytes(32).toString('hex');
  await AgentSession.updateMany({ studentId: req.user._id, status: 'active' }, { $set: { status: 'terminated' } });
  const session = await AgentSession.create({
    studentId: req.user._id,
    deviceFingerprint,
    sessionToken,
    status: 'active',
    heartbeatAt: new Date(),
  });
  res.status(201).json({ sessionToken: session.sessionToken, expiresInHours: 24 });
}

async function heartbeat(req, res) {
  const signature = req.headers['x-agent-signature'];
  if (!verifyAgentPayload(req.body, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  const { sessionToken, threats, videoId } = req.body;
  const session = await AgentSession.findOne({ sessionToken, studentId: req.user._id, status: 'active' });
  if (!session) {
    res.status(401).json({ command: 'STOP', message: 'Invalid session' });
    return;
  }
  session.heartbeatAt = new Date();
  session.activeVideoId = videoId || session.activeVideoId;
  if (Array.isArray(threats) && threats.length) {
    session.threats.push(
      ...threats.slice(0, 10).map((t) => ({
        type: typeof t === 'string' ? t : t.type || 'unknown',
        videoId,
        detectedAt: new Date(),
      }))
    );
  }
  await session.save();
  await getQueues().agentHeartbeat.add('beat', { sessionToken }, { removeOnComplete: true });
  const command = threats && threats.length ? 'PAUSE' : 'PLAY';
  res.json({ command, message: command === 'PAUSE' ? 'Threat detected' : 'ok' });
}

async function event(req, res) {
  const signature = req.headers['x-agent-signature'];
  if (!verifyAgentPayload(req.body, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  const { sessionToken, type, videoId } = req.body;
  await AgentSession.updateOne(
    { sessionToken, studentId: req.user._id },
    { $push: { threats: { type: type || 'event', videoId, detectedAt: new Date() } } }
  );
  res.json({ ok: true });
}

async function terminateSession(req, res) {
  const { sessionToken } = req.body;
  await AgentSession.updateMany(
    { sessionToken, studentId: req.user._id },
    { $set: { status: 'terminated', activeVideoId: null } }
  );
  res.json({ ok: true });
}

async function version(req, res) {
  res.json({ version: '0.1.0', download: { windows: '/api/v1/agent/download/windows', macos: '/api/v1/agent/download/macos' } });
}

async function download(req, res) {
  const os = req.params.os;
  if (!['windows', 'macos'].includes(os)) {
    res.status(400).json({ error: 'Invalid platform' });
    return;
  }
  res.status(503).json({
    error: 'Host installer binaries in Contabo and set AGENT_INSTALL_URL_WINDOWS / AGENT_INSTALL_URL_MACOS',
    placeholder: true,
  });
}

module.exports = { register, heartbeat, event, terminateSession, version, download };
