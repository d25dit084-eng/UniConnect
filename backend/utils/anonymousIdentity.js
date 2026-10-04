/**
 * Anonymous Identity Generator
 *
 * Generates a deterministic anonymous alias for a user within a thread.
 * The same user always gets the same alias in the same thread,
 * making conversations coherent without revealing identity.
 *
 * Formula: hash(userId + threadId) → index → adjective + animal
 * threadId is typically the post ObjectId.
 */

const ADJECTIVES = [
  'Ancient', 'Blazing', 'Calm', 'Daring', 'Electric',
  'Fearless', 'Gentle', 'Hidden', 'Iron', 'Jade',
  'Keen', 'Lunar', 'Misty', 'Noble', 'Obsidian',
  'Phantom', 'Quick', 'Radiant', 'Silent', 'Thunder',
  'Ultra', 'Vivid', 'Wandering', 'Xenon', 'Yellow',
  'Zephyr', 'Arctic', 'Bronze', 'Crystal', 'Digital',
];

const ANIMALS = [
  'Falcon', 'Owl', 'Panda', 'Fox', 'Raven',
  'Tiger', 'Koala', 'Wolf', 'Hawk', 'Bear',
  'Eagle', 'Lynx', 'Otter', 'Crane', 'Viper',
  'Jaguar', 'Manta', 'Narwhal', 'Osprey', 'Puffin',
  'Quokka', 'Rabbit', 'Stag', 'Turtle', 'Urial',
  'Vixen', 'Walrus', 'Xerus', 'Yak', 'Zebra',
];

const crypto = require('crypto');

const ANONYMITY_SECRET =
  process.env.ANONYMITY_SECRET ||
  process.env.JWT_SECRET ||
  'uniconnect-secret-hmac-salt-2026';

/**
 * Deterministic hash function using crypto HMAC SHA256.
 */
const hmacHash = (str) => {
  const hmac = crypto.createHmac('sha256', ANONYMITY_SECRET).update(str).digest();
  return hmac.readUInt32BE(0);
};

/**
 * Get a deterministic anonymous alias for a user in a specific thread using HMAC.
 * @param {string} userId - The user's MongoDB ObjectId as string
 * @param {string} threadId - The post's MongoDB ObjectId as string (the thread root)
 * @returns {string} e.g. "Anonymous Ancient Falcon"
 */
const getAnonymousAlias = (userId, threadId) => {
  if (!userId || !threadId) return 'Anonymous';
  const seed = `${userId.toString()}:${threadId.toString()}`;
  const hash = hmacHash(seed);
  const adjIndex = hash % ADJECTIVES.length;
  const animalIndex = Math.floor(hash / ADJECTIVES.length) % ANIMALS.length;
  return `Anonymous ${ADJECTIVES[adjIndex]} ${ANIMALS[animalIndex]}`;
};

module.exports = { getAnonymousAlias };
