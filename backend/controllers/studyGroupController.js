const StudyGroup = require('../models/StudyGroup');
const Course = require('../models/Course');
const Conversation = require('../models/Conversation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sanitizeContent } = require('../utils/sanitizer');

/**
 * List active study groups with optional search and filters
 */
exports.getStudyGroups = asyncHandler(async (req, res) => {
  const {
    courseCode,
    meetingType,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const query = { status: 'active' };

  if (courseCode) {
    query.courseCode = courseCode.toUpperCase().trim();
  }

  if (meetingType) {
    query.meetingType = meetingType;
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { topic: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { courseCode: new RegExp(search, 'i') },
    ];
  }

  const userId = req.user ? req.user._id.toString() : null;
  const skip = (Number(page) - 1) * Number(limit);

  const [rawGroups, total] = await Promise.all([
    StudyGroup.find(query)
      .populate('creator', 'username avatar')
      .populate('members.user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    StudyGroup.countDocuments(query),
  ]);

  const groups = rawGroups.map((g) => {
    const isMember = userId
      ? g.members.some((m) => m.user?._id?.toString() === userId || m.user?.toString() === userId)
      : false;
    const isCreator = userId ? g.creator?._id?.toString() === userId : false;

    return {
      ...g,
      memberCount: g.members?.length || 0,
      isMember,
      isCreator,
    };
  });

  res.json({
    success: true,
    groups,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * Get study group details
 */
exports.getStudyGroupById = asyncHandler(async (req, res) => {
  const group = await StudyGroup.findById(req.params.id)
    .populate('creator', 'username avatar bio karma')
    .populate('members.user', 'username avatar bio karma')
    .lean();

  if (!group || group.status === 'archived') {
    throw new ApiError(404, 'Study group not found');
  }

  const userId = req.user ? req.user._id.toString() : null;
  const isMember = userId
    ? group.members.some((m) => m.user?._id?.toString() === userId || m.user?.toString() === userId)
    : false;
  const isCreator = userId ? group.creator?._id?.toString() === userId : false;

  res.json({
    success: true,
    group: {
      ...group,
      memberCount: group.members?.length || 0,
      isMember,
      isCreator,
    },
  });
});

/**
 * Create a new study group
 */
exports.createStudyGroup = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    courseCode,
    topic,
    maxMembers = 20,
    meetingSchedule,
    meetingType = 'in_person',
    location,
    meetingLink,
    isPrivate = false,
  } = req.body;

  if (!name || name.trim().length < 3) {
    throw new ApiError(400, 'Study group name must be at least 3 characters');
  }

  const userId = req.user._id;

  // Resolve course if courseCode provided
  let linkedCourseId = null;
  const resolvedCode = courseCode ? courseCode.toUpperCase().trim() : '';
  if (resolvedCode) {
    const courseDoc = await Course.findOne({ code: resolvedCode });
    if (courseDoc) linkedCourseId = courseDoc._id;
  }

  // Create dedicated group chat conversation
  const groupConversation = await Conversation.create({
    participants: [userId],
  });

  const sanitizedDescription = description ? sanitizeContent(description) : '';

  const group = await StudyGroup.create({
    name: name.trim(),
    description: sanitizedDescription,
    course: linkedCourseId,
    courseCode: resolvedCode,
    topic: topic ? topic.trim() : '',
    creator: userId,
    members: [
      {
        user: userId,
        role: 'admin',
        joinedAt: new Date(),
      },
    ],
    maxMembers: Math.min(100, Math.max(2, Number(maxMembers) || 20)),
    meetingSchedule: meetingSchedule ? meetingSchedule.trim() : '',
    meetingType,
    location: location ? location.trim() : '',
    meetingLink: meetingLink ? meetingLink.trim() : '',
    isPrivate: Boolean(isPrivate),
    conversation: groupConversation._id,
  });

  const populated = await StudyGroup.findById(group._id)
    .populate('creator', 'username avatar')
    .populate('members.user', 'username avatar')
    .lean();

  res.status(201).json({
    success: true,
    message: 'Study group created successfully',
    group: {
      ...populated,
      memberCount: 1,
      isMember: true,
      isCreator: true,
    },
  });
});

/**
 * Join an existing study group
 */
exports.joinStudyGroup = asyncHandler(async (req, res) => {
  const group = await StudyGroup.findById(req.params.id);
  if (!group || group.status !== 'active') {
    throw new ApiError(404, 'Study group not found or is no longer active');
  }

  const userId = req.user._id;
  const isAlreadyMember = group.members.some(
    (m) => m.user.toString() === userId.toString()
  );

  if (isAlreadyMember) {
    throw new ApiError(400, 'You are already a member of this study group');
  }

  if (group.members.length >= group.maxMembers) {
    throw new ApiError(400, 'This study group has reached its maximum capacity');
  }

  group.members.push({
    user: userId,
    role: 'member',
    joinedAt: new Date(),
  });

  await group.save();

  // Add user to the group chat conversation
  if (group.conversation) {
    await Conversation.findByIdAndUpdate(group.conversation, {
      $addToSet: { participants: userId },
    });
  }

  res.json({
    success: true,
    message: `Joined study group "${group.name}" successfully`,
    memberCount: group.members.length,
  });
});

/**
 * Leave a study group
 */
exports.leaveStudyGroup = asyncHandler(async (req, res) => {
  const group = await StudyGroup.findById(req.params.id);
  if (!group) {
    throw new ApiError(404, 'Study group not found');
  }

  const userId = req.user._id;
  const memberIndex = group.members.findIndex(
    (m) => m.user.toString() === userId.toString()
  );

  if (memberIndex === -1) {
    throw new ApiError(400, 'You are not a member of this study group');
  }

  const isLeavingAdmin = group.members[memberIndex].role === 'admin';
  group.members.splice(memberIndex, 1);

  // If the admin leaves and members remain, promote next member
  if (isLeavingAdmin && group.members.length > 0) {
    group.members[0].role = 'admin';
    group.creator = group.members[0].user;
  }

  // If no members left, archive group
  if (group.members.length === 0) {
    group.status = 'archived';
  }

  await group.save();

  // Remove user from conversation
  if (group.conversation) {
    await Conversation.findByIdAndUpdate(group.conversation, {
      $pull: { participants: userId },
    });
  }

  res.json({
    success: true,
    message: `Left study group "${group.name}"`,
    memberCount: group.members.length,
  });
});

/**
 * Delete a study group (creator or admin only)
 */
exports.deleteStudyGroup = asyncHandler(async (req, res) => {
  const group = await StudyGroup.findById(req.params.id);
  if (!group) {
    throw new ApiError(404, 'Study group not found');
  }

  const isCreator = group.creator.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isCreator && !isAdmin) {
    throw new ApiError(403, 'Only the study group creator or platform admin can delete this group');
  }

  await StudyGroup.findByIdAndDelete(group._id);

  if (group.conversation) {
    await Conversation.findByIdAndDelete(group.conversation);
  }

  res.json({
    success: true,
    message: 'Study group deleted successfully',
  });
});
