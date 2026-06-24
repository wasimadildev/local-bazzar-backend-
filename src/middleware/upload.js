const fs = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const sharp = require('sharp');
const { randomUUID } = require('crypto');

const uploadRoot = path.join(__dirname, '..', 'uploads');
const tempDir = path.join(uploadRoot, 'tmp');
const listingDir = path.join(uploadRoot, 'listings');
const profileDir = path.join(uploadRoot, 'profiles');

const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

async function ensureUploadDirs() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(listingDir, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });
}

function parseCloudinaryUrl() {
  const urlValue = process.env.CLOUDINARY_URL;
  if (!urlValue) return {};

  try {
    const url = new URL(urlValue);
    return {
      cloud_name: url.hostname,
      api_key: url.username,
      api_secret: url.password
    };
  } catch {
    return {};
  }
}

function cloudinaryConfigured() {
  const cloudinaryConfig = parseCloudinaryUrl();
  return Boolean(
    (cloudinaryConfig.cloud_name || process.env.CLOUDINARY_CLOUD_NAME) &&
      (cloudinaryConfig.api_key || process.env.CLOUDINARY_API_KEY) &&
      (cloudinaryConfig.api_secret || process.env.CLOUDINARY_API_SECRET)
  );
}

function configureCloudinary() {
  const cloudinaryConfig = parseCloudinaryUrl();
  cloudinary.config({
    cloud_name: cloudinaryConfig.cloud_name || process.env.CLOUDINARY_CLOUD_NAME,
    api_key: cloudinaryConfig.api_key || process.env.CLOUDINARY_API_KEY,
    api_secret: cloudinaryConfig.api_secret || process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadBufferToCloudinary(buffer, publicId) {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'bazaar-local/listings',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensureUploadDirs();
      cb(null, tempDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const uploadListingImages = multer({
  storage,
  limits: {
    files: 8,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }

    return cb(null, true);
  }
}).array('images', 8);

const uploadProfileImage = multer({
  storage,
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }

    return cb(null, true);
  }
}).single('photo');

async function processProfilePhoto(file, baseUrl) {
  await ensureUploadDirs();

  const id = randomUUID();
  const imageBuffer = await sharp(file.path)
    .rotate()
    .resize({ width: 600, height: 600, fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  if (cloudinaryConfigured()) {
    const image = await uploadBufferToCloudinary(imageBuffer, `profiles/${id}`);
    await fs.unlink(file.path).catch(() => {});
    return image.secure_url;
  }

  const fileName = `${id}.webp`;
  const outputPath = path.join(profileDir, fileName);
  await fs.writeFile(outputPath, imageBuffer);
  await fs.unlink(file.path).catch(() => {});
  return `${baseUrl}/uploads/profiles/${fileName}`;
}

async function processListingImages(files, baseUrl) {
  await ensureUploadDirs();

  const images = [];

  for (const file of files || []) {
    const id = randomUUID();
    const imageBuffer = await sharp(file.path)
      .rotate()
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const thumbBuffer = await sharp(file.path)
      .rotate()
      .resize(420, 320, { fit: 'cover' })
      .webp({ quality: 76 })
      .toBuffer();

    if (cloudinaryConfigured()) {
      const [image, thumbnail] = await Promise.all([
        uploadBufferToCloudinary(imageBuffer, id),
        uploadBufferToCloudinary(thumbBuffer, `${id}-thumb`)
      ]);

      await fs.unlink(file.path).catch(() => {});

      images.push({
        id,
        url: image.secure_url,
        thumbnailUrl: thumbnail.secure_url,
        provider: 'cloudinary',
        publicId: image.public_id
      });

      continue;
    }

    const fileName = `${id}.webp`;
    const thumbName = `${id}-thumb.webp`;
    const outputPath = path.join(listingDir, fileName);
    const thumbPath = path.join(listingDir, thumbName);

    await fs.writeFile(outputPath, imageBuffer);
    await fs.writeFile(thumbPath, thumbBuffer);

    await fs.unlink(file.path).catch(() => {});

    images.push({
      id,
      url: `${baseUrl}/uploads/listings/${fileName}`,
      thumbnailUrl: `${baseUrl}/uploads/listings/${thumbName}`,
      provider: 'local',
      fileName,
      thumbnailFileName: thumbName
    });
  }

  return images;
}

module.exports = {
  listingDir,
  uploadListingImages,
  uploadProfileImage,
  processListingImages,
  processProfilePhoto
};
