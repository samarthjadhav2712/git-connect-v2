const db   = require('../config/db');
const jwt  = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// ── Helpers ─────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const isOtpTestMode = process.env.OTP_TEST_MODE
  ? String(process.env.OTP_TEST_MODE).toLowerCase() === 'true'
  : (process.env.NODE_ENV || 'development') !== 'production';
const mobileToDigits = (mobile) => String(mobile || '').replace(/\D/g, '');

const ensureUserForMobile = async (mobile) => {
  const mobileDigits = mobileToDigits(mobile);
  const { rows: users } = await db.query(
    `SELECT id, name, mobile
     FROM users
     WHERE regexp_replace(mobile, '\\D', '', 'g') = $1
        OR RIGHT(regexp_replace(mobile, '\\D', '', 'g'), 10) = RIGHT($2, 10)
     ORDER BY
       CASE
         WHEN regexp_replace(mobile, '\\D', '', 'g') = $1 THEN 0
         ELSE 1
       END,
       id DESC
     LIMIT 1`,
    [mobileDigits, mobileDigits]
  );

  if (users.length > 0) return users[0];

  if (!isOtpTestMode) return null;

  const { rows: created } = await db.query(
    'INSERT INTO users (mobile, name) VALUES ($1, $2) RETURNING id, name, mobile',
    [mobileDigits, `Test User ${mobileDigits.slice(-4)}`]
  );

  return created[0];
};

const sendOTPviaTwilio = async (mobile, otp) => {
  // Uncomment in production:
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({ body: `Your GIT Connect OTP: ${otp}`, from: process.env.TWILIO_PHONE_NUMBER, to: mobile });
  console.log(`[OTP DEV] Sending ${otp} to ${mobile}`);
};

// ── POST /api/auth/send-otp ─────────────────────────────────
const sendOTP = async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^\+?[0-9]{10,15}$/.test(mobile)) {
    return res.status(400).json({ success: false, message: 'Valid mobile number required' });
  }

  const mobileDigits = mobileToDigits(mobile);

  const user = await ensureUserForMobile(mobile);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: isOtpTestMode
        ? 'User lookup failed unexpectedly in test mode. Check users.mobile values in DB.'
        : 'Mobile number not registered. Contact admin.',
    });
  }

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

  // Invalidate existing OTPs for this mobile
  await db.query(
    `UPDATE otp_store
     SET used = TRUE
     WHERE regexp_replace(mobile, '\\D', '', 'g') = $1 AND used = FALSE`,
    [mobileDigits],
  );

  await db.query(
    'INSERT INTO otp_store (mobile, otp, expires_at, used) VALUES ($1, $2, $3, FALSE)',
    [mobileDigits, otp, expiresAt]
  );

  if (!isOtpTestMode) {
    await sendOTPviaTwilio(mobile, otp);
    return res.json({ success: true, message: 'OTP sent successfully' });
  }

  return res.json({
    success: true,
    message: 'OTP generated in test mode',
    otp,
    mobile: user.mobile,
  });
};

// ── POST /api/auth/verify-otp ───────────────────────────────
const verifyOTP = async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: 'mobile and otp are required' });
  }

  const mobileDigits = mobileToDigits(mobile);

  const { rows } = await db.query(
    `SELECT id FROM otp_store
     WHERE regexp_replace(mobile, '\\D', '', 'g') = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [mobileDigits, otp]
  );

  if (rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
  }

  await db.query('UPDATE otp_store SET used = TRUE WHERE id = $1', [rows[0].id]);

  const user = await ensureUserForMobile(mobile);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Mobile number not registered. Contact admin.' });
  }

  const role = user.role || 'user';

  const token = jwt.sign(
    { id: user.id, mobile: user.mobile, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Return all students linked to this parent
  const { rows: students } = await db.query(
    `SELECT id, name, usn, current_sem, department, scheme, batch_year
     FROM students WHERE user_id = $1`,
    [user.id]
  );

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, mobile: user.mobile, role },
    students,
  });
};

// ── POST /api/auth/admin/login ──────────────────────────────
const adminLogin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'username and password required' });
  }

  const { rows } = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
  if (rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const admin = rows[0];
  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({
    success: true,
    token,
    admin: { id: admin.id, username: admin.username },
  });
};

module.exports = { sendOTP, verifyOTP, adminLogin };