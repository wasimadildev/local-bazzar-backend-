const { randomUUID } = require('crypto');
const { readDb, updateDb } = require('../store');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Conversation = require('../models/Conversation');

const categories = [
  { id: 'vehicles', name: 'Vehicles' },
  { id: 'mobiles', name: 'Mobiles' },
  { id: 'property', name: 'Property' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'jobs', name: 'Jobs' },
  { id: 'services', name: 'Services' }
];

function usingMongo() {
  return Boolean(process.env.MONGODB_URI);
}

async function findUserByPhone(phone) {
  if (usingMongo()) {
    const user = await User.findOne({ phone }).lean();
    return user
      ? { ...user, id: user._id.toString(), _id: undefined, __v: undefined }
      : null;
  }

  return (await readDb()).users.find((user) => user.phone === phone);
}

async function findUserById(id) {
  if (usingMongo()) {
    const user = await User.findById(id).lean();
    return user
      ? { ...user, id: user._id.toString(), _id: undefined, __v: undefined }
      : null;
  }

  return (await readDb()).users.find((user) => user.id === id);
}

async function createUser({ name, phone, passwordHash }) {
  if (usingMongo()) {
    const user = await User.create({ name, phone, passwordHash, savedListingIds: [] });
    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      passwordHash: user.passwordHash
    };
  }

  return updateDb((db) => {
    const user = {
      id: randomUUID(),
      name,
      phone,
      passwordHash,
      city: '',
      savedListingIds: [],
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    return user;
  });
}

async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    city: user.city || ''
  };
}

async function updateProfile(userId, { name, city }) {
  if (usingMongo()) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { name, city } },
      { new: true, runValidators: true }
    ).lean();

    return user ? { id: user._id.toString(), name: user.name, phone: user.phone, city: user.city || '' } : null;
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.name = name;
    user.city = city || '';
    return { id: user.id, name: user.name, phone: user.phone, city: user.city || '' };
  });
}

async function listCategories() {
  return categories;
}

