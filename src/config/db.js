const mysql = require('mysql2/promise');

const sourceConfig = {
  host: process.env.SOURCE_DB_HOST || 'localhost',
  port: process.env.SOURCE_DB_PORT || 3306,
  user: process.env.SOURCE_DB_USER || 'root',
  password: process.env.SOURCE_DB_PASSWORD || 'password',
  database: process.env.SOURCE_DB_NAME || 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const targetConfig = {
  host: process.env.TARGET_DB_HOST || 'localhost',
  port: process.env.TARGET_DB_PORT || 3306,
  user: process.env.TARGET_DB_USER || 'root',
  password: process.env.TARGET_DB_PASSWORD || 'password',
  database: process.env.TARGET_DB_NAME || 'staging',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(sourceConfig);
const targetPool = mysql.createPool(targetConfig);

function createPoolFromConfig(config) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

module.exports = { pool, targetPool, sourceConfig, targetConfig, createPoolFromConfig };
