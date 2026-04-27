const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const Message = require('../models/Message');
const Course = require('../models/Course');
const { getCourseForUser } = require('../utils/courseAccess');
const { getQueues } = require('../queues');

function roomName(courseId) {
  return `course:${courseId}`;
}

function attachChatServer(httpServer, app) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).lean();
      if (!user) {
        next(new Error('Unauthorized'));
        return;
      }
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_course', async (courseId, cb) => {
      try {
        const course = await getCourseForUser(courseId, socket.user);
        if (!course) {
          cb?.({ ok: false, error: 'Forbidden' });
          return;
        }
        await socket.join(roomName(courseId));
        cb?.({ ok: true });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });

    socket.on('leave_course', async (courseId) => {
      await socket.leave(roomName(courseId));
    });

    socket.on('typing', ({ courseId, typing }) => {
      socket.to(roomName(courseId)).emit('typing', { userId: socket.user._id, typing: Boolean(typing) });
    });

    socket.on('send_message', async (payload, cb) => {
      try {
        const { courseId, content, attachmentUrl, receiverId } = payload || {};
        if (!courseId || !content) {
          cb?.({ ok: false, error: 'courseId and content required' });
          return;
        }
        const course = await getCourseForUser(courseId, socket.user);
        if (!course) {
          cb?.({ ok: false, error: 'Forbidden' });
          return;
        }
        const msg = await Message.create({
          senderId: socket.user._id,
          receiverId: receiverId || null,
          courseId,
          content,
          attachmentUrl,
        });
        await msg.populate('senderId', 'name role email');
        const doc = msg.toObject();
        io.to(roomName(courseId)).emit('message', doc);
        try {
          await getQueues().inapp.add('inapp', { userId: socket.user._id, courseId, messageId: msg._id });
        } catch (e) {
          console.warn('[chat.send_message] inapp queue skipped:', e.message);
        }
        cb?.({ ok: true, message: doc });
      } catch (e) {
        cb?.({ ok: false, error: e.message });
      }
    });
  });

  app.set('io', io);
  return io;
}

module.exports = { attachChatServer, roomName };
