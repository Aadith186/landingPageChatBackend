const express = require('express');
const { Lead } = require('../models');
const {
  findLeadByCallerPhone,
  normalizePhoneForLead,
  isPhoneInputValid,
} = require('../utils/phone');
const { isValidEmailShape } = require('../utils/leadIdentity');

const router = express.Router();

function leadProfileComplete(lead) {
  if (!lead) return false;
  const name = lead.name != null ? String(lead.name).trim() : '';
  const email = lead.email != null ? String(lead.email).trim() : '';
  const phone = lead.phone != null ? String(lead.phone).trim() : '';
  if (!name || name === 'Unknown') return false;
  if (!isValidEmailShape(email)) return false;
  if (!phone || !isPhoneInputValid(phone)) return false;
  return true;
}

/**
 * POST /api/chat/preview-lead
 * Body: { phone }
 * Used by web chat onboarding (before Socket.IO session) to merge returning leads by number.
 */
router.post('/preview-lead', async (req, res) => {
  try {
    const raw = req.body?.phone != null ? String(req.body.phone).trim() : '';
    if (!raw) {
      return res.status(400).json({ ok: false, error: 'phone_required' });
    }
    if (!isPhoneInputValid(raw)) {
      return res.status(400).json({ ok: false, error: 'invalid_phone' });
    }
    const normalized = normalizePhoneForLead(raw);
    const lead = await findLeadByCallerPhone(raw);
    if (!lead) {
      return res.json({
        ok: true,
        phone: normalized,
        leadExists: false,
        profileComplete: false,
        name: null,
        email: null,
      });
    }
    const name = lead.name != null ? String(lead.name).trim() : '';
    const email = lead.email != null ? String(lead.email).trim() : '';
    return res.json({
      ok: true,
      phone: normalized,
      leadExists: true,
      profileComplete: leadProfileComplete(lead),
      name: name && name !== 'Unknown' ? name : null,
      email: isValidEmailShape(email) ? email : null,
    });
  } catch (err) {
    console.error('preview-lead error:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
