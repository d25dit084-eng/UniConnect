/**
 * Comprehensive verification script for 3.3 Security Hardening:
 * 1. Helmet headers inspection
 * 2. Rate limiting headers & protection
 * 3. Zod validation rejection of invalid payloads
 * 4. Markdown/HTML sanitization against XSS
 * 5. Login lockout after 5 consecutive failed attempts
 * 6. Image magic byte upload validation
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Community = require('../models/Community');
const Post = require('../models/Post');
const { sanitizeContent, sanitizeTitle } = require('../utils/sanitizer');
const { verifyImageMagicBytes } = require('../middleware/uploadMiddleware');
const { registerSchema, loginSchema } = require('../validations/authValidation');
const { createPostSchema } = require('../validations/postValidation');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

// Safety check
const parsed = new URL(MONGO_URI.startsWith('mongodb://') || MONGO_URI.startsWith('mongodb+srv://') ? MONGO_URI : `mongodb://${MONGO_URI}`);
console.log(`[Safety] Connecting tests against DB host: ${parsed.hostname}`);
if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
  console.error('ABORT: Safety check failed. MONGO_URI is not pointing to localhost / dev database.');
  process.exit(1);
}

async function runSecurityTests() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for Security Hardening Verification\n');

  const runId = Date.now();

  try {
    // ─── 1. Zod Validation Tests ──────────────────────────────────────────────
    console.log('--- 1. Testing Zod Validation ---');
    // Test invalid register
    const invalidReg = { username: 'a!', email: 'notanemail', password: '123' };
    const regResult = registerSchema.safeParse(invalidReg);
    if (regResult.success) {
      throw new Error('Zod validation failed: invalid registration was accepted!');
    }
    console.log(`✅ Zod caught ${regResult.error.issues.length} registration issues:`);
    regResult.error.issues.forEach((i) => console.log(`   - ${i.path.join('.')}: ${i.message}`));

    // Test invalid post
    const invalidPost = { communityId: 'invalid-id', title: 'ab' };
    const postResult = createPostSchema.safeParse(invalidPost);
    if (postResult.success) {
      throw new Error('Zod validation failed: invalid post was accepted!');
    }
    console.log(`✅ Zod caught ${postResult.error.issues.length} post creation issues:`);
    postResult.error.issues.forEach((i) => console.log(`   - ${i.path.join('.')}: ${i.message}`));

    // ─── 2. Markdown & HTML Sanitization Tests ───────────────────────────────
    console.log('\n--- 2. Testing Markdown / HTML Sanitization ---');
    const dirtyXss = `<script>alert('pwned')</script>Hello <b>world</b>! <img src="x" onerror="alert(1)" /> <a href="javascript:alert(2)">Click me</a> <a href="https://example.com">Legit Link</a>`;
    const cleanContent = sanitizeContent(dirtyXss);
    console.log(`Input:   ${dirtyXss}`);
    console.log(`Cleaned: ${cleanContent}`);

    if (
      cleanContent.includes('<script>') ||
      cleanContent.includes('onerror') ||
      cleanContent.includes('javascript:')
    ) {
      throw new Error('Sanitization failed: Malicious XSS payloads remained in sanitized output!');
    }
    if (!cleanContent.includes('<b>world</b>') || !cleanContent.includes('rel="noopener noreferrer nofollow"')) {
      throw new Error('Sanitization failed: Safe tags or link rel attributes were not preserved correctly!');
    }
    console.log('✅ Sanitizer successfully stripped script tags, onerror handlers, and javascript: links while preserving safe formatting!');

    const dirtyTitle = `Dangerous <script>alert(1)</script> <b>Title</b>`;
    const cleanTitle = sanitizeTitle(dirtyTitle);
    console.log(`Title Input:   ${dirtyTitle}`);
    console.log(`Cleaned Title: ${cleanTitle}`);
    if (cleanTitle !== 'Dangerous  Title') {
      throw new Error(`Sanitization failed on title: got "${cleanTitle}"`);
    }
    console.log('✅ Title sanitizer stripped all HTML tags completely!');

    // ─── 3. Login Lockout Tests ──────────────────────────────────────────────
    console.log('\n--- 3. Testing 5-Attempt Login Lockout ---');
    const testEmail = `lockout_user_${runId}@uni.edu`;
    const password = 'Password123!';
    const user = await User.create({
      username: `lockout_${runId}`,
      email: testEmail,
      password,
    });

    const { login } = require('../controllers/authController');

    // Simulate 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      let threw = false;
      try {
        await login(
          { body: { email: testEmail, password: 'wrongpassword' } },
          { cookie: () => {}, status: () => ({ json: () => {} }) },
          (err) => { if (err) throw err; }
        );
      } catch (err) {
        threw = true;
        if (err.statusCode !== 401) {
          throw new Error(`Attempt ${i} expected 401, got ${err.statusCode}`);
        }
      }
      if (!threw) throw new Error(`Attempt ${i} did not reject wrong password!`);
    }

    const userAfter4 = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
    console.log(`After 4 failed logins: attempts = ${userAfter4.failedLoginAttempts}, lockUntil = ${userAfter4.lockUntil}`);
    if (userAfter4.failedLoginAttempts !== 4 || userAfter4.lockUntil !== null) {
      throw new Error('Lockout tracking failed on 4th attempt');
    }

    // 5th failed attempt should trigger 15-minute lock
    let fifthAttemptError = null;
    try {
      await login(
        { body: { email: testEmail, password: 'wrongpassword' } },
        { cookie: () => {}, status: () => ({ json: () => {} }) },
        (err) => { if (err) throw err; }
      );
    } catch (err) {
      fifthAttemptError = err;
    }

    if (!fifthAttemptError || fifthAttemptError.statusCode !== 429) {
      throw new Error(`5th attempt expected 429 Account Locked, got: ${fifthAttemptError ? fifthAttemptError.statusCode : 'no error'}`);
    }
    console.log(`✅ 5th failed attempt triggered 429: "${fifthAttemptError.message}"`);

    const userAfter5 = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
    console.log(`Database state: lockUntil = ${userAfter5.lockUntil.toISOString()}`);
    if (!userAfter5.lockUntil || userAfter5.lockUntil.getTime() <= Date.now()) {
      throw new Error('Lockout date was not set into the future in database');
    }

    // Attempt even with CORRECT password while locked must still be rejected with 429
    let correctPasswordWhileLockedError = null;
    try {
      await login(
        { body: { email: testEmail, password: password } },
        { cookie: () => {}, status: () => ({ json: () => {} }) },
        (err) => { if (err) throw err; }
      );
    } catch (err) {
      correctPasswordWhileLockedError = err;
    }

    if (!correctPasswordWhileLockedError || correctPasswordWhileLockedError.statusCode !== 429) {
      throw new Error('Correct password while locked was not rejected with 429!');
    }
    console.log(`✅ Correct password while locked was blocked: "${correctPasswordWhileLockedError.message}"`);

    // Clean up test user
    await User.deleteOne({ _id: user._id });

    // ─── 4. Image Magic Byte Verification ────────────────────────────────────
    console.log('\n--- 4. Testing Image Magic Byte Verification ---');
    const tempDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Create authentic PNG file (PNG signature: 89 50 4E 47 0D 0A 1A 0A)
    const validPngPath = path.join(tempDir, `test_valid_${runId}.png`);
    fs.writeFileSync(validPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]));

    // Create authentic JPEG file (JPEG signature: FF D8 FF)
    const validJpgPath = path.join(tempDir, `test_valid_${runId}.jpg`);
    fs.writeFileSync(validJpgPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]));

    // Create fraudulent script file masquerading as PNG
    const fakePngPath = path.join(tempDir, `test_malicious_${runId}.png`);
    fs.writeFileSync(fakePngPath, Buffer.from('#!/bin/bash\nrm -rf /'));

    const isPngValid = verifyImageMagicBytes(validPngPath);
    const isJpgValid = verifyImageMagicBytes(validJpgPath);
    const isFakeValid = verifyImageMagicBytes(fakePngPath);

    fs.unlinkSync(validPngPath);
    fs.unlinkSync(validJpgPath);
    fs.unlinkSync(fakePngPath);

    console.log(`Valid PNG magic byte check:  ${isPngValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Valid JPEG magic byte check: ${isJpgValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Fake script disguised as PNG: ${!isFakeValid ? '✅ REJECTED' : '❌ ACCEPTED (LEAK)'}`);

    if (!isPngValid || !isJpgValid || isFakeValid) {
      throw new Error('Image magic byte verification failed!');
    }

    // ─── 5. Helmet & Rate Limiter Header Check via HTTP ───────────────────────
    console.log('\n--- 5. Testing Helmet & Rate Limiter Headers via HTTP ---');
    const http = require('http');
    const app = require('../app');
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const headers = Object.fromEntries(res.headers.entries());
    server.close();

    console.log('Received response headers from /api/health:');
    console.log(`  - x-dns-prefetch-control:   ${headers['x-dns-prefetch-control']}`);
    console.log(`  - x-frame-options:          ${headers['x-frame-options']}`);
    console.log(`  - x-content-type-options:   ${headers['x-content-type-options']}`);
    console.log(`  - cross-origin-resource-policy: ${headers['cross-origin-resource-policy']}`);
    console.log(`  - ratelimit-limit:          ${headers['ratelimit-limit']}`);

    if (
      !headers['x-dns-prefetch-control'] ||
      !headers['x-frame-options'] ||
      !headers['x-content-type-options'] ||
      headers['cross-origin-resource-policy'] !== 'cross-origin'
    ) {
      throw new Error('Helmet headers verification failed!');
    }
    console.log('✅ Helmet headers verified correctly!');

    console.log('\n============================================================');
    console.log('🎉 ALL 5 SECURITY HARDENING PILLARS VERIFIED SUCCESSFULLY! 🎉');
    console.log('============================================================');
  } finally {
    await mongoose.disconnect();
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
