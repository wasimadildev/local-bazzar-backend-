const bcrypt = require('bcryptjs');
const express = require('express');
const { z } = require('zod');
const { signToken } = require('../middleware/auth');
const { createUser, findUserByPhone } = require('../repositories/marketplace');

const router = express.Router();

const authSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(6).max(30),
  password: z.string().min(6).max(120)
});

router.post('/register', async (req, res, next) => {
  try {
    const body = authSchema.extend({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    const existing = await findUserByPhone(body.phone);

    if (existing) {
      return res.status(409).json({ message: 'A user with this phone already exists.' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await createUser({ name: body.name, phone: body.phone, passwordHash });

    return res.status(201).json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        city: user.city || '',
        profilePhotoUrl: user.profilePhotoUrl || ''
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = authSchema.omit({ name: true }).parse(req.body);
    const user = await findUserByPhone(body.phone);

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid phone or password.' });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        city: user.city || '',
        profilePhotoUrl: user.profilePhotoUrl || ''
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
