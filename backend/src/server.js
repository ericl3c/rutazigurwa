const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000',
  'https://rutazigurwa-5cpx.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));