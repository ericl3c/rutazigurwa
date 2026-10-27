
const app = require('./app');

const port = process.env.PORT || 4000;

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Family Lottery API listening on port ${port}`);
});

server.on('error', (error) => {
  console.error('Failed to start Family Lottery API:', error.message);
  process.exit(1);
});
