var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var server = http.Server(app);
var io = require('socket.io')(server);
var motor = require('./motorcontrol');
var sensor = require('./c8051sensor');
var ppgSensor = require('./ppgsensor');

var IR = [1, 1, 1, 1];
var IR_total = [0, 0, 0, 0];
var speedFeedback;
var g_sensor = {};
var ppg = {};
var inTraining = false;
var endTime;
var currentSpeed = 0;
var timer;
var lock = false;

motor.setSpeed(0, function (err) {
	if(err) console.error(err);
});

setInterval(function () {
	var data = sensor.getData();
	if(Object.keys(data).length > 0) {
		IR = data.IR;
		speedFeedback = data.speed;
		if(IR[0] == 0) {
			IR_total[0]++;
		}
		if(IR[1] == 0) {
			IR_total[1]++;
		}
		if(IR[2] == 0) {
			IR_total[2]++;
		}
		if(IR[3] == 0) {
			IR_total[3]++;
		}
	}
}, 100);

setInterval(function () {
	var data = ppgSensor.getData();
	if(Object.keys(data).length > 0) {
		g_sensor = {
			"x": data.x,
			"y": data.y,
			"z": data.z
		};
		ppg = {
			"x1": data.ppg,
			"x10": data.ppgx10,
			"x100": data.ppgx100
		};
	}
}, 10);

setInterval(function () {
	var json = {
		"speed": speedFeedback,
		"IR": IR,
		"IR_total": IR_total,
		"g_sensor": g_sensor,
		"ppg": ppg,
		"timestamp": Date.now()
	};
	io.emit('sensor_data', JSON.stringify(json));
}, 50);

app.use(bodyParser.json());
app.use(express.static(__dirname + '/static'));

app.use(function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(ip + ': '+ req.url);
	next();
});

app.post('/traininginit', function (request, response) {
	var acceleration = parseInt(request.body.acceleration);
	var deceleration = parseInt(request.body.deceleration);
	var maxspeed = parseFloat(request.body.maxspeed);
	var minspeed = parseFloat(request.body.minspeed);
	var time = parseInt(request.body.time);

	if(inTraining) {

	} else {
		motor.setSpeedEase(maxspeed, acceleration, function (err) {
			if(err) {
				console.error(err);
			} else {
				inTraining = true;
				endTime = time * 60 * 1000 + Date.now();
				IR_total = [0, 0, 0, 0];
				currentSpeed = maxspeed;
				timer = setInterval(function () {
					if(Date.now() >= endTime) {
						if(!lock) {
							lock = true;
							motor.setSpeedEase(0, deceleration, function (err) {
								if(err) console.error(err);
								lock = false;
							});
							clearInterval(timer);
							inTraining = false;
						}
					} else {
						if(IR[0] == 0 || (IR[1] == 0 && IR[2] == 1)) {
							if(currentSpeed > minspeed) {
								if(!lock) {
									lock = true;
									var speedDiff = currentSpeed - minspeed;
									if(speedDiff > 3) {
										currentSpeed -= 3;
									} else {
										currentSpeed -= speedDiff
									}
									motor.setSpeedEase(currentSpeed, deceleration, function (err) {
										if(err) console.error(err);
										lock = false;
									});
								}
							}
						} else if(IR[3] == 0) {
							if(currentSpeed < maxspeed) {
								if(!lock) {
									lock = true;
									var speedDiff = maxspeed - currentSpeed;
									if(speedDiff > 3) {
										currentSpeed += 3;
									} else {
										currentSpeed += speedDiff
									}
									motor.setSpeedEase(currentSpeed, acceleration, function (err) {
										if(err) console.error(err);
										lock = false;
									});
								}
							}
						}
					}
				}, 100);
			}
		});
	}
});

server.listen(80, function () {
});
