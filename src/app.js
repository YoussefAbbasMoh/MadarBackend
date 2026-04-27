const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { getPrisma } = require('./db/prisma');
const { tenantContext } = require('./middleware/tenantContext');
const { bindTenantQueryScope } = require('./context/tenantQueryScope');
const v1 = require('./routes/v1');
const { errorHandler } = require('./middleware/errorHandler');
require('./models');

const app = express();

if (env.trustProxy === 0) {
  app.set('trust proxy', false);
} else {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

/** MUDAR: subdomain / header → `req.tenant` for data isolation (Phase 1: resolution only). */
app.use(tenantContext);
/** MUDAR: AsyncLocalStorage tenant for Sequelize shim query scoping. */
app.use(bindTenantQueryScope);

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: env.trustProxy === 0 ? { xForwardedForHeader: false } : undefined,
});

// app.use('/api/v1', publicLimiter);
app.use('/api/v1', v1);

app.get('/health', async (req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true, driver: 'postgresql' });
  } catch (e) {
    res.status(503).json({ ok: false, db: false, error: e.message });
  }
});

app.use(errorHandler);

module.exports = app;
