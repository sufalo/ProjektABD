const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  user_id: { 
    type: Number,
    required: true,
    unique: true 
  },
  login: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: [3, 'Nazwa użytkownika musi składać się z conajmniej 3 znaków']
  },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/\S+@\S+\.\S+/, 'Format emaila niepoprawny']
  },
  phone_number: { 
    type: String, 
    required: true,
    match: [/^\d{9}$/, 'Numer telefonu musi składać się z 9 cyfer'] 
  },
  password: { 
    type: String, 
    required: true,
    minlength: [6, 'Hasło musi zawierać conajmniej 6 znaków'],
    validate: {
      validator: function(v) {
        return /(?=.*[A-Z])(?=.*[!@#$%^&*])/.test(v);
      },
      message: 'Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny'
    }
  },
  role: { type: String, default: 'user' }
}, { versionKey: false });

userSchema.pre('save', async function(next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  next();
});

userSchema.pre('save', async function(next) {
  const user = this;
  if (user.isModified('email')) {
    const existingUser = await User.findOne({ email: user.email });
    if (existingUser) {
      throw new Error('Email jest już zajęty');
    }
  }
  next();
});

// Pre-hook dla walidacji przy aktualizacji
userSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
    
  if (update.email) {
  const existingUser = await mongoose.models.User.findOne({ email: update.email });
  console.log(existingUser._id.toString());
  console.log(this.getQuery()._id);
  if (existingUser && existingUser._id.toString() != this.getQuery()._id) {
    
    throw new Error('Email jest już zajęty');
  }
  }

  if (update.password) {
    if (update.password.length < 6) {
      throw new Error('Hasło musi zawierać conajmniej 6 znaków');
    }
    if (!/(?=.*[A-Z])(?=.*[!@#$%^&*])/.test(update.password)) {
      throw new Error('Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny');
    }
    update.password = await bcrypt.hash(update.password, 10);
  }

  if (update.phone_number && !/^\d{9}$/.test(update.phone_number)) {
    throw new Error('Numer telefonu musi składać się z 9 cyfer');
  }

  if (update.login && update.login.length < 3) {
    throw new Error('Nazwa użytkownika musi składać się z conajmniej 3 znaków');
  }

  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
