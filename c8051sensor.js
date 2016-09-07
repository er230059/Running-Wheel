var SerialPort = require('serialport');

var sensorData = {};
var sensorBuffer = [];

var sensorPort = new SerialPort('/dev/ttyO4', {
	baudRate: 9600
});

sensorPort.on('open', function () {
});

sensorPort.on('error', function (err) {
	console.error(err);
})

sensorPort.on('data', function (data) {
	for(var i = 0; i < data.length; i++) {
		sensorBuffer.push(data[i]);
	}
	var startPos = -1;
	for(var i = sensorBuffer.length - 1; i > 0; i--) {
		if(sensorBuffer[i] == 0x02 && sensorBuffer[i - 1] == 0x01) {
			startPos = i - 1;
			break;
		}
	}
	if(startPos != -1 && (sensorBuffer.length - startPos) >= 5) {
		var buf = new Buffer([sensorBuffer[startPos + 2], sensorBuffer[startPos + 3]]);
		speed = buf.readUInt16BE(0) * 0.03685;
		if(speed >= 20) speed += speed / 110;
		speed = Math.round(speed * 100) / 100
		var bIR = ('000' + sensorBuffer[startPos + 4].toString(2)).slice(-4);
		sensorData = {
			"IR": bIR.split('').reverse(),
			"speed": speed
		};
		sensorBuffer = [];
	}
});

function getData() {
	return sensorData;
}

module.exports = {
	getData: getData
}
