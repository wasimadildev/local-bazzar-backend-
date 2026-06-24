const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const {
  getProfile,
  listSavedListings,
  listUserListings,
  setListingSaved,
  updateProfile
} = require('../repositories/marketplace');
const { uploadProfileImage, processProfilePhoto } = require('../middleware/upload');

const router = express.Router();

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().max(80).optional().default('')
});

router.use(requireAuth);

router.get('/profile', async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.sub);
    if (!profile) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: profile });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', (req, res, next) => {
  uploadProfileImage(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      const body = profileSchema.parse(req.body);
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      let profilePhotoUrl;
      if (req.file) {
        profilePhotoUrl = await processProfilePhoto(req.file, baseUrl);
      }

      const user = await updateProfile(req.user.sub, {
        name: body.name,
        city: body.city,
        profilePhotoUrl
      });

      if (!user) return res.status(404).json({ message: 'User not found.' });
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });
});

router.get('/listings', async (req, res, next) => {
  try {
    return res.json({ listings: await listUserListings(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.get('/saved', async (req, res, next) => {
  try {
    return res.json({ listings: await listSavedListings(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.put('/saved/:listingId', async (req, res, next) => {
  try {
    const result = await setListingSaved(req.user.sub, req.params.listingId, true);
    if (!result) return res.status(404).json({ message: 'Listing not found.' });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/saved/:listingId', async (req, res, next) => {
  try {
    const result = await setListingSaved(req.user.sub, req.params.listingId, false);
    if (!result) return res.status(404).json({ message: 'Listing not found.' });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
