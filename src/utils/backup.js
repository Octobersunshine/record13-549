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
  sqlContent += `SET NAMES utf8mb4;\n\n`;
  sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n\n`;
  sqlContent += `${schema};\n\n`;

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

  sqlContent += '\n-- End of backup\n';

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

module.exports = { backupTable, listBackups, BACKUP_DIR, escapeValue };
