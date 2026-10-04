const mongoose = require('mongoose');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Review = require('../models/Review');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeAuthor } = require('../helpers/authorSerializer');
const { encryptAuthor } = require('../utils/encryption');
const { sanitizeContent } = require('../utils/sanitizer');

/**
 * Recalculate and update aggregate rating metrics for Course or Professor.
 */
async function syncAggregateMetrics(targetType, targetId) {
  const matchField = targetType === 'course' ? 'course' : 'professor';
  const objId = typeof targetId === 'string' ? new mongoose.Types.ObjectId(targetId) : targetId;

  const stats = await Review.aggregate([
    { $match: { [matchField]: objId } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        avgDifficulty: { $avg: '$difficulty' },
        totalReviews: { $sum: 1 },
        wouldTakeAgainCount: {
          $sum: { $cond: [{ $eq: ['$wouldTakeAgain', true] }, 1, 0] },
        },
      },
    },
  ]);

  const stat = stats[0] || {
    avgRating: 0,
    avgDifficulty: 0,
    totalReviews: 0,
    wouldTakeAgainCount: 0,
  };

  const roundedRating = Math.round((stat.avgRating || 0) * 10) / 10;
  const roundedDifficulty = Math.round((stat.avgDifficulty || 0) * 10) / 10;
  const reviewsCount = stat.totalReviews || 0;

  if (targetType === 'course') {
    await Course.findByIdAndUpdate(targetId, {
      $set: {
        avgRating: roundedRating,
        avgDifficulty: roundedDifficulty,
        reviewsCount,
      },
    });
  } else {
    const wouldTakeAgainPercent = reviewsCount > 0
      ? Math.round((stat.wouldTakeAgainCount / reviewsCount) * 100)
      : 0;

    await Professor.findByIdAndUpdate(targetId, {
      $set: {
        avgRating: roundedRating,
        avgDifficulty: roundedDifficulty,
        wouldTakeAgainPercent,
        reviewsCount,
      },
    });
  }
}

// ─── Courses Controllers ──────────────────────────────────────────────────────

