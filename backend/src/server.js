const app = require('./app');
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) { console.error('SESSION_SECRET is required'); process.exit(1); }
app.listen(process.env.PORT || 4000, () => console.log('API listening on', process.env.PORT || 4000));
