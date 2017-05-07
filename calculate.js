const assert = require('assert');
const mongodb = require('mongodb');

const mongoURL = 'mongodb://localhost:27017/kaltiot'

var MongoClient = mongodb.MongoClient;

const cornerBeacons = {
    '5d': { x: 0, y: 0 },
    '5a': { x: 0, y: 6 },
    '51': { x: 6, y: 6 },
    '5c': { x: 6, y: 0 }
};

var map = {
    '5d': { real: { x: 0, y: 0 }, location: { x: 0, y: 0 } },
    '5a': { real: { x: 0, y: 6 }, location: { x: 0, y: 6 } },
    '51': { real: { x: 6, y: 6 }, location: { x: 6, y: 6 } },
    '5c': { real: { x: 6, y: 0 }, location: { x: 6, y: 0 } },
    '52': { real: { x: 2, y: 6 } },
    '53': { real: { x: 4, y: 6 } },
    '57': { real: { x: 0, y: 4 } },
    '64': { real: { x: 2, y: 4 } },
    '8f': { real: { x: 4, y: 4 } },
    '54': { real: { x: 6, y: 4 } },
    '55': { real: { x: 0, y: 2 } },
    '5e': { real: { x: 2, y: 2 } },
    '58': { real: { x: 4, y: 2 } },
    '5f': { real: { x: 6, y: 2 } },
    '56': { real: { x: 2, y: 0 } },
    '62': { real: { x: 4, y: 0 } }
};

// RSSI reference model
const model = {
    refRssi: -61.5,
    a: 1.280070337,
    b: 6.7078096,
    maxRssi: -60,
    minRssi: -95,
};

// Get meters from RSSI
function getDistance(rssi) {
    const x = rssi / model.refRssi;
    var distance = model.a * Math.pow(x, model.b);
    //console.log('Given ' + rssi + ' is ' + distance + 'm');
    return distance;
};

// Check if beacon ID is our legal ID
function isBeaconIDValid(id) {
    // All our beacons start with e2
    return (id.substring(0, 2) == 'e2');
}

// Get only last two symbols of ID
function getBeaconID(id) {
    return id.substring(id.length - 2);
}

// Get closest target from a set of beacon data
function getClosest(beacons, min = -60) {
    var closest = null;
    var minDistance = min;
    for (var beaconID in beacons) {
        if (isBeaconIDValid(beaconID)) {
            var distance = beacons[beaconID];
            if (distance > minDistance) {
                closest = beaconID;
                minDistance = distance;
            }
        }
    }
    return closest;
}

// Get RSSI to particular beacon in beacon set if exist
function getRSSIto(beacon, beacons) {
    for (var beaconID in beacons) {
        if (isBeaconIDValid(beaconID)) {
            var shortID = getBeaconID(beaconID);
            if (shortID == beacon) return beacons[beaconID];
        }
    }
    return null;
}

