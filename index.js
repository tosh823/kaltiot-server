const express = require('express');
const assert = require('assert');
const mongodb = require('mongodb');
const WebSocket = require('ws');


const PORT = process.env.PORT || 3000;
const mongoURL = 'mongodb://localhost:27017/kaltiot';
// Inserted mine APP ID
const APP_ID = 'ff712d4c-0ed2-11e7-8864';
const kaltiotURL = 'https://restapi.torqhub.io/rids/' + APP_ID + '/data_stream?ApiKey=kfJ9s9%2BpQ3SPMVD0MX9tVx7v2i5kKfVpSWOxvoNr%2FAVSZF2dsazRhPPaWuklyDBTOz75hML8zYQztlv6niMxJ%2FJkSltd%2BylmHLW98LqquYs%3D';

const app = express();

var MongoClient = mongodb.MongoClient;

const server = app.listen(PORT, function () {
    console.log('Server is running on http://localhost:' + PORT);
    MongoClient.connect(mongoURL, function (err, db) {
        assert.equal(null, err);
        console.log("Successfully connected to database");
        var date = new Date();
        var collName = 'session' + date.getUTCDay() + date.getUTCMonth();
        var collection = db.collection(collName);
        const ws = new WebSocket(kaltiotURL, {
            perMessageDeflate: false,
            origin: 'https://restapi.torqhub.io/',
            host: 'restapi.torqhub.io'
        });
        // Socket opened
        ws.on('open', function open() {
            console.log('Socket connected');
        });
        // Socket message
        ws.on('message', function incoming(data, flags) {
            var message = JSON.parse(data);
            // Some conversions
            message[0].payload = JSON.parse(message[0].payload.replace('/', ''));
            // Inserting record into database
            collection.insertOne(message[0], function(err, result) {
                assert.equal(null, err);
                console.log('Inserted ' + result.insertedId);
            });
        });
        // Socket closed
        ws.on('close', function close() {
            console.log('Socket disconnected');
            db.close();
        });
    });
});