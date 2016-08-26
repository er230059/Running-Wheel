var SerialPort = require('serialport');

var ppgData = {};
var ppgBuffer = [];

var ppgPort = new SerialPort('/dev/ttyUSB0', {
	baudRate: 230400
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
			'x': xAxisBuf.readUInt16BE(0),
			'y': yAxisBuf.readUInt16BE(0),
			'z': zAxisBuf.readUInt16BE(0),
			'ppg': ppgBuf.readUInt16BE(0),
			'ppgx10': ppg10Buf.readUInt16BE(0),
			'ppgx100': ppg100Buf.readUInt16BE(0)
		};
		ppgBuffer.splice(0, startPos + 21);
	}
});

function getData() {
	return ppgData;
}

module.exports = {
	getData: getData
}
