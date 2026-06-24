const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    phone: String
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    id: String,
    senderId: String,
    body: String,
    createdAt: String
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', index: true },
    listingTitle: String,
    listingImageUrl: String,
    buyer: participantSchema,
    seller: participantSchema,
    messages: [messageSchema]
  },
  { timestamps: true }
);

conversationSchema.index({ listingId: 1, 'buyer.id': 1, 'seller.id': 1 }, { unique: true });

conversationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
