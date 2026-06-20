const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function escapeValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  const str = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
  return `'${str}'`;
}

async function getTableSchema(tableName) {
  const [rows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
  return rows[0]['Create Table'];
}

async function getTableData(tableName) {
  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
  return rows;
}

async function getTableColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map(row => row.Field);
}

async function backupTable(tableName) {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
  const fileName = `${tableName}_${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const schema = await getTableSchema(tableName);
  const columns = await getTableColumns(tableName);
  const data = await getTableData(tableName);

  let sqlContent = `-- Backup of table: ${tableName}\n`;
  sqlContent += `-- Generated at: ${new Date().toISOString()}\n`;
  sqlContent += `-- Records: ${data.length}\n\n`;
  sqlContent += `SET NAMES utf8mb4;\n`;
  sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
  sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n\n`;
  sqlContent += `${schema};\n\n`;
  sqlContent += `TRUNCATE TABLE \`${tableName}\`;\n\n`;

  if (data.length > 0) {
    const columnList = columns.map(c => `\`${c}\``).join(', ');
    sqlContent += `LOCK TABLES \`${tableName}\` WRITE;\n`;
    sqlContent += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;

    const valueRows = data.map(row => {
      const values = columns.map(col => escapeValue(row[col]));
      return `  (${values.join(', ')})`;
    });

    sqlContent += valueRows.join(',\n') + ';\n';
    sqlContent += `UNLOCK TABLES;\n`;
  }

  sqlContent += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
  sqlContent += '-- End of backup\n';

  fs.writeFileSync(filePath, sqlContent, 'utf8');

  return {
    fileName,
    filePath,
    tableName,
    recordCount: data.length,
    timestamp: new Date().toISOString()
  };
}

function listBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.sql'))
    .map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        fileName: file,
        size: stats.size,
        createdAt: stats.birthtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return files;
}

function parseTableNameFromBackup(fileName) {
  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^-- Backup of table: (.+)$/m);
  return match ? match[1].trim() : null;
}

async function restoreTable(fileName) {
  ensureBackupDir();

  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${fileName}`);
  }
  if (!fileName.endsWith('.sql')) {
    throw new Error('Invalid backup file: must be a .sql file');
  }

  const tableName = parseTableNameFromBackup(fileName);
  if (!tableName) {
    throw new Error('Cannot determine table name from backup file');
  }

  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );

    if (rows[0].cnt > 0) {
      await connection.query(`TRUNCATE TABLE \`${tableName}\``);
    }

    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await connection.query(statement);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    return {
      fileName,
      tableName,
      restoredAt: new Date().toISOString()
    };
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { backupTable, listBackups, restoreTable, BACKUP_DIR, escapeValue };
