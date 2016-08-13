var i2c = require('i2c');
var SerialPort = require('serialport');

var speedValue = 0;
var speedDAC = new i2c(0x62, {device: '/dev/i2c-1'});

speedDAC.write([(0x0F & (speedValue >> 8)), (0xFF & speedValue)], function (err) {
	if(err) {
		console.log('DAC write error: ' + err);
	}
});

var ppgPort = new SerialPort('/dev/ttyUSB0', {
	baudRate: 230400
});

var sensorPort = new SerialPort('/dev/ttyO4', {
	baudRate: 9600
});

ppgPort.on('open', function() {
	ppgPort.write([0x30, 0x20, 0x05, 0x0A, 0x01, 0x01, 0x31], function(err) {
		if (err) {
			console.log('PPG write wrror: ', err);
		}
	});
});

ppgPort.on('error', function(err) {
	console.log('PPG error: ' + err);
})

ppgPort.on('data', function (data) {
	console.log('PPG data: ', data);
});

sensorPort.on('open', function() {
});

sensorPort.on('error', function(err) {
	console.log('Sensor module error: ' + err);
})

sensorPort.on('data', function (data) {
	console.log('Sensor module data: ', data);
});
