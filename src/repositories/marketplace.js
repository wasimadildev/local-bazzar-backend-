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
    const user = await User.create({
      name,
      phone,
      passwordHash,
      email: '',
      city: '',
      profilePhotoUrl: '',
      savedListingIds: [],
      savedSearches: [],
      favoriteSellerIds: [],
      followedCategoryIds: [],
      sellerRatings: []
    });

    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      passwordHash: user.passwordHash,
      email: user.email || '',
      city: user.city || '',
      profilePhotoUrl: user.profilePhotoUrl || ''
    };
  }

  return updateDb((db) => {
    const user = {
      id: randomUUID(),
      name,
      phone,
      passwordHash,
      email: '',
      city: '',
      profilePhotoUrl: '',
      savedListingIds: [],
      savedSearches: [],
      favoriteSellerIds: [],
      followedCategoryIds: [],
      sellerRatings: [],
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    return user;
  });
}

async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) return null;

  const sellerRatings = user.sellerRatings || [];
  const averageRating = sellerRatings.length
    ? sellerRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / sellerRatings.length
    : 0;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email || '',
    city: user.city || '',
    profilePhotoUrl: user.profilePhotoUrl || '',
    savedSearchCount: (user.savedListingIds || []).length,
    favoriteSellerCount: (user.favoriteSellerIds || []).length,
    followedCategoryCount: (user.followedCategoryIds || []).length,
    sellerRatingAverage: Number(averageRating.toFixed(2)),
    sellerRatingCount: sellerRatings.length
  };
}

async function updateProfile(userId, { name, city, email, profilePhotoUrl }) {
  const currentUser = await findUserById(userId);
  if (!currentUser) return null;

  const updateData = {
    name: name ?? currentUser.name,
    email: email ?? currentUser.email ?? '',
    city: city ?? currentUser.city ?? ''
  };

  if (profilePhotoUrl !== undefined) {
    updateData.profilePhotoUrl = profilePhotoUrl;
  }

  if (usingMongo()) {
    const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).lean();
    return user
      ? {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          city: user.city || '',
          profilePhotoUrl: user.profilePhotoUrl || ''
        }
      : null;
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.name = updateData.name;
    user.city = updateData.city;
    if (updateData.profilePhotoUrl !== undefined) {
      user.profilePhotoUrl = updateData.profilePhotoUrl;
    }
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      city: user.city || '',
      profilePhotoUrl: user.profilePhotoUrl || ''
    };
  });
}

async function listCategories() {
  return categories;
}

async function listListings({ query = '', categoryId = '', city = '', minPrice, maxPrice, condition = '', status = 'available', sort = '' }) {
  const normalizeStatus = (value) => {
    if (!value || value === 'available') return 'available';
    return ['available', 'reserved', 'sold', 'all'].includes(value) ? value : 'available';
  };

  status = normalizeStatus(status);

  if (usingMongo()) {
    const filter = status === 'all' ? { status: { $nin: ['hidden'] } } : { status };

    if (query) {
      filter.$text = { $search: query };
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (city) {
      filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (minPrice != null) {
      filter.price = filter.price || {};
      filter.price.$gte = minPrice;
    }

    if (maxPrice != null) {
      filter.price = filter.price || {};
      filter.price.$lte = maxPrice;
    }

    if (condition) {
      filter.condition = condition;
    }

    const sortOrder = sort === 'recent' ? { createdAt: -1 } : { createdAt: -1 };
    const listings = await Listing.find(filter).sort(sortOrder).lean();
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
    .filter((listing) => status === 'all' ? listing.status !== 'hidden' : listing.status === status)
    .filter((listing) => !loweredQuery || `${listing.title} ${listing.description}`.toLowerCase().includes(loweredQuery))
    .filter((listing) => !categoryId || listing.categoryId === categoryId)
    .filter((listing) => !loweredCity || listing.city.toLowerCase().includes(loweredCity))
    .filter((listing) => minPrice == null || listing.price >= minPrice)
    .filter((listing) => maxPrice == null || listing.price <= maxPrice)
    .filter((listing) => !condition || listing.condition === condition)
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
    const listing = await Listing.findById(id).lean();
    if (!listing) return null;
    return normalizeMongoListing(listing);
  }

  return (await readDb()).listings.find((item) => item.id === id) || null;
}

async function listSavedListings(userId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    if (!user) return [];
    const listings = await Listing.find({ _id: { $in: user.savedListingIds || [] }, status: 'available' })
      .sort({ createdAt: -1 })
      .lean();
    return listings.map(normalizeMongoListing);
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  const savedIds = new Set(user?.savedListingIds || []);
  return db.listings.filter((listing) => savedIds.has(listing.id) && listing.status === 'available');
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

async function saveSearch(userId, search) {
  if (usingMongo()) {
    const savedSearch = { ...search, id: randomUUID() };
    await User.findByIdAndUpdate(
      userId,
      { $push: { savedSearches: savedSearch } },
      { new: true }
    );
    return savedSearch;
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.savedSearches ||= [];
    const savedSearch = { id: randomUUID(), ...search };
    user.savedSearches.push(savedSearch);
    return savedSearch;
  });
}

async function listSavedSearches(userId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    return user?.savedSearches || [];
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  return user?.savedSearches || [];
}

async function deleteSavedSearch(userId, searchId) {
  if (usingMongo()) {
    await User.findByIdAndUpdate(userId, { $pull: { savedSearches: { id: searchId } } });
    return true;
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return false;
    user.savedSearches ||= [];
    user.savedSearches = user.savedSearches.filter((item) => item.id !== searchId);
    return true;
  });
}

async function listFavoriteSellers(userId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    return user?.favoriteSellerIds || [];
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  return user?.favoriteSellerIds || [];
}

async function setFavoriteSeller(userId, sellerId, favorite) {
  if (usingMongo()) {
    await User.findByIdAndUpdate(
      userId,
      favorite
        ? { $addToSet: { favoriteSellerIds: sellerId } }
        : { $pull: { favoriteSellerIds: sellerId } }
    );
    return { favorite };
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.favoriteSellerIds ||= [];
    if (favorite && !user.favoriteSellerIds.includes(sellerId)) {
      user.favoriteSellerIds.push(sellerId);
    }
    if (!favorite) {
      user.favoriteSellerIds = user.favoriteSellerIds.filter((id) => id !== sellerId);
    }
    return { favorite };
  });
}

