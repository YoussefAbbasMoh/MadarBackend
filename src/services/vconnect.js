const crypto = require('crypto');
const { VConnectHttp } = require('./vconnectHttp');
const env = require('../config/env');

const DEFAULT_BASE = 'https://v.cloudapi.vconnct.me/api/v4';

/** @type {VConnectHttp | null} */
let http;

function configured() {
  const key = env.vconnectApiKey?.trim();
  const secret = env.vconnectSecretKey?.trim();
  const project = env.vconnectProjectId?.trim();
  return Boolean(key && secret && project);
}

function getHttp() {
  if (!configured()) return null;
  if (!http) {
    http = new VConnectHttp({
      apiKey: env.vconnectApiKey.trim(),
      secretKey: env.vconnectSecretKey.trim(),
      baseUrl: (env.vconnectApiUrl || DEFAULT_BASE).replace(/\/+$/, ''),
    });
  }
  return http;
}

/** @returns {{ rooms: object, recordings: object } | null} */
function getApi() {
  const h = getHttp();
  if (!h) return null;
  return {
    rooms: {
      createScheduleVideoRoom: (body) => h.post('rooms/create_schedule_video_room', body),
      createInvitationLink: (body) => h.post('rooms/create_invitation_link', body),
      getActiveRoomInfo: (roomId) => h.get('rooms/get_active_room_info', { room_id: roomId }),
      startScheduledRoom: (body) => h.post('rooms/start_schedule_room', body),
      endRoom: (roomId) => h.post('rooms/end_room', { room_id: roomId }),
    },
    recordings: {
      getRecording: async (roomId) => {
        const root = await h.get('recordings/get_record', { room_id: roomId });
        return root && typeof root === 'object' && 'data' in root ? root.data : root;
      },
    },
  };
}

/**
 * V-Cloud expects `start_at` as `YYYY-MM-DDTHH:MM` (no seconds, no `Z`).
 * @param {Date} d
 */
function formatStartAtForVConnect(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

function stubRoom(payload) {
  const id = crypto.randomBytes(8).toString('hex');
  return {
    roomId: id,
    hostUrl: `${env.publicWebUrl || 'https://app.example.com'}/live/host/${id}?token=stub`,
    participantUrl: `${env.publicWebUrl || 'https://app.example.com'}/live/join/${id}?token=stub`,
    session: payload,
  };
}

/**
 * @param {{ title: string, scheduledAt: string|Date, durationMinutes?: number, maxParticipants?: number, hostUserId?: string }} payload
 */
async function createRoom(payload) {
  const c = getApi();
  if (!c) return stubRoom(payload);

  const { title, scheduledAt, durationMinutes, maxParticipants, hostUserId } = payload;
  const clientRoomId = `lms-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) {
    const e = new Error('Invalid scheduledAt');
    e.status = 400;
    throw e;
  }

  const durMin = Math.max(15, Number(durationMinutes) || 60);
  const emptyTimeout = Math.max(300, durMin * 60);
  const maxP = Math.min(500, Math.max(2, Number(maxParticipants) || 100));

  const res = await c.rooms.createScheduleVideoRoom({
    project_id: env.vconnectProjectId.trim(),
    client_room_id: clientRoomId,
    name: title,
    start_at: formatStartAtForVConnect(start),
    empty_timeout: emptyTimeout,
    max_participants: maxP,
    metadata: {
      room_title: title,
      welcome_message: 'Welcome to your live session.',
    },
  });

  const roomId = res.room_id;
  if (!roomId) {
    const e = new Error('V-Connect did not return room_id');
    e.status = 502;
    throw e;
  }

  const hostUid = hostUserId ? `${String(hostUserId)}-host` : `${clientRoomId}-host`;
  const guestUid = `${clientRoomId}-guest`;

  let hostUrl = res.final_link || '';
  let participantUrl = res.final_link || '';

  try {
    const hostInv = await c.rooms.createInvitationLink({
      room_id: roomId,
      user_id: hostUid,
      role: 'admin',
    });
    hostUrl = hostInv.invitation_link || hostInv.invitation_url || hostUrl;
  } catch (e) {
    console.warn('[vconnect] host invitation link:', e.message);
  }
  try {
    const partInv = await c.rooms.createInvitationLink({
      room_id: roomId,
      user_id: guestUid,
      role: 'viewer',
    });
    participantUrl = partInv.invitation_link || partInv.invitation_url || participantUrl;
  } catch (e) {
    console.warn('[vconnect] participant invitation link:', e.message);
  }

  return { roomId, hostUrl, participantUrl, room: res };
}

async function getRoom(roomId) {
  const c = getApi();
  if (!c) return { status: 'waiting', participantCount: 0, roomId };
  try {
    const info = await c.rooms.getActiveRoomInfo(roomId);
    const r = info.room || {};
    const count = Number(r.participant_count ?? r.participants ?? r.participantCount ?? 0) || 0;
    return {
      status: String(r.status || 'unknown'),
      participantCount: count,
      roomId,
      room: r,
    };
  } catch {
    return { status: 'waiting', participantCount: 0, roomId };
  }
}

async function updateRoom(roomId, payload) {
  const c = getApi();
  if (!c) return { ok: true, roomId };
  try {
    const name = payload.title || payload.name;
    if (name || payload.scheduledAt) {
      await c.rooms.startScheduledRoom({
        room_id: roomId,
        name: name || undefined,
      });
    }
  } catch (e) {
    console.warn('[vconnect] updateRoom / startScheduledRoom:', e.message);
  }
  return { ok: true, roomId };
}

async function deleteRoom(roomId) {
  const c = getApi();
  if (!c) return { ok: true };
  try {
    await c.rooms.endRoom(roomId);
  } catch (e) {
    console.warn('[vconnect] deleteRoom / endRoom:', e.message);
  }
  return { ok: true };
}

/**
 * Returns a join URL suitable for the LMS join flow (client may open it or embed).
 */
async function participantToken(roomId, { displayName, role }) {
  const c = getApi();
  if (!c) return { joinToken: `stub-${roomId}-${role}` };

  const vRole = role === 'host' ? 'admin' : 'viewer';
  const safeName = String(displayName || 'User').replace(/[^\w-]+/g, '-').slice(0, 40);
  const userId = `${roomId}-${vRole}-${safeName}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const inv = await c.rooms.createInvitationLink({
      room_id: roomId,
      user_id: userId,
      role: vRole,
    });
    const url = inv.invitation_link || inv.invitation_url;
    if (url) return { joinToken: url };
  } catch (e) {
    console.warn('[vconnect] participantToken:', e.message);
  }
  return { joinToken: `stub-${roomId}-${role}` };
}

async function recording(roomId) {
  const c = getApi();
  if (!c) return { recordingUrl: null, duration: 0, size: 0, roomId };
  try {
    const data = await c.recordings.getRecording(roomId);
    const raw = data && data.url != null ? String(data.url) : '';
    const recordingUrl = raw ? raw.split(',')[0].trim() : null;
    return { recordingUrl, duration: 0, size: 0, roomId };
  } catch {
    return { recordingUrl: null, duration: 0, size: 0, roomId };
  }
}

module.exports = {
  createRoom,
  getRoom,
  updateRoom,
  deleteRoom,
  participantToken,
  recording,
  configured,
};
