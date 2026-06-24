const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    id: String,
    url: String,
    thumbnailUrl: String,
    provider: { type: String, default: 'local' },
    publicId: String,
    fileName: String,
    thumbnailFileName: String
  },
  { _id: false }
);

const sellerSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    phone: String
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    categoryId: { type: String, required: true, index: true },
    categoryName: { type: String, required: true },
    city: { type: String, required: true, trim: true, index: true },
    condition: { type: String, enum: ['new', 'used'], default: 'used' },
    status: { type: String, enum: ['available', 'reserved', 'sold', 'hidden'], default: 'available', index: true },
    images: [imageSchema],
    seller: sellerSchema
  },
  { timestamps: true }
);

listingSchema.index({ title: 'text', description: 'text' });

listingSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Listing', listingSchema);
