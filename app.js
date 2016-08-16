var http = require('http');
var express = require('express');
var app = express();
var server = http.Server(app);
var io = require('socket.io')(server);
var i2c = require('i2c');
var SerialPort = require('serialport');

var IR = [0, 0, 0, 0];
var speedFeedback = 0;

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

var sensorBuffer = [];
sensorPort.on('data', function (data) {
	for(var i = 0; i < data.length; i++) {
		sensorBuffer.push(data[i]);
	}
	var startPos = -1;
	for(var i = 0; i < sensorBuffer.length - 1; i++) {
		if(sensorBuffer[i] == 0x01 && sensorBuffer[i + 1] == 0x02) {
			startPos = i + 2;
		}
	}
	if(startPos != -1 && (sensorBuffer.length - startPos) >= 3) {
		var buf = new Buffer([sensorBuffer[startPos], sensorBuffer[startPos + 1]]);
		speedFeedback = Math.round(buf.readUInt16BE(0) * 0.03685 * 100) / 100;
		var bIR = ('000' + sensorBuffer[startPos + 2].toString(2)).slice(-4);
		IR = bIR.split('').reverse();
		sensorBuffer.splice(startPos - 2, 5);
	}
	console.log("IR: " + IR + " Speed: " + speedFeedback);
});

app.use(express.static(__dirname));

app.use(function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(ip + ': '+ req.url);
	next();
});

server.listen(80, function () {
});