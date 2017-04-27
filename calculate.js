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
                closest = {};
                closest[beaconID] = distance;
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
// Based on "Intersection of two circles" - 
// http://paulbourke.net/geometry/circlesphere/
function getLocation(triangle) {
    if (triangle.length > 2) {
        var point1 = map[triangle[0].beaconID];
        var point2 = map[triangle[1].beaconID];
        var point3 = map[triangle[2].beaconID];
        var d = getDistanceBetweenPoints(point1, point2);
        // Except cases when there are no solutions
        if (d > (triangle[0].dist + triangle[1].dist) || d < Math.abs(triangle[0].dist - triangle[1].dist)) return null;
        var a = (Math.pow(triangle[0].dist, 2) - Math.pow(triangle[1].dist, 2) + Math.pow(d, 2)) / (2 * d);
        var h = Math.sqrt(Math.pow(triangle[0].dist, 2) - Math.pow(a, 2));
        var mid = {
            x: point1.x + a * (point2.x - point1.x) / d,
            y: point1.y + a * (point2.y - point1.y) / d
        };
        var location1 = {
            x: mid.x + h * (point2.y - point1.y) / d,
            y: mid.y - h * (point2.x - point1.x) / d,
        };
        var location2 = {
            x: mid.x - h * (point2.y - point1.y) / d,
            y: mid.y + h * (point2.x - point1.x) / d,
        };
        var distToLoc1 = getDistanceBetweenPoints(point3, location1);
        var distToLoc2 = getDistanceBetweenPoints(point3, location2);
        if (distToLoc1 > triangle[2].dist) return location2;
        else return location1;
    }
}
function getDistanceBetweenPoints(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
// Based on own calculations
function getLocationManual(triangle) {
    if (triangle.length > 2) {
        var p1 = map[triangle[0].beaconID];
        var p2 = map[triangle[1].beaconID];
        var p3 = map[triangle[2].beaconID];
        var r1 = triangle[0].dist;
        var r2 = triangle[1].dist;
        var r3 = triangle[2].dist;
        // Rearrange points, so that second is not on the same column as first or third
        if (p1.x == p2.x) {
            p2 = map[triangle[2].beaconID];
            r2 = triangle[2].dist;
            p3 = map[triangle[1].beaconID];
            r3 = triangle[1].dist;
        }
        else if (p3.x == p2.x) {
            p2 = map[triangle[0].beaconID];
            r2 = triangle[0].dist;
            p1 = map[triangle[1].beaconID];
            r1 = triangle[1].dist;
        }
        var rxy = function (point, distance) {
            return (Math.pow(distance, 2) - Math.pow(point.x, 2) - Math.pow(point.y, 2)) / 2;
        };
        var common = (p1.x - p2.x) / (p3.x - p2.x);
        var yNumerator = rxy(p3, r3) * common - rxy(p2, r2) * common + rxy(p2, r2) - rxy(p1, r1);
        var yDenominator = (p2.y - p3.y) * common - (p2.y - p1.y);
        var y = yNumerator / yDenominator;
        var x = (rxy(p2, r2) - rxy(p1, r1) + y * (p2.y - p1.y)) / (p1.x - p2.x);
        return {
            x: x,
            y: y
        };
    }
}

MongoClient.connect(mongoURL, function (err, db) {
    assert.equal(null, err);
    console.log("Successfully connected to database");
    var session = db.collection('session53');
    session.find({}).toArray(function (err, docs) {
        assert.equal(err, null);
        console.log('Start calculations for ' + docs.length + ' points');
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
                        if (distToCorner != null) {
                            triangle.push({ beaconID: corner, dist: getDistance(distToCorner) });
                        }
                    }
                    if (triangle.length > 2) {
                        // Calculating approximate location, based on distance to corners
                        var targetLocation = getLocationManual(triangle);
                        if (targetLocation != null) {
                            map[shortID] = targetLocation;
                            if (map[shortID].all == null) {
                                map[shortID].all = [];
                                map[shortID].all.push(targetLocation);
                            }
                            else map[shortID].all.push(targetLocation);
                        }
                    }
                    else {
                        // Here we can try to fetch distance to other beacons and use them
                    }
                }
            }
        }
        db.close();
        // Calculate average
        for (var node in map) {
            if (node.all != null) {
                var sumX = 0;
                var sumY = 0;
                for (var i = 0; i < node.all.length; i++) {
                    sumX += node.all[i].x;
                    sumY += node.all[i].y;
                }
                node.x = sumX / node.all.length;
                node.y = sumY / node.all.length;
            }
        }
        console.log(map);
    });
});
