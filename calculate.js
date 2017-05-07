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
        y: 6
    },
    '51': {
        x: 6,
        y: 6
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
    var distance = model.a * Math.pow(x, model.b);
    //console.log('Given ' + rssi + ' is ' + distance + 'm');
    return distance;
};

// Beacon helpers
function isBeaconIDValid(id) {
    // All our beacons start with e2
    return (id.substring(0, 2) == 'e2');
}
function getBeaconID(id) {
    return id.substring(id.length - 2);
}
function getClosest(beacons, min = -40) {
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
        //if (d > (triangle[0].dist + triangle[1].dist) || d < Math.abs(triangle[0].dist - triangle[1].dist)) return null;
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
        if (Math.abs(triangle[2].dist - distToLoc1) < Math.abs(triangle[2].dist - distToLoc2)) return location1;
        else return location2;
    }
}

/* Circle format is 
    {
        x:
        y:
        r:
    }
*/
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
    var solutionExist = function(c1, c2) {
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

function getIntersectionManual(circle1, circle2, circle3) {
    var p1 = circle1;
    var p2 = circle2;
    var p3 = circle3;
    var r1 = circle1.r;
    var r2 = circle2.r;
    var r3 = circle3.r;
    // Rearrange points, so that second is not on the same column as first or third
    if (p1.x == p2.x) {
        p2 = circle3;
        r2 = circle3.r;
        p3 = circle2;
        r3 = circle2.r;
    }
    else if (p3.x == p2.x) {
        p2 = circle1;
        r2 = circle1.r;
        p1 = circle2;
        r1 = circle2.r;
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
                    // Then calculate our beacon by two corners and this origin
                    var targetLocation = getIntersection(control[0], control[1], control[2]);
                    if (!targetLocation) continue;
                    map[shortID].measurements.push(targetLocation);
                }
            }
        }
        db.close();
        // Calculate average
        for (var node in map) {
            var beacon = map[node];
            var margin = 8;
            if (beacon.measurements != null) {
                var sumX = 0;
                var countX = 0;
                var currentAverageX = 0;
                var sumY = 0;
                var countY = 0;
                var currentAverageY = 0;
                for (var i = 0; i < beacon.measurements.length; i++) {
                    if (Math.abs(beacon.measurements[i].x - currentAverageX) < margin) {
                        sumX += beacon.measurements[i].x;
                        countX += 1;
                        currentAverageX = sumX / countX;
                    }
                    if (Math.abs(beacon.measurements[i].y - currentAverageY) < margin) {
                        sumY += beacon.measurements[i].y;
                        countY += 1;
                        currentAverageY = sumY / countY;
                    }
                    /*sumX += beacon.measurements[i].x;
                    sumY += beacon.measurements[i].y;*/
                }
                /*beacon.location = {
                    x: sumX / beacon.measurements.length,
                    y: sumY / beacon.measurements.length
                }*/
                beacon.location = {
                    x: sumX / countX,
                    y: sumY / countY
                }
            }
        }

        // Adding location 
        map['5d'].location = {x : 0, y : 0};
        map['5a'].location = {x : 0, y : 6};
        map['51'].location = {x : 6, y : 6};
        map['5c'].location = {x : 6, y : 0};

        delete map['59'];
        delete map['60'];
        delete map['61'];
        delete map['63'];

        for (var node in map) {
            console.log(node + ' - ' + JSON.stringify(map[node].location));
        }
        /*var test = map['64'];
        for (var i = 0; i < test.measurements.length; i++) {
            console.log(JSON.stringify(test.measurements[i]));
        }*/
    });
});
