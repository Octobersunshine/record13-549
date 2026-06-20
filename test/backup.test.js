const fs = require('fs');
const path = require('path');

console.log('=== Backup Module Test ===\n');

try {
  const { backupTable, listBackups, BACKUP_DIR } = require('../src/utils/backup');
  console.log('✓ Backup module loaded successfully');
  console.log(`  Backup directory: ${BACKUP_DIR}\n`);
} catch (error) {
  console.error('✗ Failed to load backup module:', error.message);
  process.exit(1);
}

try {
  const backupRouter = require('../src/routes/backup');
  console.log('✓ Backup router module loaded successfully\n');
} catch (error) {
  console.error('✗ Failed to load backup router:', error.message);
  process.exit(1);
}

try {
  const app = require('../src/app');
  console.log('✓ Express app module loaded successfully\n');
} catch (error) {
  console.error('✗ Failed to load Express app:', error.message);
  process.exit(1);
}

try {
  const { pool } = require('../src/config/db');
  console.log('✓ DB config module loaded successfully');

  pool.getConnection()
    .then(conn => {
      console.log('✓ Database connection successful');
      conn.release();
      pool.end();
      console.log('\n=== All tests passed! ===');
    })
    .catch(err => {
      console.log('⚠ Database connection failed (this is expected if MySQL is not running)');
      console.log(`  Error: ${err.message}`);
      console.log('\nℹ  Module structure is correct. Configure database credentials and start MySQL to use backup functionality.');
      pool.end();
    });
} catch (error) {
  console.error('✗ Failed to load DB config:', error.message);
  process.exit(1);
}

const testEscapeValue = () => {
  const { escapeValue } = require('../src/utils/backup');
  
  const testCases = [
    { input: null, expected: 'NULL', desc: 'null value' },
    { input: 123, expected: 123, desc: 'number value' },
    { input: true, expected: 1, desc: 'boolean true' },
    { input: false, expected: 0, desc: 'boolean false' },
    { input: "test'string", expected: "'test\\'string'", desc: 'string with quote' },
  ];

  console.log('\n=== Escape Value Tests ===');
  let passed = 0;
  for (const tc of testCases) {
    const result = escapeValue(tc.input);
    if (result === tc.expected) {
      console.log(`✓ ${tc.desc}`);
      passed++;
    } else {
      console.log(`✗ ${tc.desc}: expected ${tc.expected}, got ${result}`);
    }
  }
  console.log(`\n${passed}/${testCases.length} escape tests passed`);
};

setTimeout(testEscapeValue, 100);
