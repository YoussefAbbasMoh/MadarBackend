const { Sequelize } = require('sequelize');
const env = require('../config/env');
const initModels = require('../models/sequelize/initModels');
const { createPrismaSequelizeShim } = require('./prismaSequelizeShim');

/** @type {Sequelize | null} */
let sequelize = null;
/** @type {ReturnType<initModels> | null} */
let models = null;
/** @type {ReturnType<createPrismaSequelizeShim> | null} */
let shim = null;

function ensure() {
  const url = String(env.databaseUrl || '').trim();
  if (!url) {
    throw new Error('DATABASE_URL is required (PostgreSQL + Sequelize).');
  }
  if (!sequelize) {
    sequelize = new Sequelize(url, {
      dialect: 'postgres',
      logging: false,
      define: { freezeTableName: true, underscored: false },
    });
    models = initModels(sequelize);
    shim = createPrismaSequelizeShim(sequelize, models);
  }
}

function getSequelize() {
  ensure();
  return sequelize;
}

function getModels() {
  ensure();
  return models;
}

/** @deprecated Prefer {@link getModels}; kept for existing `getPrisma()` call sites. */
function getPrisma() {
  ensure();
  return shim;
}

async function disconnectPrisma() {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    models = null;
    shim = null;
  }
}

module.exports = { getSequelize, getModels, getPrisma, disconnectPrisma };
