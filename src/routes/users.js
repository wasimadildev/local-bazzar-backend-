const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const {
  getSellerProfile,
  rateSeller,
  listSavedSearches,
  saveSearch,
  deleteSavedSearch,
  listFavoriteSellers,
  setFavoriteSeller,
  listFollowedCategories,
  setFollowedCategory
} = require('../repositories/marketplace');

const router = express.Router();
const savedSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  query: z.string().trim().max(120).optional().default(''),
  categoryId: z.string().trim().max(60).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  condition: z.enum(['new', 'used']).optional().default('')
});
const favoriteSellerSchema = z.object({ sellerId: z.string().trim().min(1) });
const categorySchema = z.object({ categoryId: z.string().trim().min(1) });
const ratingSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().trim().max(800).optional().default('')
});

router.use(requireAuth);

router.get('/saved-searches', async (req, res, next) => {
  try {
    return res.json({ searches: await listSavedSearches(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.post('/saved-searches', async (req, res, next) => {
  try {
    const body = savedSearchSchema.parse(req.body);
    const search = await saveSearch(req.user.sub, body);
    return res.status(201).json({ search });
  } catch (error) {
    return next(error);
  }
});

router.delete('/saved-searches/:id', async (req, res, next) => {
  try {
    const removed = await deleteSavedSearch(req.user.sub, req.params.id);
    if (!removed) return res.status(404).json({ message: 'Saved search not found.' });
    return res.json({ removed: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/favorite-sellers', async (req, res, next) => {
  try {
    return res.json({ sellerIds: await listFavoriteSellers(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.put('/favorite-sellers/:sellerId', async (req, res, next) => {
  try {
    const result = await setFavoriteSeller(req.user.sub, req.params.sellerId, true);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/favorite-sellers/:sellerId', async (req, res, next) => {
  try {
    const result = await setFavoriteSeller(req.user.sub, req.params.sellerId, false);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/followed-categories', async (req, res, next) => {
  try {
    return res.json({ categories: await listFollowedCategories(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.put('/followed-categories/:categoryId', async (req, res, next) => {
  try {
    const result = await setFollowedCategory(req.user.sub, req.params.categoryId, true);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/followed-categories/:categoryId', async (req, res, next) => {
  try {
    const result = await setFollowedCategory(req.user.sub, req.params.categoryId, false);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/:sellerId/profile', async (req, res, next) => {
  try {
    const seller = await getSellerProfile(req.params.sellerId, req.user.sub);
    if (!seller) return res.status(404).json({ message: 'Seller not found.' });
    return res.json({ seller });
  } catch (error) {
    return next(error);
  }
});

router.post('/:sellerId/rate', async (req, res, next) => {
  try {
    const body = ratingSchema.parse(req.body);
    const seller = await rateSeller(req.params.sellerId, req.user.sub, body.rating, body.comment);
    if (!seller) return res.status(404).json({ message: 'Seller not found.' });
    return res.status(201).json({ seller });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
