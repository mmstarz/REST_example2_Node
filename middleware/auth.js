const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }
  // get data from the 'Authorization' header
  // split token from that data and store it in a variable
  const token = authHeader.split(" ")[1];
  let decodedToken;
  try {
    // .decode() method only decodes token
    // .verify() method decodes token and verify data
    // verify takes 2 arguments
    // fist - generated token
    // second - your private secret key that was used to generate token
    decodedToken = jwt.verify(token, "someSuperLongSecretString");
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  // if token undefined
  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }
  // if no auth error occur
  // store user information in a request
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};
