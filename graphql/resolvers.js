const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Post = require("../models/post");
const { deleteImage } = require("../util/file");

const ITEMS_PER_PAGE = 2;

module.exports = {
  // method for query you defined in your schema
  // query name should match the method name
  // args - arguments object
  // req - request
  // createUser(args, req) {
  //   const email = args.userInput.email;
  //   const name = args.userInput.name;
  //   const password = args.userInput.password;
  // }
  // with nextgen JS destructuring
  // createUser({ userInput }, req) {
  //   const email = userInput.email;
  //   const name = userInput.name;
  //   const password = userInput.password;
  // }
  // .then().catch() way
  // !important note - should always return a promise object.
  // without return graphql will not wait for it resolve.
  // createUser({ userInput }, req) {
  //   const email = userInput.email;
  //   const name = userInput.name;
  //   const password = userInput.password;
  //   return User.findOne({email : email}).then().catch()
  // }
  // async/await way
  createUser: async function({ userInput }, req) {
    const email = userInput.email;
    const name = userInput.name;
    const password = userInput.password;
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "E-mail is invalid" });
    }
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 4 })
    ) {
      errors.push({ message: "Password to short" });
    }
    if (validator.isEmpty(name) || !validator.isLength(name, { min: 2 })) {
      errors.push({ message: "Name is to short" });
    }
    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    const isUser = await User.findOne({ email: email });
    if (isUser) {
      const error = new Error("Email already exists");
      throw error;
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      email: email,
      password: hashedPassword,
      name: name
    });
    const storedUser = await user.save();
    // return mongoDB document with all params
    return { ...storedUser._doc, _id: storedUser._id.toString() };
  },
  login: async function({ email, password }, req) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Please enter valid password");
      error.statusCode = 401;
      throw error;
    }
    // create token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      "someSuperLongSecretString",
      { expiresIn: "1h" }
    );
    return { token: token, userId: user._id.toString() };
  },
  createPost: async function({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 4 })
    ) {
      errors.push({ message: "Title length is to short" });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 4 })
    ) {
      errors.push({ message: "Content length is to short" });
    }

    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid User");
      error.statusCode = 401;
      throw error;
    }

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user
    });

    const storedPost = await post.save();
    // add post to user.posts[]
    user.posts.push(storedPost);
    await user.save();
    return {
      ...storedPost._doc,
      _id: storedPost._id.toString(),
      createdAt: storedPost.createdAt.toISOString(),
      updatedAt: storedPost.updatedAt.toISOString()
    };
  },
  posts: async function({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }

    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .populate("creator");
    // use .map() to refactor posts array
    // every element of the array will have _id in String format
    // createdAt in string format
    // updatedAt is string format
    return {
      posts: posts.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        };
      }),
      totalPosts: totalPosts
    };
  },
  post: async function({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }
    return {
      ...post._doc,
      id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    };
  },
  updatePost: async function({ id, postInput }, req) {
    // authentication
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    // post existance
    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }
    // author validation
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not Authorized!");
      error.statusCode = 403;
      throw error;
    }
    // input validation
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 4 })
    ) {
      errors.push({ message: "Title length is to short" });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 4 })
    ) {
      errors.push({ message: "Content length is to short" });
    }

    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;
    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString()
    };
  },
  deletePost: async function({ id }, req) {
    // authentication
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }
    const post = await Post.findById(id);
    // post existance
    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }

    // author validation
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error("Not Authorized!");
      error.statusCode = 403;
      throw error;
    }
    // obvious try/catch need to be added to all resolver functions
    deleteImage(post.imageUrl);
    await Post.findOneAndDelete({ _id: post._id }); // !check
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  user: async function(args, req) {
    // authentication
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    // extra user doc check
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function({ status }, req) {
    // authentication
    if (!req.isAuth) {
      const error = new Error("Not Authenticated!");
      error.statusCode = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    user.status = status;
    await user.save();
    return { ...user._doc, _id: user._id.toString() };
  }
};
