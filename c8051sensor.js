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
	for(var i = 0; i < sensorBuffer.length - 1; i++) {
		if(sensorBuffer[i] == 0x01 && sensorBuffer[i + 1] == 0x02) {
			startPos = i;
			break;
		}
	}
	if(startPos != -1 && (sensorBuffer.length - startPos) >= 5) {
		var buf = new Buffer([sensorBuffer[startPos + 2], sensorBuffer[startPos + 3]]);
		speed = Math.round(buf.readUInt16BE(0) * 0.03685 * 100) / 100;
		var bIR = ('000' + sensorBuffer[startPos + 4].toString(2)).slice(-4);
		sensorData = {
			"IR": bIR.split('').reverse(),
			"speed": speed
		};
		sensorBuffer.splice(0,startPos + 5);
	}
});

function getData() {
	return sensorData;
}

module.exports = {
	getData: getData
}
