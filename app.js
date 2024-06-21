const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const User = require('./models/user');
const Offer = require('./models/offer');
const Order = require('./models/order');
const Review = require('./models/review');
const loggerMiddleware = require('./logger');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // katalog gdzie mają być zapisywane pliki
  },
  filename: function (req, file, cb) {
    // unikalna nazwa pliku z oryginalnym rozszerzeniem
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

const app = express();
const port = 3000;

// polaczenie z MongoDB
mongoose.connect('mongodb://localhost:27017/strona', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Połączono z MongoDB'))
  .catch(err => console.error('Nie można połączyć z MongoDB', err));


app.use(loggerMiddleware);
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

// Middleware do obsługi sesji
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use(express.urlencoded({ extended: false }));

// Middleware do obsługi komunikatów w sesji
app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

// Endpointy:

// Endpoint do wyświetlania wszystkich ofert- strona główna
app.get('/', async (req, res) => {
  try {
    let sortOption;
    let sortDirection = parseInt(req.query.direction) || 1;
    let minPrice = parseFloat(req.query.minPrice) || 0;
    let maxPrice = parseFloat(req.query.maxPrice) || Infinity;

    switch (req.query.sort) {
      case 'name':
        sortOption = { title: sortDirection };
        break;
      case 'price':
        sortOption = { price: sortDirection };
        break;
      case 'rating':
        sortOption = { averageRating: sortDirection };
        break;
      default:
        sortOption = { _id: 1 };
    }

    // Pobieranie ofert wraz z ocenami, filtrowanie po cenie
    const offers = await Offer.aggregate([
      {
        $lookup: {
          from: 'reviews',
          localField: 'offer_id',
          foreignField: 'offer_id',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          averageRating: { $avg: "$reviews.rating" }
        }
      },
      {
        $match: {
          price: { $gte: minPrice, $lte: maxPrice }
        }
      },
      { $sort: sortOption }
    ]);

    const user = req.session.user;
    res.render('index', { offers, user, sort: req.query.sort, direction: sortDirection, minPrice: req.query.minPrice, maxPrice: req.query.maxPrice });
  } catch (err) {
    res.status(500).send(err);
  }
});


// Endpoint do wyświetlania wszystkich administratorów
app.get('/contact', async (req, res) => {
  try {
    const admins = await User.find({ role: 'administrator' });
    res.render('contact', { admins } )
  } catch (err) {
    res.status(500).send(err);
  }
});


// Endpoint do wyświetlania formularza logowania
app.get('/login', (req, res) => {
  res.render('login', { message: res.locals.message });
});

// Endpoint do obsługi logowania
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ login: username });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = user;

      // Utwórz pusty koszyk dla użytkownika, jeśli jeszcze go nie ma
      if (!req.session.cart) {
        req.session.cart = [];
      }

      req.session.message = 'Zalogowano pomyślnie';
      res.redirect('/');
    } else {
      req.session.message = 'Nieprawidłowy login lub hasło';
      res.redirect('/login');
    }
  } catch (err) {
    res.status(500).send(err);
  }
});


// Endpoint do wylogowania
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.redirect('/');
  });
});

// Endpoint do wyświetlania formularza rejestracji
app.get('/register', (req, res) => {
  res.render('register', { message: res.locals.message });
});

// Endpoint do obsługi rejestracji
app.post('/register', async (req, res) => {
  const { username, first_name, last_name, email, phone, password } = req.body;
  try {
    const users = await User.find({}, 'user_id').sort({ user_id: 1 });
    let newUserId = null;

    for (let i = 0; i < users.length; i++) {
      if (users[i].user_id !== i + 1) {
        newUserId = i + 1;
        break;
      }
    }

    if (!newUserId) {
      newUserId = users.length ? users[users.length - 1].user_id + 1 : 1;
    }

    const user = new User({
      user_id: newUserId,
      login: username,
      first_name,
      last_name,
      email,
      phone_number: phone,
      password
    });
    await user.save();
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    let errorMessage = 'Rejestracja nie powiodła się';

    if (err.message.includes('Email jest już zajęty')) {
      errorMessage = 'Email jest już zajęty';
    } else if (err.message.includes('duplicate key error') && err.message.includes('login_1')) {
      errorMessage = 'Nazwa użytkownika jest już zajęta';
    } else if (err.message.includes('Numer telefonu musi składać się z 9 cyfer')) {
      errorMessage = 'Numer telefonu musi składać się z 9 cyfer';
    } else if (err.message.includes('Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny')) {
      errorMessage = 'Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny';
    } else if (err.message.includes('Nazwa użytkownika musi składać się z conajmniej 3 znaków')) {
      errorMessage = 'Nazwa użytkownika musi składać się z conajmniej 3 znaków';
    } else if (err.message.includes('Format emaila niepoprawny')) {
      errorMessage = 'Format emaila niepoprawny';
    } else if (err.message.includes('Hasło musi zawierać conajmniej 6 znaków')) {
      errorMessage = 'Hasło musi zawierać conajmniej 6 znaków';
    }
    res.render('register', { message: errorMessage });
  }
});

