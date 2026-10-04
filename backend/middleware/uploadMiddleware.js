const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

// ─── Storage Configuration ────────────────────────────────────────────────────

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp + random hex + original extension
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});

// ─── File Type Validation ─────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(400, 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'),
      false
    );
  }
};

// ─── Multer Instance ──────────────────────────────────────────────────────────

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

/**
 * Verifies file magic bytes on disk to confirm genuine image format.
 */
const verifyImageMagicBytes = (filePath) => {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return true;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return true;
    }

    // WebP: 'RIFF' ... 'WEBP'
    if (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return true;
    }

    // GIF: 'GIF8'
    if (buffer.toString('ascii', 0, 4) === 'GIF8') {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Middleware that checks magic bytes of uploaded file.
 * Removes file and returns 400 if fraudulent.
 */
const validateUploadedImage = (req, res, next) => {
  if (!req.file) return next();
  const isValid = verifyImageMagicBytes(req.file.path);
  if (!isValid) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}
    return next(new ApiError(400, 'Invalid image file: magic bytes do not match a valid image format.'));
  }
  next();
};

const uploadProfileImage = upload.single('profileImage');

module.exports = {
  upload,
  uploadProfileImage,
  validateUploadedImage,
  verifyImageMagicBytes,
};
