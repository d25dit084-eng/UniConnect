const Resource = require('../models/Resource');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeAuthor } = require('../helpers/authorSerializer');
const { encryptAuthor } = require('../utils/encryption');
const { sanitizeContent } = require('../utils/sanitizer');

/**
 * List resources with search, courseCode, category filtering and pagination
 */
exports.getResources = asyncHandler(async (req, res) => {
  const {
    courseCode,
    category,
    search,
    sort = 'recent',
    page = 1,
    limit = 20,
  } = req.query;

  const query = {};

  if (courseCode) {
    query.courseCode = courseCode.toUpperCase().trim();
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { tags: new RegExp(search, 'i') },
      { courseCode: new RegExp(search, 'i') },
    ];
  }

  const sortOptions = {};
  if (sort === 'popular') sortOptions.upvotesCount = -1;
  else if (sort === 'downloads') sortOptions.downloadsCount = -1;
  else sortOptions.createdAt = -1;

  const skip = (Number(page) - 1) * Number(limit);
  const [rawResources, total] = await Promise.all([
    Resource.find(query)
      .populate('author', 'username avatar karma')
      .populate('course', 'code name department')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Resource.countDocuments(query),
  ]);

  const resources = rawResources.map((item) => ({
    ...item,
    author: serializeAuthor(item, req.user),
  }));

  res.json({
    success: true,
    resources,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * Get single resource by ID
 */
exports.getResourceById = asyncHandler(async (req, res) => {
  const item = await Resource.findById(req.params.id)
    .populate('author', 'username avatar karma')
    .populate('course', 'code name department')
    .lean();

  if (!item) {
    throw new ApiError(404, 'Resource not found');
  }

  res.json({
    success: true,
    resource: {
      ...item,
      author: serializeAuthor(item, req.user),
    },
  });
});

/**
 * Upload / create a new study resource
 */
exports.createResource = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    courseId,
    courseCode: providedCourseCode,
    category = 'lecture_notes',
    semester,
    fileUrl,
    fileName,
    fileType = 'pdf',
    fileSize = 0,
    tags = [],
    isAnonymous = false,
  } = req.body;

  if (!title || title.trim().length < 3) {
    throw new ApiError(400, 'Title must be at least 3 characters');
  }
  if (!fileUrl || !fileName) {
    throw new ApiError(400, 'File URL and file name are required');
  }

  let resolvedCourseCode = providedCourseCode ? providedCourseCode.toUpperCase().trim() : '';
  let linkedCourse = null;

  if (courseId) {
    linkedCourse = await Course.findById(courseId);
    if (linkedCourse) {
      resolvedCourseCode = linkedCourse.code;
    }
  } else if (resolvedCourseCode) {
    linkedCourse = await Course.findOne({ code: resolvedCourseCode });
  }

  const userId = req.user._id;
  const encryptedAuthor = isAnonymous ? encryptAuthor(userId) : null;

  const sanitizedDescription = description ? sanitizeContent(description) : '';

  const resource = await Resource.create({
    title: title.trim(),
    description: sanitizedDescription,
    course: linkedCourse ? linkedCourse._id : null,
    courseCode: resolvedCourseCode,
    category,
    semester: semester ? semester.trim() : '',
    author: userId,
    isAnonymous: Boolean(isAnonymous),
    encryptedAuthor,
    fileUrl: fileUrl.trim(),
    fileName: fileName.trim(),
    fileType: fileType.toLowerCase().trim(),
    fileSize: Number(fileSize) || 0,
    tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
  });

  const created = await Resource.findById(resource._id)
    .populate('author', 'username avatar karma')
    .populate('course', 'code name department')
    .lean();

  res.status(201).json({
    success: true,
    message: 'Resource published successfully',
    resource: {
      ...created,
      author: serializeAuthor(created, req.user),
    },
  });
});

/**
 * Track download and return download payload
 */
exports.downloadResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(
    req.params.id,
    { $inc: { downloadsCount: 1 } },
    { new: true }
  ).lean();

  if (!resource) {
    throw new ApiError(404, 'Resource not found');
  }

  res.json({
    success: true,
    fileUrl: resource.fileUrl,
    fileName: resource.fileName,
    downloadsCount: resource.downloadsCount,
  });
});

/**
 * Upvote a resource
 */
exports.voteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(
    req.params.id,
    { $inc: { upvotesCount: 1 } },
    { new: true }
  ).lean();

  if (!resource) {
    throw new ApiError(404, 'Resource not found');
  }

  res.json({
    success: true,
    upvotesCount: resource.upvotesCount,
  });
});

/**
 * Delete a resource (author or admin only)
 */
exports.deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) {
    throw new ApiError(404, 'Resource not found');
  }

  const isAuthor = resource.author.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new ApiError(403, 'You do not have permission to delete this resource');
  }

  await Resource.findByIdAndDelete(resource._id);

  res.json({
    success: true,
    message: 'Resource deleted successfully',
  });
});
