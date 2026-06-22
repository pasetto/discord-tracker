process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.API_KEYS = 'test-api-key,another-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.FRONTEND_URL = 'http://localhost:4200';
process.env.TIMEZONE = 'America/Sao_Paulo';
