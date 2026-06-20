const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Backup endpoint: POST http://localhost:${PORT}/api/backup/:tableName`);
  console.log(`List backups: GET http://localhost:${PORT}/api/backup`);
});
