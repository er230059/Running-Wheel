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

function setSpeedEase(speed, acceleration, done) {
	var speedPastSetTmp = speedPastSet;
	var speedDiff = speed - speedPastSetTmp;
	var a;

	if(acceleration == 0) {
		a = 15;
	} else if (acceleration == 1) {
		a = 10
	} else if (acceleration == 2) {
		a = 5;
	}

	if(Math.abs(speedDiff) > 1) {
		var i = 0;
		async.whilst(
			function() { return i < a; },
			function(callback) {
				var speedToSet;
				i++;
				if (speedDiff > 2) {
					speedToSet = Math.round((speedDiff * (1 - Math.exp((-(i*5) / a))) + speedPastSetTmp) * 10) / 10;
				} else if (speedDiff < 2) {
					speedToSet = Math.round((Math.abs(speedDiff) * (Math.exp((-(i*5) / a))) + speed) * 10) / 10;
				}
				setSpeed(speedToSet, function (err) {
					if(err) {
						callback(err);
					} else {
						setTimeout(function () {
							callback(null, i);
						}, 400);
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

module.exports = {
	speedPastSet: speedPastSet,
	setSpeed: setSpeed,
	setSpeedEase: setSpeedEase
}
