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

/**
 * Simple deterministic hash function for strings.
 * Uses djb2-style algorithm — no crypto needed for aliases.
 */
const simpleHash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Get a deterministic anonymous alias for a user in a specific thread.
 * @param {string} userId - The user's MongoDB ObjectId as string
 * @param {string} threadId - The post's MongoDB ObjectId as string (the thread root)
 * @returns {string} e.g. "Anonymous Falcon"
 */
const getAnonymousAlias = (userId, threadId) => {
  const seed = `${userId}:${threadId}`;
  const hash = simpleHash(seed);
  const adjIndex = hash % ADJECTIVES.length;
  const animalIndex = Math.floor(hash / ADJECTIVES.length) % ANIMALS.length;
  return `Anonymous ${ADJECTIVES[adjIndex]} ${ANIMALS[animalIndex]}`;
};

module.exports = { getAnonymousAlias };
