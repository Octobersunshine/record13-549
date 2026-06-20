const express = require('express');
const backupRouter = require('./routes/backup');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backup service is running' });
});

app.use('/api/backup', backupRouter);

module.exports = app;
