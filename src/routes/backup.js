const express = require('express');
const { backupTable, listBackups } = require('../utils/backup');

const router = express.Router();

router.post('/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await backupTable(tableName);
    res.json({
      success: true,
      message: `Table '${tableName}' backed up successfully`,
      data: result
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const backups = listBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
});

module.exports = router;
