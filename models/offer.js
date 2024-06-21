const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offer_id: { type: Number, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  user_id: { type: Number, required: true },
  category: { type: String, required: true },
  condition: { type: String, required: true },
  image_url: String
}, { versionKey: false } );

// Pre-save hook
offerSchema.pre('save', function(next) {
  if (this.price <= 0) {
    throw new Error('Cena musi być wieksza od zera');
  }

  next();
});

// Pre-findOneAndUpdate hook
offerSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.price !== undefined && update.price <= 0) {
    throw new Error('Cena musi być wieksza od zera');
  }

    next();
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
