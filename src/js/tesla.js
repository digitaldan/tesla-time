var telsaApiURL = "https://owner-api.teslamotors.com",
		clientId = atob("ZTRhOTk0OWZjZmEwNDA2OGY1OWFiYjVhNjU4ZjJiYWMwYTM0MjhlNDY1MjMxNTQ5MGI2NTlkNWFiM2YzNWE5ZQ=="),
		clientSecret = atob("Yzc1ZjE0YmJhZGM4YmVlM2E3NTk0NDEyYzMxNDE2ZjgzMDAyNTZkNzY2OGVhN2U2ZTdmMDY3MjdiZmI5ZDIyMA=="),
		loadingStatus;

/* Utils */
function teslaErrorCallback(data) {
  jlog(data);
  Pebble.showSimpleNotificationOnPebble("Communication Error", "Couldn't talk to Tesla servers. Check your email and password in the app settings.");
	localStorage.removeItem("accessToken");
}

function getState(endpoint, callback) {
  reqwest({
    method: "GET",
    url: telsaApiURL + "/api/1/vehicles/" + vehicleId + endpoint,
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    type: "json",
    contentType: "application/json",
    success: function(json) {
      callback(json.response, json);
    },
    error: teslaErrorCallback
  });
}

function postCommand(endpoint, options, callback) {
	if (options === undefined) { options = {}; }
	if (callback === undefined) { callback = function(){}; }

	log(telsaApiURL + "/api/1/vehicles/" + vehicleId + "/command/" + endpoint);
	jlog(options);
  reqwest({
    method: "POST",
    url: telsaApiURL + "/api/1/vehicles/" + vehicleId + "/command/" + endpoint,
    data: options,
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    type: "json",
    success: function(json) {
      callback(json.response, json);
    },
    error: teslaErrorCallback
  });
}

/* Login */

function doLogin() {
	MessageQueue.sendAppMessage({loading_status: 2});

  reqwest({
    method: "POST",
    url: telsaApiURL + "/oauth/token",
    data: {
  		grant_type: "password",
  		client_id: clientId,
  		client_secret: clientSecret,
  		email: settings.email,
  		password: settings.password
  	},
    type: "json",
    success: function(json) {
  		log("Logged in!");
      jlog(json);
  		accessToken = json.access_token;
  		localStorage.setItem("accessToken", accessToken);

  		getVehicle();
  	},
    error: teslaErrorCallback
  });
}

/* State */

function getVehicle() {
	MessageQueue.sendAppMessage({loading_status: 3});

  reqwest({
    method: "GET",
    url: telsaApiURL + "/api/1/vehicles",
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    type: "html",
    contentType: "application/json",
    success: function(data) {
  		// Vehicle IDs are BIGINTs, so JSON cuts off the bits. Have to scrape it out as a string.
  		var matches = /"id":(\d*)/.exec(data);
  		vehicleId = matches[1];
  		localStorage.setItem("vehicleId", vehicleId);
  		log("Got a vehicle! " + vehicleId);

  		getOverview();
  	},
    error: teslaErrorCallback
  });
}

function getOverview() {
	loadingStatus = 4;
	MessageQueue.sendAppMessage({loading_status: loadingStatus});

  getState("/data_request/vehicle_state", function(response) {
		loadingStatus += 8;
		MessageQueue.sendAppMessage({loading_status: loadingStatus});

		MessageQueue.sendAppMessage({vehicle_name: response.vehicle_name});
	});

	getState("/data_request/charge_state", function(response) {
		loadingStatus += 16;
		MessageQueue.sendAppMessage({loading_status: loadingStatus});

		MessageQueue.sendAppMessage({rated_range: response.battery_range * 100});
		MessageQueue.sendAppMessage({charging_state: response.charging_state});
	});

	getState("/data_request/drive_state", function(response) {
		loadingStatus += 32;
		MessageQueue.sendAppMessage({loading_status: loadingStatus});

		reverseGeocode(response.latitude, response.longitude, function(json) {
      Pebble.sendAppMessage({location: json.results[0].formatted_address.substring(0,48)});
    });
	});

	getState("/data_request/gui_settings", function(response) {
		loadingStatus += 64;
		MessageQueue.sendAppMessage({loading_status: loadingStatus});

		MessageQueue.sendAppMessage({is_metric: response.gui_distance_units === "mi/hr" ? 0 : 1});
	});
}