// Simply distance between two points
function getDistanceBetweenPoints(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

// Based on "Intersection of two circles" - 
// http://paulbourke.net/geometry/circlesphere/
function getIntersection(circle1, circle2, circle3) {
    var d = getDistanceBetweenPoints(circle1, circle2);
    // Exclude non existent cases
    if (d > (circle1.r + circle2.r)) return false;
    if (d < Math.abs(circle1.r - circle2.r)) return false;
    var a = (Math.pow(circle1.r, 2) - Math.pow(circle2.r, 2) + Math.pow(d, 2)) / (2 * d);
    var h = Math.sqrt(Math.pow(circle1.r, 2) - Math.pow(a, 2));
    var mid = {
        x: circle1.x + a * (circle2.x - circle1.x) / d,
        y: circle1.y + a * (circle2.y - circle1.y) / d
    };
    var location1 = {
        x: mid.x + h * (circle2.y - circle1.y) / d,
        y: mid.y - h * (circle2.x - circle1.x) / d,
    };
    var location2 = {
        x: mid.x - h * (circle2.y - circle1.y) / d,
        y: mid.y + h * (circle2.x - circle1.x) / d,
    };
    var distToLoc1 = getDistanceBetweenPoints(circle3, location1);
    var distToLoc2 = getDistanceBetweenPoints(circle3, location2);
    if (Math.abs(circle3.r - distToLoc1) < Math.abs(circle3.r - distToLoc2)) return location1;
    else return location2;
}

function getIntersectionUltimate(circle1, circle2, circle3) {
    var p1 = circle1;
    var p2 = circle2;
    var p3 = circle3;
    var solutionExist = function (c1, c2) {
        var distance = getDistanceBetweenPoints(c1, c2);
        if (distance > (c1.r + c2.r)) return false;
        if (distance < Math.abs(c1.r - c2.r)) return false;
        return true;
    }
    // Exclude non existent cases
    if (!solutionExist(p1, p2)) {
        p1 = circle1;
        p2 = circle3;
        p3 = circle2;
        if (!solutionExist(p1, p2)) {
            p1 = circle2;
            p2 = circle3;
            p3 = circle1;
            // Alright, there no way to calculate this shit
            if (!solutionExist(p1, p2)) return false;
        }
    }
    var d = getDistanceBetweenPoints(p1, p2);
    var a = (Math.pow(p1.r, 2) - Math.pow(p2.r, 2) + Math.pow(d, 2)) / (2 * d);
    var h = Math.sqrt(Math.pow(p1.r, 2) - Math.pow(a, 2));
    var mid = {
        x: p1.x + a * (p2.x - p1.x) / d,
        y: p1.y + a * (p2.y - p1.y) / d
    };
    var location1 = {
        x: mid.x + h * (p2.y - p1.y) / d,
        y: mid.y - h * (p2.x - p1.x) / d,
    };
    var location2 = {
        x: mid.x - h * (p2.y - p1.y) / d,
        y: mid.y + h * (p2.x - p1.x) / d,
    };
    var distToLoc1 = getDistanceBetweenPoints(p3, location1);
    var distToLoc2 = getDistanceBetweenPoints(p3, location2);
    if (Math.abs(p3.r - distToLoc1) < Math.abs(p3.r - distToLoc2)) return location1;
    else return location2;
}

function calculateAverages() {
    const grid = 6;
    const margin = 1;
    for (var node in map) {
        var beacon = map[node];
        if (beacon.measurements != null) {
            var sumX = 0;
            var countX = 0;
            var sumY = 0;
            var countY = 0;
            for (var i = 0; i < beacon.measurements.length; i++) {
                if (beacon.measurements[i].x > -margin && beacon.measurements[i].x < (grid + margin)) {
                    sumX += beacon.measurements[i].x;
                    countX += 1;
                }
                if (beacon.measurements[i].y > -margin && beacon.measurements[i].y < (grid + margin)) {
                    sumY += beacon.measurements[i].y;
                    countY += 1;
                }
            }
            beacon.location = {
                x: sumX / countX,
                y: sumY / countY
            }
        }
    }
}

function calculateErrors() {
    for (var node in map) {
        var beacon = map[node];
        if (beacon.location != null) {
            var errorX = Math.abs(beacon.location.x - beacon.real.x);
            var errorY = Math.abs(beacon.location.y - beacon.real.y);
            beacon.error = {
                x: errorX,
                y: errorY
            };
        }
    }
}

function calculateAverageError() {
    var errorX = 0;
    var errorY = 0;
    var count = 0;
    for (var node in map) {
        if (!Object.keys(cornerBeacons).includes(node)) {
            var beacon = map[node];
            errorX += beacon.error.x;
            errorY += beacon.error.y;
            count += 1;
        }
    }
    var averageX = (errorX / count).toFixed(2);
    var averageY = (errorY / count).toFixed(2);
    console.log('Average error is {' + averageX + ', ' + averageY + '}');
}

function displayMeasurements(beacon) {
    console.log('All measurements for ' + beacon);
    var test = map[beacon];
    for (var i = 0; i < test.measurements.length; i++) {
        console.log(i + ': ' + JSON.stringify(test.measurements[i]));
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
                var distToTarget = getDistance(doc.payload.beacons[target]);
                var shortID = getBeaconID(target);
                if (!Object.keys(cornerBeacons).includes(shortID)) {
                    var triangle = [];
                    var control = [];
                    if (map[shortID] == null) map[shortID] = {};
                    if (map[shortID].measurements == null) map[shortID].measurements = [];
                    // Searching for corner beacons
                    for (var corner in cornerBeacons) {
                        var distToCorner = getRSSIto(corner, doc.payload.beacons);
                        if (distToCorner != null) {
                            var circle = {
                                x: cornerBeacons[corner].x,
                                y: cornerBeacons[corner].y,
                                r: getDistance(distToCorner)
                            };
                            triangle.push(circle);
                            if (control.length < 2) control.push(circle);
                        }
                    }
                    if (triangle.length < 3) continue;
                    // Firstly define the location from which signal was emitted
                    // Because even smallest number with RSSI formula gives like 1 meter
                    var origin = getIntersection(triangle[0], triangle[1], triangle[2]);
                    if (!origin) continue;
                    control.push({
                        x: origin.x,
                        y: origin.y,
                        r: distToTarget
                    });
                    map[shortID].measurements.push(origin);
                    // Then calculate our beacon by two corners and this origin
                    var targetLocation = getIntersection(control[0], control[1], control[2]);
                    if (!targetLocation) continue;
                    map[shortID].measurements.push(targetLocation);
                }
            }
        }
        db.close();

        // Remove beacons that were in the box
        delete map['59'];
        delete map['60'];
        delete map['61'];
        delete map['63'];

        calculateAverages();
        calculateErrors();

        for (var node in map) {
            var beacon = map[node];
            var location = '{' + beacon.location.x.toFixed(2) + ', ' + beacon.location.y.toFixed(2) + '}';
            var error = '{' + beacon.error.x.toFixed(2) + ', ' + beacon.error.y.toFixed(2) + '}';
            console.log(node + ': ' + location + ' with error ' + error);
        }
        //displayMeasurements('8f');
        calculateAverageError();
    });
});
