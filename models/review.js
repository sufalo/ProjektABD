const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  review_id: { type: Number, required: true, unique: true },
  offer_id: { type: Number, required: true },
  user_id: { type: Number, required: true },
  comment: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  date: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false } );

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
