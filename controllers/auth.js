const { validationResult } = require("express-validator/check");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

// PUT /auth/signup
exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name: name,
      email: email,
      password: hashedPassword
    });
    const newUser = await user.save();
    res
      .status(201)
      .json({ message: "New User was created", userId: newUser._id });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// POST /auth/login action
exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  // let loadedUser;
  try {
    const currUser = await User.findOne({ email: email });
    if (!currUser) {
      const error = new Error("This email was not found");
      error.statusCode = 401;
      throw error;
    }
    const result = await bcrypt.compare(password, currUser.password);
    if (!result) {
      // if result is false
      const error = new Error("Please enter a valid password");
      error.statusCode = 401;
      throw error;
    }
    // should not store password in token bcs it will return to the frontend
    // .sign() takes 3 raguments
    // first - data object {...}. can pass anything you want, except password.
    // second - privat key
    // third - object with token params. e.g.{ expiresIn: "1h" } expires in 1 hour
    const token = jwt.sign(
      {
        userId: currUser._id.toString(),
        email: currUser.email
      },
      "someSuperLongSecretString",
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Logged successfully",
      token: token,
      userId: currUser._id.toString()
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.status = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    res.status(200).json({
      status: user.status
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  const newStatus = req.body.newStatus;
  // console.log(newStatus)
  try {
    const user = await User.findById(req.userId);
    user.status = newStatus;
    const updatedUser = await user.save();
    // console.log(user.status);
    res.status(201).json({
      status: updatedUser.status
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
