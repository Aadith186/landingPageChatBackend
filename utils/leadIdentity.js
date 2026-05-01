function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmailShape(email) {
  const s = normalizeEmail(email);
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

module.exports = {
  normalizeEmail,
  isValidEmailShape,
};
