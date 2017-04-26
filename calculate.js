const assert = require('assert');
const mongodb = require('mongodb');

const mongoURL = 'mongodb://localhost:27017/kaltiot'

var MongoClient = mongodb.MongoClient;

const cornerBeacons = {
    '5d': {
        x: 0,
        y: 0
    }, 
    '5a': {
        x: 0,
        y: 6,
    }, 
    '51': {
        x: 6,
        y: 6,
    }, 
    '5c': {
        x: 6,
        y: 0
    }
};

var map = Object.assign({}, cornerBeacons);

// RSSI to Meters calculation
const model = {
    refRssi: -61.5,
    a: 1.280070337,
    b: 6.7078096,
    maxRssi: -60,
    minRssi: -95,
};
function getDistance(rssi) {
    const x = rssi / model.refRssi;
    return model.a * Math.pow(x, model.b);
};

// Beacon helpers
function isBeaconIDValid(id) {
    // All our beacons start with e2
    return (id.substring(0, 2) == 'e2');
}
function getBeaconID(id) {
    return id.substring(id.length - 2);
}
function getClosest(beacons) {
    var closest = null;
    var minDistance = -100;
    for (var beaconID in beacons) {
        if (isBeaconIDValid(beaconID)) {
            var distance = beacons[beaconID];
            if (distance > minDistance) {
                closest = { beaconID: distance };
                minDistance = distance;
            }
        }
    }
    return closest;
}
function getRSSIto(beacon, beacons) {
    for (var beaconID in beacons) {
        if (isBeaconIDValid(beaconID)) {
            var shortID = getBeaconID(beaconID);
            if (shortID == beacon) return beacons[beaconID];
        }
    }
    return null;
}
function getLocation(triangle) {
    for (var vertice = 0; vertice < 3; vertice++) {
        
    }
}

MongoClient.connect(mongoURL, function (err, db) {
    assert.equal(null, err);
    console.log("Successfully connected to database");
    var session = db.collection('session53');
    session.find({}).toArray(function(err, docs) {
        assert.equal(err, null);
        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            var target = getClosest(doc.payload.beacons);
            if (target != null) {
                var targetID = Object.keys(target)[0];
                var shortID = getBeaconID(targetID);
                if (!Object.keys(cornerBeacons).includes(shortID)) {
                    var triangle = [];
                    // Searching for corner beacons
                    for (var corner in cornerBeacons) {
                        var distToCorner = getRSSIto(corner, doc.payload.beacons);
                        if (distToCorner != null) triangle.push({ beaconID: corner, rssi: getDistance(distToCorner)});
                    }
                    if (triangle.length > 2) {
                        // Calculating approximate location, based on distance to corners
                    }
                    else {
                        // Here we can try to fetch distance to other beacons and use them
                    }
                }
            }
        }
    });
    db.close();
});
