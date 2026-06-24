require('dotenv').config();

const path = require('path');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectMongo } = require('./db/mongo');
const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations');
const listingRoutes = require('./routes/listings');
const meRoutes = require('./routes/me');

const app = express();
const port = Number(process.env.MARKETPLACE_API_PORT || process.env.PORT || 4000);

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-secret-change-me';
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'dev-secret-change-me') {
  throw new Error('Set a strong JWT_SECRET before running in production.');
}

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(compression());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 250,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  immutable: true,
  maxAge: '30d'
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'local-marketplace-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/me', meRoutes);

app.use((error, _req, res, _next) => {
  if (error.name === 'ZodError') {
    return res.status(422).json({
      message: 'Validation failed.',
      errors: error.errors.map((item) => ({ field: item.path.join('.'), message: item.message }))
    });
  }

  console.error(error);
  return res.status(500).json({ message: 'Something went wrong.' });
});

async function start() {
  const mongoConnected = await connectMongo();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Marketplace API running on http://localhost:${port}`);
    console.log(mongoConnected ? 'MongoDB connected.' : 'Using local JSON data store.');
  });
}

start().catch((error) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
