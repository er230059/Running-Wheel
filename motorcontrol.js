var async = require('async');
var i2c = require('i2c');

var speedDAC = new i2c(0x62, {device: '/dev/i2c-1'});

var speedPastSet = 0;

function setSpeed(speed, callback) {
	var adcValue;
	if(speed >= 20) {
		adcValue = speed * 62.5 + 10;
	} else if (speed >= 10) {
		adcValue = speed * 62.5 + 30;
	} else {
		adcValue = speed * 55 + 93;
	}
	speedDAC.write([(0x0F & (adcValue >> 8)), (0xFF & adcValue)], function (err) {
		if(err) {
			callback(err);
		} else {
			speedPastSet = speed;
			callback(null);
		}
	});
}

function setSpeedEase(speed, a, done) {
	var speedDiff = speed - speedPastSet;
	var speedToSet = speedPastSet;;
	var a;

	var i = 0;
	async.whilst(
		function() { return i < Math.abs(speedDiff / a); },
		function(callback) {
			i++;
			if (speedDiff > 0) {
				speedToSet += a;
			} else if (speedDiff < 0) {
				speedToSet -= a;
			}
			setSpeed(speedToSet, function (err) {
				if(err) {
					callback(err);
				} else {
					setTimeout(function () {
						callback(null, i);
					}, 500);
				}
			});
		},
		function (err, n) {
			if(err) {
				done(err);
			} else {
				setSpeed(speed, function (err) {
					if(err) {
						done(err);
					} else {
						done();
					}
				});
			}
		}
	);
}

module.exports = {
	speedPastSet: speedPastSet,
	setSpeed: setSpeed,
	setSpeedEase: setSpeedEase
}
