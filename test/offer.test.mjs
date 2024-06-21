import mongoose from 'mongoose';
import * as chai from 'chai';
import chaiHttp from 'chai-http';
import Offer from '../models/offer.js';

const expect = chai.expect;
chai.use(chaiHttp);

describe('Offer Model', function() {
  this.timeout(10000);

  before(function(done) {
    mongoose.connect('mongodb://localhost:27017/strona', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', () => {
      console.log('Connected to test database');
      done();
    });
  });

  describe('Create Offer', () => {
    it('should create a new offer', async () => {
      const newOffer = new Offer({
        offer_id: '1',
        title: 'Test Offer',
        description: 'This is a test offer',
        price: 100,
        image_url: 'http://example.com/image.jpg',
        condition: 'New',         
        category: 'Electronics',  
        user_id: '12'        
      });

      const offer = await newOffer.save();
      expect(offer).to.be.an('object');
      expect(offer).to.have.property('title').equal('Test Offer');
      expect(offer).to.have.property('price').equal(100);
    });

    it('should not create an offer without a title', async () => {
      const newOffer = new Offer({
        offer_id: '2',
        description: 'This offer has no title',
        price: 100,
        image_url: 'http://example.com/image.jpg',
        condition: 'Used',   
        category: 'Clothing',
        user_id: '11'
      });

      try {
        await newOffer.save();
      } catch (err) {
        expect(err).to.exist;
        expect(err.errors).to.have.property('title');
      }
    });
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
});