// Endpoint do wyświetlania formularza edycji konta
app.get('/edit-account', (req, res) => {
  const user = req.session.user;

  if(!user) {
    return res.status(404).send('Odmowa dostępu');
  }
  res.render('edit-account', { user });
});

//Testowy endpoint, wypisuje użytkowników z bazy
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint do aktualizacji danych konta
app.post('/update-account', async (req, res) => {
  const userId = req.session.user._id;
  const { username, first_name, last_name, email, phone, password, confirm_password } = req.body;

  if (password != confirm_password) {
    return res.status(400).render('edit-account', {
      user: req.session.user,
      message: 'Hasło i jego potwierdzenie nie są zgodne'
    });
  }
  
  try {
    // Aktualizacja danych użytkownika w bazie danych
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        login: username,
        first_name: first_name,
        last_name: last_name,
        email: email,
        phone_number: phone,
        password: password
      },
      { new: true, runValidators: true } // runValidators włącza walidację
    );

    // Aktualizujemy dane użytkownika w sesji
    req.session.user = updatedUser;

    req.session.message = 'Dane użytkownika zostały zaktualizowane pomyślnie';
    res.redirect('/');
  } catch (err) {
    console.error(err);
    let errorMessage = 'Modyfikacja nie powiodła się';

    if (err.message.includes('Email jest już zajęty')) {
      errorMessage = 'Email jest już zajęty';
    } else if (err.message.includes('Numer telefonu musi składać się z 9 cyfer')) {
      errorMessage = 'Numer telefonu musi składać się z 9 cyfer';
    } else if (err.message.includes('Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny')) {
      errorMessage = 'Hasło musi zawierać conajmniej 1 dużą literę oraz 1 znak specjalny';
    } else if (err.message.includes('Nazwa użytkownika musi składać się z conajmniej 3 znaków')) {
      errorMessage = 'Nazwa użytkownika musi składać się z conajmniej 3 znaków';
    } else if (err.message.includes('Format emaila niepoprawny')) {
      errorMessage = 'Format emaila niepoprawny';
    } else if (err.message.includes('Hasło musi zawierać conajmniej 6 znaków')) {
      errorMessage = 'Hasło musi zawierać conajmniej 6 znaków';
    }

    res.render('edit-account', { user: req.session.user, message: errorMessage });
  }
});

// Endpoint do usunięcia konta użytkownika
app.post('/delete-account', async (req, res) => {
  try {
    const user = req.session.user;
    await User.findByIdAndDelete(user._id);
    
    req.session.destroy();

    res.redirect('/');
  } catch (err) {
    req.session.message = 'Wystąpił błąd podczas usuwania konta';
    res.redirect('/edit-account');
  }
});

