const { createProxyMiddleware } = require('http-proxy-middleware');

// Robust proxy for CRA dev server to avoid ECONNREFUSED on localhost vs 127.0.0.1
// Uses REACT_APP_API if set, falls back to 127.0.0.1:8000
module.exports = function(app) {
  const target = process.env.REACT_APP_API || 'http://127.0.0.1:8000';
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      secure: false,
      xfwd: true,
      logLevel: 'warn',
    })
  );
};


