var http = require('http');
var express = require('express');
var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);
var async = require('async');
var i2c = require('i2c');
var SerialPort = require('serialport');

var ppgData;
var IR = [0, 0, 0, 0];
var speedFeedback = 0;
var speedPastSet = 0;

var speedDAC = new i2c(0x62, {device: '/dev/i2c-1'});

setSpeed(0);

function setSpeed(speed) {
	var adcValue;
	if(speed >= 17) {
		adcValue = speed * 60.77;
	} else if (speed >= 10) {
		adcValue = speed * 62.5;
	} else {
		adcValue = speed * 55 + 93;
	}
	speedDAC.write([(0x0F & (adcValue >> 8)), (0xFF & adcValue)], function (err) {
		if(err) {
			console.log('DAC write error: ' + err);
		}
		speedPastSet = speed;
	});
}

function setSpeedEase(speed, acceleration) {
	var speedPastSetTmp = speedPastSet;
	var speedDiff = speed - speedPastSetTmp;
	if(speedDiff > 2) {
		var a;
		if(acceleration == 0) {
			a = 15;
		} else if (acceleration == 1) {
			a = 10
		} else if (acceleration == 2) {
			a = 5;
		}
		var i = 0;
		async.whilst(
			function() { return i < a; },
			function(callback) {
				i++;
				setSpeed(Math.round((speedDiff * (1 - Math.exp((-(i*5) / a))) + speedPastSetTmp) * 10) / 10);
				setTimeout(function() {
					callback(null, i);
				}, 500);
			},
			function (err, n) {
				setSpeed(speed);
			}
		);
	} else {
		setSpeed(speed);
	}
}

var ppgPort = new SerialPort('/dev/ttyUSB0', {
	baudRate: 230400
});

var sensorPort = new SerialPort('/dev/ttyO4', {
	baudRate: 9600
});

ppgPort.on('open', function() {
	ppgPort.flush(function(err) {
		if (err) {
			console.log('PPG flush wrror: ', err);
		}
		ppgPort.write([0x30, 0x20, 0x05, 0x64, 0x01, 0x01, 0x8B], function(err) {
			if (err) {
				console.log('PPG write wrror: ', err);
			}
		});
	});
});

ppgPort.on('error', function(err) {
	console.log('PPG error: ' + err);
})

var ppgBuffer = [];
ppgPort.on('data', function (data) {
	for(var i = 0; i < data.length; i++) {
		ppgBuffer.push(data[i]);
	}
	var startPos = -1;
	for(var i = 0; i < ppgBuffer.length - 2; i++) {
		if(ppgBuffer[i] == 0x30 && ppgBuffer[i + 1] == 0x20 && ppgBuffer[i + 2] == 0x13) {
			startPos = i;
			break;
		}
	}
	if(startPos != -1 && (ppgBuffer.length - startPos) >= 21) {
		var xAxisBuf = new Buffer([ppgBuffer[startPos + 8], ppgBuffer[startPos + 9]]);
		var yAxisBuf = new Buffer([ppgBuffer[startPos + 10], ppgBuffer[startPos + 11]]);
		var zAxisBuf = new Buffer([ppgBuffer[startPos + 12], ppgBuffer[startPos + 13]]);
		var ppgBuf = new Buffer([ppgBuffer[startPos + 14], ppgBuffer[startPos + 15]]);
		var ppg10Buf = new Buffer([ppgBuffer[startPos + 16], ppgBuffer[startPos + 17]]);
		var ppg100Buf = new Buffer([ppgBuffer[startPos + 18], ppgBuffer[startPos + 19]]);
		ppgData = {
			'sn': ppgBuffer[startPos + 3],
			'x': xAxisBuf.readUInt16BE(0),
			'y': yAxisBuf.readUInt16BE(0),
			'z': zAxisBuf.readUInt16BE(0),
			'ppg': ppgBuf.readUInt16BE(0),
			'ppgx10': ppg10Buf.readUInt16BE(0),
			'ppgx100': ppg100Buf.readUInt16BE(0)
		};
		ppgBuffer.splice(0, startPos + 21);
		console.log('PPG data: ' + JSON.stringify(ppgData));
	}
});

sensorPort.on('open', function() {
});

sensorPort.on('error', function(err) {
	console.log('Sensor module error: ' + err);
})

var sensorBuffer = [];
sensorPort.on('data', function (data) {
	for(var i = 0; i < data.length; i++) {
		sensorBuffer.push(data[i]);
	}
	var startPos = -1;
	for(var i = 0; i < sensorBuffer.length - 1; i++) {
		if(sensorBuffer[i] == 0x01 && sensorBuffer[i + 1] == 0x02) {
			startPos = i;
			break;
		}
	}
	if(startPos != -1 && (sensorBuffer.length - startPos) >= 5) {
		var buf = new Buffer([sensorBuffer[startPos + 2], sensorBuffer[startPos + 3]]);
		speedFeedback = Math.round(buf.readUInt16BE(0) * 0.03685 * 100) / 100;
		var bIR = ('000' + sensorBuffer[startPos + 4].toString(2)).slice(-4);
		IR = bIR.split('').reverse();
		sensorBuffer.splice(0,startPos + 5);
		console.log('IR: ' + IR + ' Speed: ' + speedFeedback);
	}
});

app.use(express.static(__dirname + '/static'));

app.use(function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(ip + ': '+ req.url);
	next();
});

server.listen(80, function () {
});