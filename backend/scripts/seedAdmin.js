/**
 * Admin User Seed Script
 * Creates an admin user for testing Phase 5 admin endpoints.
 * Run: node scripts/seedAdmin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected');

  const existing = await User.findOne({ email: 'admin@uniconnect.edu' });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.verified = true;
      await existing.save();
      console.log('✅ Upgraded existing user to admin: admin@uniconnect.edu');
    } else {
      console.log('⏭️  Admin already exists: admin@uniconnect.edu');
    }
  } else {
    await User.create({
      username: 'admin_uc',
      email: 'admin@uniconnect.edu',
      password: 'Admin@123456',
      role: 'admin',
      verified: true,
    });
    console.log('✅ Created admin: admin@uniconnect.edu / Admin@123456');
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch((e) => { console.error(e.message); process.exit(1); });
