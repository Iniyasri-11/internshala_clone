const auth = require('./auth');

module.exports = async (req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'];

  if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
    return next();
  }

  auth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ error: 'Admin access required.' });
  });
};
