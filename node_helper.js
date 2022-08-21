/*********************************

  Node Helper for MMM-AppleWeatherKit.

  This helper is responsible for the data pull from Dark Sky.
  At a minimum the API key, Latitude and Longitude parameters
  must be provided.  If any of these are missing, the request
  to Dark Sky will not be executed, and instead an error
  will be output the the MagicMirror log.

  Additional, this module supplies two optional parameters:

    units - one of "ca", "uk2", "us", or "si"
    lang - Any of the languages Dark Sky supports, as listed here: https://darksky.net/dev/docs#response-format

  The Dark Sky API request looks like this:

    https://api.darksky.net/forecast/API_KEY/LATITUDE,LONGITUDE?units=XXX&lang=YY

*********************************/

var NodeHelper = require("node_helper");
var request = require("request");
var moment = require("moment");
var jwt = require("jsonwebtoken");
var fs = require("fs");
const qs = require("querystring");

module.exports = NodeHelper.create({
  start: function () {
    console.log(
      "====================== Starting node_helper for module [" +
        this.name +
        "]"
    );
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "APPLE_WEATHERKIT_REQUEST") {
      const {
        appleDeveloperTeamId,
        appleServiceId,
        appleKeyId,
        latitude,
        longitude,
        language,
        appleWeatherKitKeyPath,
        timezone,
        countryCode,
      } = payload;
      console.log("PAYLOAD", payload);

      const tokOpts = {
        algorithm: "ES256",
        keyid: appleKeyId,
        jwtid: `${appleDeveloperTeamId}.${appleServiceId}`,
      };
      const claims = {
        iss: appleDeveloperTeamId,
        iat: new Date().getTime() / 1000,
        exp: new Date().getTime() / 1000 + 60 * 60 * 24 * 180, // 180 days
        sub: appleServiceId,
      };

      var privateKey = fs.readFileSync(appleWeatherKitKeyPath);
      var token = jwt.sign(claims, privateKey, tokOpts);

      const queryString = qs.stringify({
        timezone,
        countryCode,
        dataSets: "currentWeather,forecastNextHour,forecastDaily,weatherAlerts",
      });
      const url = `https://weatherkit.apple.com/api/v1/weather/${language}/${latitude}/${longitude}?${queryString}`;
      const req = {
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      request(req, (error, response, body) => {
        //console.log(`status code ${response.statusCode}`);
        if (!error && response.statusCode == 200) {
          var resp = JSON.parse(body);
          //console.log(resp);

          resp.instanceId = payload.instanceId;
          this.sendSocketNotification("APPLE_WEATHERKIT_RESPONSE", resp);
        } else {
          console.log(
            "[MMM-AppleWeatherKit] " +
              moment().format("D-MMM-YY HH:mm") +
              " ** ERROR ** " +
              error
          );
        }
      });
    }
  },
});
