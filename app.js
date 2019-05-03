const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer"); // import multer
const graphqlHttp = require("express-graphql");

// graphql preparations
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");
const { deleteImage } = require("./util/file");

const app = express();
// mongoDB entrie point:
// 'mongodb+srv://username:password@cluster0-annvu.mongodb.net/messages?retryWrites=true'
const MONGODB_URI =
  "mongodb+srv://username:password@cluster0-annvu.mongodb.net/messages?retryWrites=true";

// init filestorage configuration
// .diskStorage() multer method that takes 2 params destination & filename
// new Date().toISOString() - is used  here for unique name definition
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    const uniqueKey = new Date().toISOString().split(".");
    // new Date().toISOString().replace(/:/g, '-')
    // cb(null, uniqueKey + '-' + file.originalname);
    cb(null, `${uniqueKey[1]}_${file.originalname}`);
  }
});

// init filefilter config
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json

// register multer middleware
// .single() multer method if we expect one file. it takes input field name as argument.
// .array() for array of files
// multer({dest: 'images'}) - sets destination folder for file upload
// multer({ storage: fileStorage }) - storage configuration
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);

// images files handling
app.use("/images", express.static(path.join(__dirname, "images")));

// CORS error handling
app.use((req, res, next) => {
  // res.setHeader('Access-Control-Allow-Origin', 'codepen.io'); // for certain domain
  // res.setHeader('Access-Control-Allow-Origin', 'name1, name2,...'); // for special domains
  res.setHeader("Access-Control-Allow-Origin", "*"); // for any client access
  // also need to setup list of methods to allow access
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  // setup header to access
  // res.setHeader('Access-Control-Allow-Headers', '*'); // for any headers
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // allow preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Auth middleware
// run on every request that reaches graphql endpoint.
// but it will not deny a request if it have no token.
// instead it will set req.isAuth to false.
// so we can check it in our resolver then
app.use(auth);

// Image Upload hadling
app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not Authenticated");
  }

  if (!req.file) {
    return res.status(200).json({ message: "No file provided!" });
  }
  // was oldPath passed with the incoming request?
  // console.log(req.body.oldPath);
  if (req.body.oldPath) {
    deleteImage(req.body.oldPath);
  }
  // important if you are on Windows replace system path defaluts to POSIX
  // for correct file path save&display
  const filePath = req.file.path.replace(/\\/g, "/"); // get image file path
  return res.status(201).json({ message: "File stored", filePath: filePath });
});

// GraphQL settings
app.use(
  "/graphql",
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const errorData = err.originalError.data;
      const message = err.message || "Internal error occured";
      const statusCode = err.originalError.statusCode || 500;
      return {
        message: message,
        status: statusCode,
        data: errorData
      };
    }
  })
);
// error handling
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({
    message: message,
    data: data
  });
});

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true })
  .then(result => {
    app.listen(8080);
  })
  .catch(err => console.log(err));