async function listFollowedCategories(userId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    return user?.followedCategoryIds || [];
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  return user?.followedCategoryIds || [];
}

async function setFollowedCategory(userId, categoryId, follow) {
  if (usingMongo()) {
    await User.findByIdAndUpdate(
      userId,
      follow
        ? { $addToSet: { followedCategoryIds: categoryId } }
        : { $pull: { followedCategoryIds: categoryId } }
    );
    return { followed: follow };
  }

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    user.followedCategoryIds ||= [];
    if (follow && !user.followedCategoryIds.includes(categoryId)) {
      user.followedCategoryIds.push(categoryId);
    }
    if (!follow) {
      user.followedCategoryIds = user.followedCategoryIds.filter((id) => id !== categoryId);
    }
    return { followed: follow };
  });
}

async function getSellerProfile(sellerId, viewerId) {
  const seller = await findUserById(sellerId);
  if (!seller) return null;

  const sellerListings = usingMongo()
    ? await Listing.find({ 'seller.id': sellerId, status: { $nin: ['hidden'] } }).lean()
    : (await readDb()).listings.filter((listing) => listing.seller?.id === sellerId && listing.status !== 'hidden');

  const sellerRatings = seller.sellerRatings || [];
  const avgRating = sellerRatings.length
    ? sellerRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / sellerRatings.length
    : 0;

  const responseTime = Math.max(1, Math.round(30 - (await countSellerConversations(sellerId))));

  return {
    id: seller.id,
    name: seller.name,
    phone: seller.phone,
    email: seller.email || '',
    profilePhotoUrl: seller.profilePhotoUrl || '',
    city: seller.city || '',
    ratingAverage: Number(avgRating.toFixed(1)),
    ratingCount: sellerRatings.length,
    listingCount: sellerListings.length,
    responseTimeMinutes: responseTime,
    isFavorite: viewerId ? await isFavoriteSeller(viewerId, sellerId) : false
  };
}

async function countSellerConversations(sellerId) {
  if (usingMongo()) {
    return await Conversation.countDocuments({ 'seller.id': sellerId });
  }

  const db = await readDb();
  return db.conversations?.filter((item) => item.seller.id === sellerId).length || 0;
}

async function isFavoriteSeller(userId, sellerId) {
  if (usingMongo()) {
    const user = await User.findById(userId).lean();
    return (user?.favoriteSellerIds || []).includes(sellerId);
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  return (user?.favoriteSellerIds || []).includes(sellerId);
}

async function rateSeller(sellerId, raterId, rating, comment) {
  const ratingEntry = {
    id: randomUUID(),
    raterId,
    rating,
    comment: comment || '',
    createdAt: new Date().toISOString()
  };

  if (usingMongo()) {
    const seller = await User.findByIdAndUpdate(
      sellerId,
      { $push: { sellerRatings: ratingEntry } },
      { new: true }
    ).lean();
    return seller ? seller : null;
  }

  return updateDb((db) => {
    const seller = db.users.find((item) => item.id === sellerId);
    if (!seller) return null;
    seller.sellerRatings ||= [];
    seller.sellerRatings.push(ratingEntry);
    return seller;
  });
}

async function changeListingStatus(listingId, sellerId, status) {
  const allowed = ['available', 'reserved', 'sold'];
  if (!allowed.includes(status)) return null;

  if (usingMongo()) {
    const listing = await Listing.findOneAndUpdate(
      { _id: listingId, 'seller.id': sellerId },
      { $set: { status } },
      { new: true }
    ).lean();
    return listing ? normalizeMongoListing(listing) : null;
  }

  return updateDb((db) => {
    const listing = db.listings.find((item) => item.id === listingId && item.seller?.id === sellerId);
    if (!listing) return null;
    listing.status = status;
    listing.updatedAt = new Date().toISOString();
    return listing;
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
  listSavedSearches,
  deleteSavedSearch,
  saveSearch,
  listFavoriteSellers,
  setFavoriteSeller,
  listFollowedCategories,
  setFollowedCategory,
  getSellerProfile,
  rateSeller,
  changeListingStatus,
  listUserListings,
  setListingSaved,
  updateProfile
};