// Endpoint do wyświetlania strony oferty
app.get('/offer/:id', async (req, res) => {
  try {
    const offer = await Offer.findOne({ offer_id: parseInt(req.params.id) });
    if (!offer) {
      return res.status(404).send('Oferta nie znaleziona');
    }

    const allUsers = await User.find();

    // Pobierz komentarze i oceny dla danej oferty
    const reviews = await Review.find({ offer_id: offer.offer_id });

    const user = req.session.user || null; // Sprawdź, czy użytkownik jest zalogowany
    let hasReviewed = false; // Domyślnie ustawiamy na false

    // Sprawdź, czy użytkownik jest zalogowany i czy wystawił już opinię dla tej oferty
    if (user) {
      const review = await Review.findOne({ offer_id: offer.offer_id, user_id: user.user_id });
      if (review) {
        hasReviewed = true; // Ustaw na true jeśli użytkownik już wystawił opinię
      }
    }

    res.render('offer', { offer, user, reviews, hasReviewed, allUsers });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint do wyświetlania formularza modyfikowania oferty
app.get('/offer/:id/edit', async (req, res) => {
  try {
    const offer = await Offer.findOne({ offer_id: parseInt(req.params.id) });
    if (!offer) {
      return res.status(404).send('Oferta nie znaleziona');
    }

    const user = req.session.user;

    // Sprawdź, czy użytkownik jest zalogowany i jest właścicielem oferty lub administratorem
    if (!user || (user.user_id !== offer.user_id && user.role !== 'administrator')) {
      return res.status(403).send('Odmowa dostępu');
    }

    res.render('edit-offer', { offer });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint do modyfikowania oferty
app.post('/offer/:id/edit', upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, image_url } = req.body;
    const offer = await Offer.findOne({ offer_id: parseInt(req.params.id) });
    if (!offer) {
      return res.status(404).send('Oferta nie znaleziona');
    }

    const user = req.session.user;

    if (!user || (user.user_id !== offer.user_id && user.role !== 'administrator')) {
      return res.status(403).send('Odmowa dostępu');
    }

    offer.title = title;
    offer.description = description;
    offer.price = price;

    // Jeśli nowy plik obrazu został przesłany, aktualizuje url
    if (req.file) {
      offer.image_url = `uploads/${req.file.filename}`;
    } else if (image_url) {
      offer.image_url = image_url;
    }

    await offer.save();

    res.redirect(`/offer/${offer.offer_id}`);
  } catch (error) {
    console.error(error);
    let errorMessage = 'Modyfikacja nie powiodła się';

    if (error.message.includes('Cena musi być wieksza od zera')) {
      errorMessage = 'Cena musi być wieksza od zera';
    }

    // Ponownie pobieranie oferty, aby przekazać aktualne dane do widoku
    const offer = await Offer.findOne({ offer_id: parseInt(req.params.id) });

    res.render('edit-offer', { offer, message: errorMessage });
  }
});


// Endpoint do usuwania oferty
app.post('/offer/:id/delete', async (req, res) => {
  try {
    const offer = await Offer.findOne({ offer_id: parseInt(req.params.id) });
    if (!offer) {
      return res.status(404).send('Oferta nie znaleziona');
    }

    const user = req.session.user;

    if (!user || (user.user_id != offer.user_id && user.role !== 'administrator')) {
      return res.status(403).send('Odmowa dostępu');
    }

    await Offer.findOneAndDelete({ offer_id: parseInt(req.params.id) });

    res.redirect('/');
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint do wyświetlania formularza dodawania oferty
app.get('/offers/add', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.redirect('/login'); // Przekierowanie użytkownika do formularza logowania, jeśli niezalogowany
  }
  res.render('add-offer');
});

// Endpoint do obsługi dodawania oferty
app.post('/offers/add', upload.single('image'), async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).send('Odmowa dostępu'); 
    }

    const { title, description, price, category, condition } = req.body;

    const offers = await Offer.find({}, 'offer_id').sort({ offer_id: 1 });
    let newOfferId = null;

    for (let i = 0; i < offers.length; i++) {
      if (offers[i].offer_id !== i + 1) {
        newOfferId = i + 1;
        break;
      }
    }

    if (!newOfferId) {
      newOfferId = offers.length ? offers[offers.length - 1].offer_id + 1 : 1;
    }

    const newOffer = new Offer({
      offer_id: newOfferId,
      title: title,
      description: description,
      price: price,
      user_id: user.user_id,
      category: category,
      condition: condition,
      image_url: req.file ? req.file.path : null // zapisz ścieżkę przesyłanego obrazu
    });

    await newOffer.save();

    res.redirect('/');
  } catch (error) {
    console.error(error);
    let errorMessage = 'Dodawanie nie powiodło się';

    if (error.message.includes('Cena musi być wieksza od zera')) {
      errorMessage = 'Cena musi być wieksza od zera';
    }
    res.render('add-offer', { message: errorMessage } );
  }
});

// Endpoint do dodawania produktu do koszyka
app.post('/cart/add/:id', async (req, res) => {
  const offerId = parseInt(req.params.id);
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  try {
    const offer = await Offer.findOne({ offer_id: offerId });
    if (!offer) {
      return res.status(404).send('Oferta nie znaleziona');
    }

    req.session.cart = req.session.cart || [];
    req.session.cart.push(offer);
    res.redirect('/');
  } catch (err) {
    console.error('Błąd podczas dodawania do koszyka:', err);
    res.status(500).send('Błąd podczas dodawania do koszyka');
  }
});

// Endpoint do wyświetlania zawartości koszyka
app.get('/cart', (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  const cart = req.session.cart || [];
  res.render('cart', { cart });
});

