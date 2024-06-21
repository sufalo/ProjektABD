const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_id: { type: Number, required: true },
  user_id: { type: Number, required: true },
  offer_id: { type: Number, required: true },
  delivery_address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true }
  },
  payment_method: { type: String, required: true },
  order_date: { type: String, default: () => new Date().toISOString() },
  status: { type: String, default: 'przetwarzanie' }
}, { versionKey: false } );

// Pre-save hook
orderSchema.pre('save', function(next) {
  const order = this;
  const zipRegex = /^[0-9]{2}-[0-9]{3}$/;
  
  if (!zipRegex.test(order.delivery_address.zip)) {
    const err = new Error('Nieprawidłowy kod pocztowy');
    return next(err);
  }
  
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
