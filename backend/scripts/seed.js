/**
 * UniConnect Development Seed Script
 * Creates Reddit-style test data for verification.
 * Run with: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Community = require('../models/Community');
const CommunityMember = require('../models/CommunityMember');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Block = require('../models/Block');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');
const { calculateHotRank } = require('../services/rankingService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

const seed = async () => {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  console.log('🗑️ Clearing existing database data...');
  await Promise.all([
    User.deleteMany({}),
    Community.deleteMany({}),
    CommunityMember.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Vote.deleteMany({}),
    SavedPost.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Block.deleteMany({}),
    Report.deleteMany({}),
    Notification.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);
  console.log('🗑️ Database cleared');

  // ─── 1. Create Users ─────────────────────────────────────────────────────────
  console.log('👥 Seeding Users...');
  const usersData = [
    { username: 'quietfalcon', email: 'falcon@college.edu', password: 'Password@123', bio: 'Coding and tech explorer.', verified: true },
    { username: 'quietowl', email: 'owl@college.edu', password: 'Password@123', bio: 'Curious thinker and night watcher.', verified: true },
    { username: 'bytefox', email: 'fox@college.edu', password: 'Password@123', bio: 'Building backend things in JS.', verified: true },
    { username: 'randompixel', email: 'pixel@college.edu', password: 'Password@123', bio: 'Design, arts and pixels.', verified: true },
    { username: 'anonymous_42', email: 'anon42@college.edu', password: 'Password@123', bio: 'Just another entity.', verified: true },
    { username: 'nightshift', email: 'shift@college.edu', password: 'Password@123', bio: 'Loves midnight coffee and puzzles.', verified: true },
    { username: 'voidwalker', email: 'void@college.edu', password: 'Password@123', bio: 'F1 enthusiast and sports debater.', verified: true },
    { username: 'sysadm', email: 'admin@college.edu', password: 'Password@123', role: 'admin', verified: true }
  ];

  const users = {};
  for (const u of usersData) {
    const createdUser = await User.create(u);
    users[u.username] = createdUser;
  }
  console.log('✅ Users seeded');

  // ─── 2. Create Communities ──────────────────────────────────────────────────
  console.log('🏔️ Seeding Communities...');

  // Active Community 1: Chaos
  const cChaos = await Community.create({
    name: 'chaos',
    slug: 'chaos',
    displayName: 'Chaos',
    description: 'A completely open community for random thoughts, funny situations, unfiltered discussions, unexpected questions and anything that doesn’t fit elsewhere.',
    creator: users['quietowl']._id,
    membersCount: 8,
    postsCount: 8,
    visibility: 'public',
    rules: [
      { title: 'Stay chaotic', description: 'Post random, out-of-the-box things.' },
      { title: 'No harassment', description: 'Fun is welcome, toxicity is not.' }
    ],
    moderators: [users['quietowl']._id],
  });

  // Active Community 2: Play-Round
  const cPlayRound = await Community.create({
    name: 'play-round',
    slug: 'play-round',
    displayName: 'Play-Round',
    description: 'Talk sports, share opinions, debate games, predictions and memorable moments.',
    creator: users['voidwalker']._id,
    membersCount: 8,
    postsCount: 9,
    visibility: 'public',
    rules: [
      { title: 'Respect teams', description: 'Healthy debate only. No team hate speech.' }
    ],
    moderators: [users['voidwalker']._id],
  });

  const comms = { chaos: cChaos, 'play-round': cPlayRound };
  console.log('✅ Communities seeded');

  // ─── 3. Create Community Memberships ─────────────────────────────────────────
  console.log('🤝 Seeding Community Memberships...');
  const memberObjs = [];
  const allUserKeys = Object.keys(users);

  // Add all users to Chaos and Play-Round
  for (const uk of allUserKeys) {
    memberObjs.push({
      community: cChaos._id,
      user: users[uk]._id,
      role: uk === 'quietowl' ? 'owner' : 'member'
    });
    memberObjs.push({
      community: cPlayRound._id,
      user: users[uk]._id,
      role: uk === 'voidwalker' ? 'owner' : 'member'
    });
  }

  await CommunityMember.create(memberObjs);
  console.log('✅ Memberships seeded');

  // ─── 4. Create Posts ─────────────────────────────────────────────────────────
  console.log('📝 Seeding Posts...');

  // Chaos Community Posts
  const chaosPosts = [
    { author: 'quietfalcon', title: 'What is the most random thing that happened to you this week?', content: 'I met someone with the exact same keychain and we stared at each other for like 30 seconds.' },
    { author: 'bytefox', title: 'I opened my laptop to study and somehow ended up reorganizing my entire desktop.', content: 'Three hours gone. I created nested folders inside nested folders. But the desk is clean!' },
    { author: 'randompixel', title: 'What’s a completely useless skill you’re weirdly good at?', content: 'I can flip my pen around my thumb perfectly. Does it help my coding? No. Does it look cool? Yes.' },
    { author: 'anonymous_42', title: 'Tell me something that sounds fake but actually happened.', content: 'A crow dropped a coin right onto my book page while I was reading on the campus lawns.' },
    { author: 'nightshift', title: 'What’s the most chaotic decision you’ve made that somehow worked?', content: 'I picked a random elective 5 minutes before registration closed and it ended up being my favorite class.' },
    { author: 'voidwalker', title: 'What’s something everyone seems to understand except you?', content: 'How people wake up at 6 AM everyday and actually feel motivated. How is this possible?' },
    { author: 'quietowl', title: 'Drop your most unnecessary hot take.', content: 'Pineapple belongs on pizza, and cold pizza is better than hot pizza. Fight me.' },
    { author: 'anonymous_42', title: 'What’s the funniest misunderstanding you’ve ever had?', content: 'I waved back at someone today, only to realize they were waving at the person behind me. I kept waving to pretend I was stretching.' }
  ];

  const seededChaosPosts = [];
  for (let i = 0; i < chaosPosts.length; i++) {
    const cp = chaosPosts[i];
    const post = await Post.create({
      author: users[cp.author]._id,
      community: cChaos._id,
      type: 'text',
      title: cp.title,
      content: cp.content,
      upvoteCount: 15 + i * 8,
      downvoteCount: i,
      score: 15 + i * 8 - i,
      hotRank: calculateHotRank(15 + i * 8 - i, i, new Date(Date.now() - i * 3600000)),
      commentCount: 2
    });
    seededChaosPosts.push(post);
  }

  // Play-Round Community Posts
  const playPosts = [
    { author: 'voidwalker', title: 'Who has been the most consistent player this season?', content: 'Drop your stats and thoughts. Looking at both football and cricket formats.' },
    { author: 'nightshift', title: 'Best sporting comeback you’ve ever watched?', content: 'Nothing beats the UEFA Champions League finals or F1 final lap passes.' },
    { author: 'quietfalcon', title: 'Match prediction thread — drop your predictions.', content: 'Tonight’s big derby is going to be intense. I say 2-1 for the home team.' },
    { author: 'bytefox', title: 'Which sport would you try if you had one year to train?', content: 'I’d probably try F1 racing, though I’d probably spin out in the first corner.' },
    { author: 'quietowl', title: 'Who takes the next big tournament?', content: 'The lineups look incredibly stacked. It’s anyone’s game.' },
    { author: 'randompixel', title: 'Best cricket finish you’ve watched?', content: 'That last over with 18 runs needed. Absolute cinema.' },
    { author: 'anonymous_42', title: 'Football XI of the decade — who makes your list?', content: 'Drop your squads below. Let’s keep it civilized.' },
    { author: 'voidwalker', title: 'F1: Which track produces the best racing?', content: 'Spa-Francorchamps is classic, but Monza speed is something else.' },
    { author: 'nightshift', title: 'What’s the most underrated sport to watch?', content: 'Table tennis at the Olympics is insanely fast. You can barely track the ball.' }
  ];

  const seededPlayPosts = [];
  for (let i = 0; i < playPosts.length; i++) {
    const pp = playPosts[i];
    const post = await Post.create({
      author: users[pp.author]._id,
      community: cPlayRound._id,
      type: 'text',
      title: pp.title,
      content: pp.content,
      upvoteCount: 22 + i * 11,
      downvoteCount: 1,
      score: 22 + i * 11 - 1,
      hotRank: calculateHotRank(22 + i * 11 - 1, 1, new Date(Date.now() - i * 3600000)),
      commentCount: 1
    });
    seededPlayPosts.push(post);
  }

  console.log('✅ Posts seeded');

  // ─── 5. Create Comments ─────────────────────────────────────────────────────
  console.log('💬 Seeding Comments...');
  
  // Chaos post comments
  for (const cp of seededChaosPosts) {
    const parentComment = await Comment.create({
      post: cp._id,
      author: users['bytefox']._id,
      parentComment: null,
      depth: 0,
      content: 'This is actually so relatable, haha.',
      upvoteCount: 5,
      score: 5
    });

    await Comment.create({
      post: cp._id,
      author: users['quietowl']._id,
      parentComment: parentComment._id,
      depth: 1,
      content: 'I agree completely, thought I was the only one!',
      upvoteCount: 2,
      score: 2
    });
  }

  // Play-round comments
  for (const pp of seededPlayPosts) {
    await Comment.create({
      post: pp._id,
      author: users['voidwalker']._id,
      parentComment: null,
      depth: 0,
      content: 'Monza or Spa are top tier. Abu Dhabi final sectors are good too.',
      upvoteCount: 12,
      score: 12
    });
  }
  console.log('✅ Comments seeded');

  // ─── 6. Sync User Karma ─────────────────────────────────────────────────────
  console.log('🗳️ Synchronizing User Karma...');
  for (const uk of allUserKeys) {
    const userObj = users[uk];
    userObj.karma = {
      post: Math.floor(Math.random() * 200) + 50,
      comment: Math.floor(Math.random() * 150) + 30,
      total: 0
    };
    userObj.karma.total = userObj.karma.post + userObj.karma.comment;
    await userObj.save();
  }
  console.log('✅ Karma synchronized');

  // ─── 7. Create DMs (Fictional Conversations) ────────────────────────────────
  console.log('💬 Seeding Fictional DMs...');
  
  const dmScenarios = [
    {
      partner: 'quietowl',
      msg: 'Did you see the new Chaos post?',
      timeOffset: 2 * 60 * 1000, // 2m ago
      history: [
        { sender: 'quietowl', text: 'Did you see the new Chaos post?' },
        { sender: 'quietfalcon', text: 'Yeah, that one was actually hilarious.' },
        { sender: 'quietowl', text: 'I know 😂' }
      ]
    },
    {
      partner: 'bytefox',
      msg: 'Are you joining the Play-Round discussion?',
      timeOffset: 18 * 60 * 1000, // 18m ago
      history: [
        { sender: 'bytefox', text: 'Are you joining the Play-Round discussion?' }
      ]
    },
    {
      partner: 'nightshift',
      msg: 'That puzzle challenge is harder than I expected.',
      timeOffset: 60 * 60 * 1000, // 1h ago
      history: [
        { sender: 'nightshift', text: 'That puzzle challenge is harder than I expected.' }
      ]
    }
  ];

  for (const s of dmScenarios) {
    const partnerUser = users[s.partner];
    const selfUser = users['quietfalcon'];
    
    const conversation = await Conversation.create({
      participants: [selfUser._id, partnerUser._id],
      lastMessageAt: new Date(Date.now() - s.timeOffset)
    });

    let lastMsgId = null;
    for (const h of s.history) {
      const senderObj = users[h.sender] || selfUser;
      const msgCreated = await Message.create({
        conversation: conversation._id,
        sender: senderObj._id,
        content: h.text,
        createdAt: new Date(Date.now() - s.timeOffset)
      });
      lastMsgId = msgCreated._id;
    }

    conversation.lastMessage = lastMsgId;
    await conversation.save();
  }
  console.log('✅ DMs seeded');

  // ─── 8. Seed Dummy Notifications ───────────────────────────────────────────
  console.log('🔔 Seeding Dummy Notifications...');
  const selfUser = users['quietfalcon'];

  const notifsData = [
    { message: 'u/bytefox replied to your comment: "That\'s actually a good point."', isRead: false, timeOffset: 2 * 60 * 1000, type: 'comment_reply' },
    { message: 'Your post received 25 upvotes: "What\'s the most random thing that happened?"', isRead: false, timeOffset: 18 * 60 * 1000, type: 'post_vote' },
    { message: 'u/nightshift replied to your post: "Try the puzzle challenge."', isRead: true, timeOffset: 60 * 60 * 1000, type: 'post_comment' },
    { message: 'New activity in c/play-round', isRead: true, timeOffset: 3 * 60 * 60 * 1000, type: 'system' }
  ];

  for (const nd of notifsData) {
    await Notification.create({
      recipient: selfUser._id,
      message: nd.message,
      isRead: nd.isRead,
      type: nd.type,
      createdAt: new Date(Date.now() - nd.timeOffset)
    });
  }
  console.log('✅ Notifications seeded');

  // ─── Summary ────────────────────────────────━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Reddit-Style Seed Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nTest Accounts (Password: Password@123):');
  console.log('  Active User: quietfalcon');
  console.log('    Email: falcon@college.edu');
  console.log('  Admin User: sysadm');
  console.log('    Email: admin@college.edu');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
