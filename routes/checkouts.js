/** 
 *checkouts.js
 * Use the functions listed here to view the current status of the checkout(s)
 * as well as create a new Checkout
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

/* Load completed checkouts */
router.get("/list", (req, res) => {
	if (req.auth.isLoggedIn) {
		if (!req.checkout.id) {
			res.send("No checkout id set - try charging again");
			return;
		}
		const checkouts = [];
		User.findById(req.auth.userId).then(user => {
			// console.log("user", user);
			if (user) {

				axios
					.get(
						`https://connect.squareup.com/v2/terminals/checkouts`,
						{
							headers: {
								Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
							}
						}
					)
					.then(response => {
						console.log(response.data)
						const checkout = {
							id: response.data.checkout[0].id,
							status: response.data.checkout[0].status
						};
						res.render("checkout", {checkout});
					})
					.catch(error => {
						console.log("response", error.response);
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

/*
 * Construct a POST Request for a Checkout - a request to collect funds
 */
router.get("/charge", (req, res) => {
	if (req.auth.isLoggedIn) {
		User.findById(req.auth.userId).then(user => {
			// console.log("user", user);
			if (user) {
				axios.get(`https://connect.squareup.com/v2/devices/codes/${req.checkout.device_code_id}`,
					{
						headers: {
							Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
						}
					})
					.then(response => response.data)
					.then(data => data.device_code)
					.then(device_code => {
						req.checkout.device_id = device_code.device_id;
						axios
							.post(
								`https://connect.squareup.com/v2/terminals/checkouts`,
								{
									idempotency_key: idempotency_key(),
										checkout: {
											type: "DEVICE",
												amount_money: {
													amount: 100, //Example amount
														currency: "USD"
												},
												reference_id: "Generate a Reference ID Here",
												device_options: {
													device_id: req.checkout.device_id 
												}
										}
								},
								{
									headers: {
										Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
									}
								}
							)
							.then(response => response.data)
							.then(data => {
								console.log("Checkout Data", data);
								const checkout = {
									id: data.checkout.id,
									status: data.checkout.status
								};
								req.checkout.id = data.checkout.id
								res.render("checkout", { checkout });
							})
							.catch(error => {
								console.log("Error", error.response.status);
								console.log("Data", error.response.data);
								res.send("error - please check the logs");
							});
					})
					.catch(error => {
						console.log("response", error.response);
						console.log("Error", error.response.status);
						console.log("Data", error.response.data);
						res.send("error - please check the logs");
					});
			}
		})
	} else {
		res.send("something bad happened");
	}
});

//Handle Square Terminal API Webhooks
module.exports = router;
