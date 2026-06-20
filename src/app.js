const express = require('express');
const backupRouter = require('./routes/backup');
const migrateRouter = require('./routes/migrate');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backup service is running' });
});

app.use('/api/backup', backupRouter);
app.use('/api/migrate', migrateRouter);

module.exports = app;
