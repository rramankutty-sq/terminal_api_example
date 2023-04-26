/**
 * Terminal Device Management
 * This code is used to manage the Terminal Device Sign In/Linking process.
 * The code will handle linking the Square Terminal device to a particular location.
 * For managing the creation and processing of payments, look for checkouts.js
 **/

const router = require("express").Router();
const axios = require("axios");
const crypto = require("crypto");
const User = require("../models").User;
const Op = require("sequelize").Op;

const CLIENT_ID = process.env.APPLICATION_ID;
const SECRET = process.env.SECRET;

function idempotency_key() {
  return crypto.randomBytes(32).toString("base64");
}

/*
 * Present location selector for a Square Terminal device
 */

router.get("/register_device", (req, res) => {
	if (req.auth.isLoggedIn) {
		User.findById(req.auth.userId).then(user => {
			// console.log("user", user);
			if (user) {
				axios
					.get("https://connect.squareup.com/v2/locations", {
						headers: {
							Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
						}
					})
					.then(location_response => location_response.data)
					.then(locdata => {
						//Filter locations to only those that accept card payment
						const locations = locdata.locations.filter(loc => loc.status != "INACTIVE");
						//console.log("locations:", locations);
						res.render("register_device", {locations});
					})
              .catch(error => {
                res.send("error - please check the logs");
                console.log("Error", error.response.status);
                console.log("Data", error.response.data);
              });
          }
		});
	}
});


/*
 * Construct a POST Request for a Device Code
 */
router.get("/device/:loc_id", (req, res) => {
  if (req.auth.isLoggedIn) {
    User.findById(req.auth.userId).then(user => {
      // console.log("user", user);
      if (user) {
		req.checkout.location = req.params.loc_id
        axios
          .get(`https://connect.squareup.com/v2/locations`, {
            headers: {
              Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
            }
          })
          .then(location_response => location_response.data)
          .then(locdata => {
            console.log("Loc Data", locdata);
            console.log("ID:", req.params.loc_id);
            axios
              .post(
                `https://connect.squareup.com/v2/devices/codes`,
                {
                  idempotency_key: idempotency_key(),
                  device_code: {
                    //TODO: Create Location Selector before posting device code generation
                    location_id: req.params.loc_id,
                    name: "Ticket Terminator",
                    product_type: "TERMINAL_API"
                  }
                },
                {
                  headers: {
                    Authorization: `Bearer ${User.decryptToken(
                      user.accessToken
                    )}`
                  }
                }
              )
              .then(response => response.data)
              .then(data => data.device_code)
              .then(device => {
				req.checkout.device_code_id = device.id
                const terminal = {
                  id: device.id,
                  name: device.name,
                  status: device.status,
                  code: device.code
				  
                };
                //TODO - write this to table associated by User ID
                res.render("terminal", { terminal });
              })
              .catch(error => {
                console.log("Error", error.response.status);
                console.log("Data", error.response.data);
                res.send("error - please check the logs");
              });
          })
          .catch(error => {
            console.log("Error", error.response.status);
            console.log("Data", error.response.data);
            res.send("error - please check the logs");
          });
      }
    });
  } else {
    res.send("something bad happened");
  }
});

router.get("/device_webhook", (req, res) => {
  //This will only work if application is configured to receive device.code.paired webhook
  //Requires whitelisting - Ask for help from your Square Partner Manager!
  console.log(req);
});

module.exports = router;
