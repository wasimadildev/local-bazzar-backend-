const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    email: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    profilePhotoUrl: { type: String, trim: true, default: '' },
    savedListingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    savedSearches: [
      {
        id: String,
        name: String,
        query: String,
        categoryId: String,
        city: String,
        minPrice: Number,
        maxPrice: Number,
        condition: String
      }
    ],
    favoriteSellerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followedCategoryIds: [{ type: String }],
    sellerRatings: [
      {
        raterId: String,
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: String
      }
    ]
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
