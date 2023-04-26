const router = require('express').Router();
const auth = require('./auth');
const terminal = require('./terminal');
const checkouts = require('./checkouts');
const User = require('../models').User;

router.get("/", (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

router.use("/auth", auth);
router.use("/terminal", terminal);
router.use("/checkouts", checkouts);

router.get("/authorized", (req, res) => {
  if(req.auth.isLoggedIn) {
    User.findById(req.auth.userId).then((user)=>{
      res.render("authorized", {user});
    });
  } else {
      res.render("authorized");
  }
});

router.get("/revoked", (req, res) => {
  res.render("revoked");
});

router.get("/refreshed", (req, res) => {
  res.render("refreshed");
});

module.exports = router;