// Endpoint do usuwania produktu z koszyka
app.post('/cart/remove/:id', (req, res) => {
  const offerId = parseInt(req.params.id);
  if (req.session.cart) {
    const indexToRemove = req.session.cart.findIndex(item => item.offer_id === offerId);
    if (indexToRemove !== -1) {
      req.session.cart.splice(indexToRemove, 1);
    }
  }
  res.redirect('/cart');
});

// Endpoint do wyświetlania formularza zamówienia
app.get('/order', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.redirect('/login');
  }

  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.session.message = 'Koszyk jest pusty';
    return res.redirect('/cart');
  }

  res.render('order');
});

// Endpoint do przetwarzania zamówienia
app.post('/order', async (req, res) => {
  const user = req.session.user;
  const { street, city, zip, country, payment_method } = req.body;

  if (!user) {
    return res.redirect('/login');
  }

  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.session.message = 'Koszyk jest pusty';
    return res.redirect('/cart');
  }

  let maxOrderIdOrder = await Order.findOne().sort({ order_id: -1 });
  let newOrderId = maxOrderIdOrder ? maxOrderIdOrder.order_id + 1 : 1;

  try {
    // Utwórz zamówienie dla każdego produktu w koszyku
    for (const item of cart) {
      const newOrder = new Order({
        order_id: newOrderId,
        user_id: user.user_id,
        offer_id: item.offer_id,
        delivery_address: {
          street,
          city,
          zip,
          country
        },
        payment_method,
        order_date: new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ', ' +
          new Date().toLocaleTimeString('pl-PL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      await newOrder.save();

      newOrderId = newOrderId + 1;
    }

    // Wyczyść koszyk po złożeniu zamówienia
    req.session.cart = [];
    req.session.message = 'Zamówienie zostało złożone pomyślnie';
    res.redirect('/');
  } catch (error) {
    console.error(error);
    let errorMessage = 'Zamawianie nie powiodło się';

    if (error.message.includes('Nieprawidłowy kod pocztowy')) {
      errorMessage = 'Nieprawidłowy kod pocztowy';
    }
    res.render('order', { message: errorMessage } );
  }
});

//Endpoint do wyświetlania zamówień
app.get('/orders', async (req, res) => {
  const user = req.session.user;
  const offers = await Offer.find();
  if (!user) {
    return res.redirect('/login');
  }

  try {
    let orders;
    if (user.role === 'administrator') {
      orders = await Order.find().lean();
    } else {
      orders = await Order.find({ user_id: user.user_id }).lean();
    }

    res.render('view-orders', { orders, offers, user });
  } catch (err) {
    console.error('Błąd podczas pobierania ofert:', err);
    res.status(500).send('Błąd podczas pobierania ofert');
  }
});

// Endpoint do obsługi dodawania recenzji
app.post('/offer/:id/add-review', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).send('Odmowa dostępu'); // Niezalogowani użytkownicy nie mogą dodawać recenzji
    }

    const { comment, rating } = req.body;
    const offerId = req.params.id;

    // Sprawdź dostępne identyfikatory recenzji
    const reviews = await Review.find({}, 'review_id').sort({ review_id: 1 });
    let newReviewId = null;

    for (let i = 0; i < reviews.length; i++) {
      if (reviews[i].review_id !== i + 1) {
        newReviewId = i + 1;
        break;
      }
    }

    if (!newReviewId) {
      newReviewId = reviews.length ? reviews[reviews.length - 1].review_id + 1 : 1;
    }

    // Utwórz nową recenzję
    const newReview = new Review({
      review_id: newReviewId,
      offer_id: offerId,
      user_id: user.user_id,
      comment: comment,
      rating: rating,
      date: new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ', ' +
      new Date().toLocaleTimeString('pl-PL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    await newReview.save();

    res.redirect(`/offer/${offerId}`);
  } catch (err) {
    console.error('Błąd podczas dodawania oceny:', err);
    res.status(500).send(err);
  }
});

//Endpoint do usuwania recenzji
app.post('/deleteReview/:id', async (req, res) => {
  try {
    const review_id = parseInt(req.params.id);
    const review = await Review.findOne({ review_id });

    // Sprawdź, czy zalogowany użytkownik jest autorem recenzji
    if (review && req.session.user && req.session.user.user_id === review.user_id) {
      await Review.deleteOne({ review_id });
      res.redirect('back'); // Przekierowanie z powrotem do strony oferty
    } else {
      res.status(403).send('Odmowa dostępu');
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

// Uruchomienie serwera
app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});
