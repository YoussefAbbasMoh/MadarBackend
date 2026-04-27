/**
 * Normalize phone input for OTP / lookup so UI variants match seeded E.164 values.
 * Handles common Egypt mobile forms (01… / 1… / 20…) and generic +<digits>.
 */
function normalizePhoneE164(phone) {
  if (phone == null) return '';
  let s = String(phone).trim().replace(/[\s\-\(\)]/g, '');
  if (!s) return '';
  const hasPlus = s.startsWith('+');
  const digits = hasPlus ? s.slice(1).replace(/\D/g, '') : s.replace(/\D/g, '');
  if (!digits) return hasPlus ? '+' : s;
  if (digits.startsWith('20') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('01')) {
    return `+20${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `+20${digits}`;
  }
  return `+${digits}`;
}

module.exports = { normalizePhoneE164 };