exports.getCourses = asyncHandler(async (req, res) => {
  const { search, department, sort = 'rating', page = 1, limit = 20 } = req.query;
  const query = {};

  if (department) {
    query.department = new RegExp(`^${department}$`, 'i');
  }

  if (search) {
    query.$or = [
      { code: new RegExp(search, 'i') },
      { name: new RegExp(search, 'i') },
    ];
  }

  const sortOptions = {};
  if (sort === 'rating') sortOptions.avgRating = -1;
  else if (sort === 'difficulty') sortOptions.avgDifficulty = -1;
  else if (sort === 'reviews') sortOptions.reviewsCount = -1;
  else sortOptions.code = 1;

  const skip = (Number(page) - 1) * Number(limit);
  const [courses, total] = await Promise.all([
    Course.find(query).sort(sortOptions).skip(skip).limit(Number(limit)).lean(),
    Course.countDocuments(query),
  ]);

  res.json({
    success: true,
    courses,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

exports.getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).lean();
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Fetch reviews with zero-leak author sanitization
  const rawReviews = await Review.find({ course: course._id })
    .populate('author', 'username avatar karma')
    .sort({ createdAt: -1 })
    .lean();

  const reviews = rawReviews.map((r) => ({
    ...r,
    author: serializeAuthor(r, req.user),
  }));

  res.json({
    success: true,
    course,
    reviews,
  });
});

exports.createCourse = asyncHandler(async (req, res) => {
  const { code, name, department, description, credits, professors } = req.body;
  if (!code || !name || !department) {
    throw new ApiError(400, 'Code, name, and department are required');
  }

  const existing = await Course.findOne({ code: code.toUpperCase().trim() });
  if (existing) {
    throw new ApiError(409, `Course code ${code} already exists`);
  }

  const course = await Course.create({
    code: code.toUpperCase().trim(),
    name: name.trim(),
    department: department.trim(),
    description: description ? description.trim() : '',
    credits: Number(credits) || 3,
    professors: Array.isArray(professors) ? professors : [],
  });

  res.status(201).json({
    success: true,
    course,
  });
});

// ─── Professors Controllers ───────────────────────────────────────────────────

exports.getProfessors = asyncHandler(async (req, res) => {
  const { search, department, sort = 'rating', page = 1, limit = 20 } = req.query;
  const query = {};

  if (department) {
    query.department = new RegExp(`^${department}$`, 'i');
  }

  if (search) {
    query.name = new RegExp(search, 'i');
  }

  const sortOptions = {};
  if (sort === 'rating') sortOptions.avgRating = -1;
  else if (sort === 'reviews') sortOptions.reviewsCount = -1;
  else sortOptions.name = 1;

  const skip = (Number(page) - 1) * Number(limit);
  const [professors, total] = await Promise.all([
    Professor.find(query).sort(sortOptions).skip(skip).limit(Number(limit)).lean(),
    Professor.countDocuments(query),
  ]);

  res.json({
    success: true,
    professors,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

exports.getProfessorById = asyncHandler(async (req, res) => {
  const professor = await Professor.findById(req.params.id).lean();
  if (!professor) {
    throw new ApiError(404, 'Professor not found');
  }

  const rawReviews = await Review.find({ professor: professor._id })
    .populate('author', 'username avatar karma')
    .sort({ createdAt: -1 })
    .lean();

  const reviews = rawReviews.map((r) => ({
    ...r,
    author: serializeAuthor(r, req.user),
  }));

  res.json({
    success: true,
    professor,
    reviews,
  });
});

exports.createProfessor = asyncHandler(async (req, res) => {
  const { name, department, title, email, courses } = req.body;
  if (!name || !department) {
    throw new ApiError(400, 'Name and department are required');
  }

  const professor = await Professor.create({
    name: name.trim(),
    department: department.trim(),
    title: title ? title.trim() : 'Professor',
    email: email ? email.toLowerCase().trim() : undefined,
    courses: Array.isArray(courses) ? courses : [],
  });

  res.status(201).json({
    success: true,
    professor,
  });
});

// ─── Reviews Controllers ──────────────────────────────────────────────────────

exports.createReview = asyncHandler(async (req, res) => {
  const {
    targetType,
    courseId,
    professorId,
    rating,
    difficulty,
    wouldTakeAgain,
    grade,
    content,
    tags,
    isAnonymous = false,
  } = req.body;

  if (!targetType || !['course', 'professor'].includes(targetType)) {
    throw new ApiError(400, "targetType must be either 'course' or 'professor'");
  }

  if (targetType === 'course' && !courseId) {
    throw new ApiError(400, 'courseId is required for course reviews');
  }

  if (targetType === 'professor' && !professorId) {
    throw new ApiError(400, 'professorId is required for professor reviews');
  }

  const numRating = Number(rating);
  const numDifficulty = Number(difficulty);

  if (!numRating || numRating < 1 || numRating > 5) {
    throw new ApiError(400, 'Rating must be an integer between 1 and 5');
  }

  if (!numDifficulty || numDifficulty < 1 || numDifficulty > 5) {
    throw new ApiError(400, 'Difficulty must be an integer between 1 and 5');
  }

  if (!content || content.trim().length < 10) {
    throw new ApiError(400, 'Review content must be at least 10 characters');
  }

  // Prevent duplicate review by same user for same target
  const duplicateQuery = {
    author: req.user._id,
    targetType,
  };
  if (targetType === 'course') duplicateQuery.course = courseId;
  else duplicateQuery.professor = professorId;

  const existing = await Review.findOne(duplicateQuery);
  if (existing) {
    throw new ApiError(409, `You have already reviewed this ${targetType}`);
  }

  // Encrypt author if anonymous
  let encryptedAuthor = null;
  if (isAnonymous) {
    encryptedAuthor = encryptAuthor(req.user._id.toString());
  }

  const sanitizedContent = sanitizeContent(content);

  const review = await Review.create({
    targetType,
    course: targetType === 'course' ? courseId : null,
    professor: targetType === 'professor' ? professorId : null,
    author: req.user._id,
    isAnonymous: Boolean(isAnonymous),
    encryptedAuthor,
    rating: numRating,
    difficulty: numDifficulty,
    wouldTakeAgain: wouldTakeAgain !== undefined ? Boolean(wouldTakeAgain) : true,
    grade: grade || 'N/A',
    content: sanitizedContent,
    tags: Array.isArray(tags) ? tags : [],
  });

  // Re-calculate target averages
  const targetId = targetType === 'course' ? courseId : professorId;
  await syncAggregateMetrics(targetType, targetId);

  // Return zero-leak serialized review
  const populated = await Review.findById(review._id).populate('author', 'username avatar karma').lean();

  res.status(201).json({
    success: true,
    review: {
      ...populated,
      author: serializeAuthor(populated, req.user),
    },
  });
});

exports.voteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { voteType } = req.body; // 'helpful' or 'unhelpful'

  if (!['helpful', 'unhelpful'].includes(voteType)) {
    throw new ApiError(400, "voteType must be 'helpful' or 'unhelpful'");
  }

  const incField = voteType === 'helpful' ? { helpfulCount: 1 } : { unhelpfulCount: 1 };
  const updated = await Review.findByIdAndUpdate(id, { $inc: incField }, { new: true }).lean();

  if (!updated) {
    throw new ApiError(404, 'Review not found');
  }

  res.json({
    success: true,
    helpfulCount: updated.helpfulCount,
    unhelpfulCount: updated.unhelpfulCount,
  });
});
