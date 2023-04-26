const router = require("express").Router();
const axios = require("axios");
const crypto = require("crypto");
const User = require("../models").User;
const Op = require("sequelize").Op;

const CLIENT_ID = process.env.APPLICATION_ID;
const SECRET = process.env.SECRET;

function getState() {
  return crypto.randomBytes(32).toString("base64");
}

router.get("/authorize", (req, res) => {
  if (req.auth.isLoggedIn) {
    //ignore whether or not they've logged in, redo it
    res.redirect("/authorized"); // Skip authorization, they've already authorized with us
  } else {
    const squareAuthURL = "https://connect.squareup.com/oauth2/authorize?";
    const scope_array = [];
    //These are the only permissions necessary to run Terminal API
    scope_array.push("DEVICE_CREDENTIAL_MANAGEMENT");
    scope_array.push("MERCHANT_PROFILE_READ");
    scope_array.push("PAYMENTS_READ");
    scope_array.push("PAYMENTS_WRITE");
    
    const scopes = encodeURI(scope_array.join(" "));

    req.auth.state = getState(); // Setting our state to later verify we have a valid callback request

    res.redirect(
      squareAuthURL +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `scope=${scopes}&` +
        `session=false&` +
        `locale=en-US&` +
        `state=${req.auth.state}`
    );
  }
});

router.get("/callback", (req, res) => {
  const tokenURL = "https://connect.squareup.com/oauth2/token";
  const redirectURI = "https://square-oauth-example.glitch.me/auth/callback";

  if (req.query.state === req.auth.state) {
    axios
      .post(tokenURL, {
        client_id: CLIENT_ID,
        client_secret: SECRET,
        code: req.query.code,
        grant_type: "authorization_code",
        redirect_uri: redirectURI
      })
      .then(token => {
        axios
          .get("https://connect.squareup.com/v1/me", {
            headers: {
              Authorization: `Bearer ${token.data.access_token}`
            }
          })
          .then(user => {
            console.log("access_token", token.data.access_token)
            User.create({
              name: user.data.name,
              email: user.data.email,
              squareId: user.data.id,
              accessToken: User.encryptToken(token.data.access_token),
              refreshToken: User.encryptToken(token.data.refresh_token),
              tokenExp: token.data.expires_at
            }).then(user => {
              req.auth.isLoggedIn = true;
              req.auth.userId = user.id;
              res.location(`/authorized`);
              res.redirect(301, `/authorized`);
            });
            // console.log(`User: ${JSON.stringify(token.data, null, 2)}`);
          })
          .catch(error => {
            console.log(error);
            res.status(500).send(error.data);
          });
      })
      .catch(error => {
        console.log(error);
        res.status(500).send(error.data);
      });
  } else {
    res.redirect("/");
  }
});

router.get("/refresh", (req, res) => {
  if (req.auth.isLoggedIn) {
    User.findById(req.auth.userId).then(user => {
      if (user) {
        axios
          .post(
            `https://connect.squareup.com/oauth2/token`,
            {
              client_id: CLIENT_ID,
              client_secret: SECRET,
              refresh_token: User.decryptToken(user.refreshToken),
              grant_type: "refresh_token"
            },
            {
              headers: {
                Authorization: `Bearer ${User.decryptToken(user.accessToken)}`
              }
            }
          )
          .then(response => {
            user
              .update({
                accessToken: User.encryptToken(response.data.access_token),
                tokenExp: response.data.expires_at
              })
              .then(user => {
                res.redirect("/refreshed");
              });
          })
          .catch(error => console.log(error));
      }
    });
  } else {
    res.send("something bad happened");
  }
});

router.get("/revoke", (req, res) => {
  if (req.auth.isLoggedIn) {
    User.findById(req.auth.userId).then(user => {
      if (user) {
        axios
          .post(
            `https://connect.squareup.com/oauth2/revoke`,
            {
              client_id: CLIENT_ID,
              access_token: User.decryptToken(user.accessToken)
            },
            {
              headers: {
                Authorization: `Client ${SECRET}`
              }
            }
          )
          .then(response => {
            User.destroy(
              {
                where: {
                  id: {
                    [Op.eq]: user.id
                  }
                }
              },
              {
                force: true
              }
            ).then(user => {
              req.auth.reset();
              res.redirect("/revoked");
            });
          })
          .catch(error => console.log(error));
      }
    });
  } else {
    res.send("something bad happened");
  }
});

module.exports = router;
