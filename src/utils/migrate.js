const { pool, targetPool, sourceConfig, targetConfig } = require('../config/db');
const { escapeValue } = require('./backup');

async function getTableSchemaFromSource(tableName) {
  const [rows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
  return rows[0]['Create Table'];
}

async function getTableColumnsFromSource(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map(row => row.Field);
}

async function getTableDataFromSource(tableName) {
  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
  return rows;
}

async function migrateTable(tableName) {
  const schema = await getTableSchemaFromSource(tableName);
  const columns = await getTableColumnsFromSource(tableName);
  const data = await getTableDataFromSource(tableName);

  const connection = await targetPool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    await connection.query(schema);

    if (data.length > 0) {
      const columnList = columns.map(c => `\`${c}\``).join(', ');
      const batchSize = 500;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const valueRows = batch.map(row => {
          const values = columns.map(col => escapeValue(row[col]));
          return `(${values.join(', ')})`;
        });
        const sql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES ${valueRows.join(', ')}`;
        await connection.query(sql);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    return {
      tableName,
      recordCount: data.length,
      source: {
        host: sourceConfig.host,
        port: sourceConfig.port,
        database: sourceConfig.database
      },
      target: {
        host: targetConfig.host,
        port: targetConfig.port,
        database: targetConfig.database
      },
      migratedAt: new Date().toISOString()
    };
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}

async function migrateFromFile(fileName, fsModule, backupDir) {
  const filePath = require('path').join(backupDir, fileName);
  if (!fsModule.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${fileName}`);
  }
  if (!fileName.endsWith('.sql')) {
    throw new Error('Invalid backup file: must be a .sql file');
  }

  const sqlContent = fsModule.readFileSync(filePath, 'utf8');
  const tableMatch = sqlContent.match(/^-- Backup of table: (.+)$/m);
  if (!tableMatch) {
    throw new Error('Cannot determine table name from backup file');
  }
  const tableName = tableMatch[1].trim();

  const connection = await targetPool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );
    if (rows[0].cnt > 0) {
      await connection.query(`TRUNCATE TABLE \`${tableName}\``);
    }

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
      source: {
        host: sourceConfig.host,
        port: sourceConfig.port,
        database: sourceConfig.database
      },
      target: {
        host: targetConfig.host,
        port: targetConfig.port,
        database: targetConfig.database
      },
      migratedAt: new Date().toISOString()
    };
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { migrateTable, migrateFromFile };
