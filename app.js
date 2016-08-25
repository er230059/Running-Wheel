var http = require('http');
var express = require('express');
var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);
var SerialPort = require('serialport');
var motor = require('./motorcontrol');

var ppgData;
var IR = [0, 0, 0, 0];
var speedFeedback = 0;

motor.setSpeed(0, function (err) {
	if(err) console.error(err);
});

var ppgPort = new SerialPort('/dev/ttyUSB0', {
	baudRate: 230400
});

var sensorPort = new SerialPort('/dev/ttyO4', {
	baudRate: 9600
});

ppgPort.on('open', function () {
	ppgPort.flush(function (err) {
		if (err) {
			console.error(err);
		}
		ppgPort.write([0x30, 0x20, 0x05, 0x64, 0x01, 0x01, 0x8B], function (err) {
			if (err) {
				console.error(err);
			}
		});
	});
});

ppgPort.on('error', function (err) {
	console.error(err);
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

sensorPort.on('open', function () {
});

sensorPort.on('error', function (err) {
	console.error(err);
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
