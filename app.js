var async = require('async');
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
var IR_total = [0, 0, 0, 0, 0];
var speedFeedback = 0;
var g_sensor = {
	"x": 0,
	"y": 0,
	"z": 0
};
var ppg = {
	"x1": 0,
	"x10": 0,
	"x100": 0
};
var currentSpeed = 0;
var startTime = 0;
var endTime = 0;
var trainingParams = {
	"acceleration": 0,
	"deceleration": 0,
	"maxspeed": 0,
	"minspeed": 0,
	"time": 0,
	"inTraining": false
};
var timer;
var loopPerSecond = 10;

motor.setSpeed(0, function (err) {
	if(err) console.error(err);
});

setInterval(function () {
	var data = sensor.getData();
	if(Object.keys(data).length > 0) {
		IR = data.IR;
		speedFeedback = data.speed;
		if(trainingParams.inTraining) {
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
			if(IR[0] == 1 && IR[1] == 1 && IR[2] == 1 &&IR[3] == 1) {
				IR_total[4]++;
			}
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
		"training": trainingParams.inTraining,
		"start_time": startTime,
		"end_time": endTime,
		"timestamp": Date.now()
	};
	io.emit('sensor_data', JSON.stringify(json));
}, 15);

function trainingLoop () {
	if(Date.now() >= endTime) {
		clearInterval(timer);

		var i = 0;
		async.whilst(
			function() { return i < (currentSpeed / (trainingParams.deceleration / loopPerSecond)); },
			function(callback) {
				i++;
				currentSpeed -= trainingParams.deceleration / loopPerSecond;
				motor.setSpeed(currentSpeed, function (err) {
					if(err) {
						callback(err);
					} else {
						setTimeout(function () {
							callback(null, i);
						}, 1000 / loopPerSecond);
					}
				});
			},
			function (err, n) {
				if(err) {
					console.error(err);
				} else {
					motor.setSpeed(0, function (err) {
						if(err) {
							console.error(err);
						}
					});
				}
				io.emit('training_state_update', '');
				trainingParams.inTraining = false;
			}
		);
	} else {
		if(IR[0] == 0 || (IR[1] == 0 && IR[2] == 1)) {
			if(currentSpeed > trainingParams.minspeed) {
				if((currentSpeed - trainingParams.deceleration / loopPerSecond) < trainingParams.minspeed) {
					currentSpeed = trainingParams.minspeed;
				} else {
					currentSpeed -= trainingParams.deceleration / loopPerSecond;
				}
				motor.setSpeed(currentSpeed, function (err) {
					if(err) console.error(err);
				});
			}
		} else if(IR[3] == 0) {
			if(currentSpeed < trainingParams.maxspeed) {
				if((currentSpeed + trainingParams.acceleration / loopPerSecond) > trainingParams.maxspeed) {
					currentSpeed = trainingParams.maxspeed;
				} else {
					currentSpeed += trainingParams.acceleration / loopPerSecond;
				}
				motor.setSpeed(currentSpeed, function (err) {
					if(err) console.error(err);
				});
			}
		}
	}
}

app.use(bodyParser.json());
app.use(express.static(__dirname + '/static'));

app.use(function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(ip + ': '+ req.url);
	next();
});

app.get('/trainingParams', function (request, response) {
	var json = {
		"acceleration": trainingParams.acceleration,
		"deceleration": trainingParams.deceleration,
		"maxspeed": trainingParams.maxspeed,
		"minspeed": trainingParams.minspeed,
		"time":  trainingParams.time,
		"training": trainingParams.inTraining
	};
	response.contentType('application/json');
	response.send(JSON.stringify(json));
});

app.post('/training_stop', function (request, response) {
	if(trainingParams.inTraining) {
		clearInterval(timer);
		trainingParams.inTraining = false;

		motor.setSpeed(0, function (err) {
			if(err) {
				console.error(err);
			}
			io.emit('training_state_update', '');
		});
	}
	response.end();
});

app.post('/training_init', function (request, response) {
	var time = parseInt(request.body.time);
	var acceleration = parseFloat(request.body.acceleration);
	var deceleration = parseFloat(request.body.deceleration);
	var maxspeed = parseFloat(request.body.maxspeed);
	var minspeed = parseFloat(request.body.minspeed);

	if(!acceleration || acceleration <= 0) {
		response.send('failed');
	} else if (!deceleration || deceleration <= 0) {
		response.send('failed');
	} else if (!maxspeed || maxspeed <= 0) {
		response.send('failed');
	} else if (!minspeed || minspeed <= 0) {
		response.send('failed');
	} else if (maxspeed > 40) {
		response.send('failed');
	} else if (!time || time <= 0) {
		response.send('failed');
	} else if (maxspeed < minspeed) {
		response.send('failed');
	} else if(trainingParams.inTraining) {
		response.send('failed');
	} else {
		trainingParams.inTraining = true;
		trainingParams.acceleration = acceleration;
		trainingParams.deceleration = deceleration;
		trainingParams.maxspeed = maxspeed;
		trainingParams.minspeed = minspeed;
		trainingParams.time = time;
		io.emit('training_state_update', '');
		startTime = Date.now();
		endTime = trainingParams.time * 60 * 1000 + startTime;
		IR_total = [0, 0, 0, 0, 0];
		currentSpeed = 0;

		var i = 0;
		async.whilst(
			function() { return (i < trainingParams.maxspeed / (trainingParams.acceleration / loopPerSecond)) && trainingParams.inTraining; },
			function(callback) {
				i++;
				currentSpeed += trainingParams.acceleration / loopPerSecond;
				motor.setSpeed(currentSpeed, function (err) {
					if(err) {
						callback(err);
					} else {
						setTimeout(function () {
							callback(null);
						}, 1000 / loopPerSecond);
					}
				});
			},
			function (err, n) {
				if(err) {
					console.error(err);
				} else {
					motor.setSpeed(trainingParams.maxspeed, function (err) {
						if(err) {
							console.error(err);
						} else {
							timer = setInterval(trainingLoop, 1000 / loopPerSecond);
						}
					});
				}
			}
		);
		response.end();
	}
});

server.listen(80, function () {
});
