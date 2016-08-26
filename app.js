var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var server = http.Server(app);
var io = require('socket.io')(server);
var motor = require('./motorcontrol');
var ppg = require('./ppg');
var sensor = require('./c8051sensor');

motor.setSpeed(0, function (err) {
	if(err) console.error(err);
});

setInterval(function () {
	var json = {
		"speed": sensor.getData().speed,
		"IR": sensor.getData().IR,
		"IR_total": [1, 1, 1, 1],
		"g_sensor": {
			"x": ppg.getData().x,
			"y": ppg.getData().y,
			"z": ppg.getData().z
		},
		"ppg": {
			"x1": ppg.getData().ppg,
			"x10": ppg.getData().ppgx10,
			"x100": ppg.getData().ppgx100
		},
		"timestamp": Date.now()
	};
	io.emit('sensor_data', JSON.stringify(json));
}, 10);

app.use(bodyParser.json());
app.use(express.static(__dirname + '/static'));

app.use(function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(ip + ': '+ req.url);
	next();
});

server.listen(80, function () {
});
