const backendPort = process.env.BACKEND_PORT || process.env.PORT || '3322';

/** Proxy de desenvolvimento Angular → API Koa (HTTP + WebSocket). */
module.exports = {
  '/api': {
    target: `https://disc.econdos.com.br`,
    // target: `http://localhost:${backendPort}`,
    secure: false,
    changeOrigin: true,
    ws: true,
    cookieDomainRewrite: 'localhost',
    cookiePathRewrite: '/',
  },
};
