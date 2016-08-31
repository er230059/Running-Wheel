var i2c = require('i2c');

var speedDAC = new i2c(0x62, {device: '/dev/i2c-1'});

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

module.exports = {
	setSpeed: setSpeed
}
