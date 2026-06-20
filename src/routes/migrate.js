const express = require('express');
const fs = require('fs');
const { migrateTable, migrateFromFile } = require('../utils/migrate');
const { BACKUP_DIR } = require('../utils/backup');

const router = express.Router();

router.post('/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await migrateTable(tableName);
    res.json({
      success: true,
      message: `Table '${tableName}' migrated from ${result.source.database} to ${result.target.database}`,
      data: result
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

router.post('/file/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const result = await migrateFromFile(fileName, fs, BACKUP_DIR);
    res.json({
      success: true,
      message: `Backup '${fileName}' migrated to ${result.target.database}`,
      data: result
    });
  } catch (error) {
    console.error('File migration error:', error);
    res.status(500).json({
      success: false,
      message: 'File migration failed',
      error: error.message
    });
  }
});

module.exports = router;
