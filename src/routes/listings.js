const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { processListingImages, uploadListingImages } = require('../middleware/upload');
const {
  createListing,
  findListingById,
  findUserById,
  listCategories,
  listListings
} = require('../repositories/marketplace');

const router = express.Router();

const createListingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  price: z.coerce.number().min(0),
  categoryId: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(80),
  condition: z.enum(['new', 'used']).default('used')
});

router.get('/categories', async (_req, res, next) => {
  try {
    return res.json({ categories: await listCategories() });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const query = String(req.query.q || '');
    const categoryId = String(req.query.categoryId || '');
    const city = String(req.query.city || '');
    const listings = await listListings({ query, categoryId, city });

    return res.json({ listings });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const listing = await findListingById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    return res.json({ listing });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, (req, res, next) => {
  uploadListingImages(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      const body = createListingSchema.parse(req.body);
      const categories = await listCategories();
      const category = categories.find((item) => item.id === body.categoryId);

      if (!category) {
        return res.status(400).json({ message: 'Invalid category.' });
      }

      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const images = await processListingImages(req.files, baseUrl);
      const seller = await findUserById(req.user.sub);

      const listing = await createListing({
        title: body.title,
        description: body.description,
        price: body.price,
        categoryId: body.categoryId,
        categoryName: category.name,
        city: body.city,
        condition: body.condition,
        status: 'active',
        images,
        seller: {
          id: req.user.sub,
          name: seller?.name || req.user.name,
          phone: seller?.phone || req.user.phone
        }
      });

      return res.status(201).json({ listing });
    } catch (error) {
      return next(error);
    }
  });
});

module.exports = router;
