const assert = require('assert');
const mongodb = require('mongodb');

const mongoURL = 'mongodb://localhost:27017/kaltiot'

var MongoClient = mongodb.MongoClient;

MongoClient.connect(mongoURL, function (err, db) {
    assert.equal(null, err);
    console.log("Successfully connected to database");
    var session = db.collection('session53');
});
