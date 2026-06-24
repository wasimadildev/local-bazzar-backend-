const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const {
  addMessage,
  createOrGetConversation,
  getConversation,
  listConversations
} = require('../repositories/marketplace');

const router = express.Router();

const startSchema = z.object({
  listingId: z.string().trim().min(1)
});

const messageSchema = z.object({
  body: z.string().trim().min(1).max(1200)
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    return res.json({ conversations: await listConversations(req.user.sub) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = startSchema.parse(req.body);
    const conversation = await createOrGetConversation({
      listingId: body.listingId,
      buyerId: req.user.sub
    });

    if (!conversation) return res.status(404).json({ message: 'Listing not found.' });
    if (conversation.ownListing) {
      return res.status(400).json({ message: 'You cannot chat with yourself on your own listing.' });
    }

    return res.status(201).json({ conversation });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const conversation = await getConversation(req.user.sub, req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    return res.json({ conversation });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const body = messageSchema.parse(req.body);
    const conversation = await addMessage(req.user.sub, req.params.id, body.body);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    return res.status(201).json({ conversation });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