async function listListings({ query = '', categoryId = '', city = '' }) {
  if (usingMongo()) {
    const filter = { status: 'active' };

    if (query) {
      filter.$text = { $search: query };
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (city) {
      filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 }).lean();
    return listings.map((listing) => ({
      ...listing,
      id: listing._id.toString(),
      createdAt: listing.createdAt?.toISOString?.() || listing.createdAt,
      updatedAt: listing.updatedAt?.toISOString?.() || listing.updatedAt,
      _id: undefined,
      __v: undefined
    }));
  }

  const db = await readDb();
  const loweredQuery = query.toLowerCase();
  const loweredCity = city.toLowerCase();

  return db.listings
    .filter((listing) => listing.status === 'active')
    .filter((listing) => !loweredQuery || `${listing.title} ${listing.description}`.toLowerCase().includes(loweredQuery))
    .filter((listing) => !categoryId || listing.categoryId === categoryId)
    .filter((listing) => !loweredCity || listing.city.toLowerCase().includes(loweredCity))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function listUserListings(userId) {
  if (usingMongo()) {
    const listings = await Listing.find({ 'seller.id': userId }).sort({ createdAt: -1 }).lean();
    return listings.map(normalizeMongoListing);
  }

  return (await readDb()).listings
    .filter((listing) => listing.seller?.id === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeMongoListing(listing) {
  return {
    ...listing,
    id: listing._id.toString(),
    createdAt: listing.createdAt?.toISOString?.() || listing.createdAt,
    updatedAt: listing.updatedAt?.toISOString?.() || listing.updatedAt,
    _id: undefined,
    __v: undefined
  };
}

async function findListingById(id) {
  if (usingMongo()) {
    const listing = await Listing.findOne({ _id: id, status: 'active' }).lean();
    if (!listing) return null;
    return normalizeMongoListing(listing);
  }

  return (await readDb()).listings.find((item) => item.id === id && item.status === 'active') || null;
}

async function listSavedListings(userId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    if (!user) return [];
    const listings = await Listing.find({ _id: { $in: user.savedListingIds || [] }, status: 'active' })
      .sort({ createdAt: -1 })
      .lean();
    return listings.map(normalizeMongoListing);
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  const savedIds = new Set(user?.savedListingIds || []);
  return db.listings.filter((listing) => savedIds.has(listing.id) && listing.status === 'active');
}

async function setListingSaved(userId, listingId, saved) {
  const listing = await findListingById(listingId);
  if (!listing) return null;

  if (usingMongo()) {
    await User.findByIdAndUpdate(
      userId,
      saved
        ? { $addToSet: { savedListingIds: listingId } }
        : { $pull: { savedListingIds: listingId } }
    );
    return { saved };
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.savedListingIds ||= [];
    if (saved && !user.savedListingIds.includes(listingId)) {
      user.savedListingIds.push(listingId);
    }
    if (!saved) {
      user.savedListingIds = user.savedListingIds.filter((id) => id !== listingId);
    }
    return { saved };
  });
}

async function createOrGetConversation({ listingId, buyerId }) {
  const listing = await findListingById(listingId);
  const buyer = await findUserById(buyerId);
  if (!listing || !buyer) return null;
  if (listing.seller.id === buyerId) return { ownListing: true };

  const payload = {
    listingId,
    listingTitle: listing.title,
    listingImageUrl: listing.images?.[0]?.thumbnailUrl || '',
    buyer: { id: buyer.id, name: buyer.name, phone: buyer.phone },
    seller: listing.seller,
    messages: []
  };

  if (usingMongo()) {
    const conversation = await Conversation.findOneAndUpdate(
      { listingId, 'buyer.id': buyerId, 'seller.id': listing.seller.id },
      { $setOnInsert: payload },
      { new: true, upsert: true }
    );
    return conversation.toJSON();
  }

  return updateDb((db) => {
    db.conversations ||= [];
    let conversation = db.conversations.find(
      (item) => item.listingId === listingId && item.buyer.id === buyerId && item.seller.id === listing.seller.id
    );
    if (!conversation) {
      conversation = {
        id: randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.conversations.push(conversation);
    }
    return conversation;
  });
}

async function listConversations(userId) {
  if (usingMongo()) {
    const conversations = await Conversation.find({
      $or: [{ 'buyer.id': userId }, { 'seller.id': userId }]
    }).sort({ updatedAt: -1 }).lean();
    return conversations.map((item) => ({
      ...item,
      id: item._id.toString(),
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt,
      _id: undefined,
      __v: undefined
    }));
  }

  return (await readDb()).conversations
    ?.filter((item) => item.buyer.id === userId || item.seller.id === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) || [];
}

async function getConversation(userId, conversationId) {
  const conversation = usingMongo()
    ? await Conversation.findById(conversationId).lean()
    : (await readDb()).conversations?.find((item) => item.id === conversationId);

  if (!conversation) return null;
  const normalized = usingMongo()
    ? { ...conversation, id: conversation._id.toString(), _id: undefined, __v: undefined }
    : conversation;

  if (normalized.buyer.id !== userId && normalized.seller.id !== userId) return null;
  return normalized;
}

async function addMessage(userId, conversationId, body) {
  const message = {
    id: randomUUID(),
    senderId: userId,
    body,
    createdAt: new Date().toISOString()
  };

  if (usingMongo()) {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        $or: [{ 'buyer.id': userId }, { 'seller.id': userId }]
      },
      {
        $push: { messages: message },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    return conversation?.toJSON() || null;
  }

  return updateDb((db) => {
    const conversation = db.conversations?.find((item) => item.id === conversationId);
    if (!conversation || (conversation.buyer.id !== userId && conversation.seller.id !== userId)) {
      return null;
    }
    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();
    return conversation;
  });
}

async function createListing(data) {
  if (usingMongo()) {
    const listing = await Listing.create(data);
    return listing.toJSON();
  }

  return updateDb((db) => {
    const listing = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.listings.push(listing);
    return listing;
  });
}

module.exports = {
  createListing,
  createUser,
  createOrGetConversation,
  addMessage,
  findListingById,
  findUserById,
  findUserByPhone,
  getConversation,
  getProfile,
  listConversations,
  listCategories,
  listListings,
  listSavedListings,
  listUserListings,
  setListingSaved,
  updateProfile
};
