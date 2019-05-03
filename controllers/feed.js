const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator/check");
const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

const ITEMS_PER_PAGE = 2;

// get /feed/posts action
exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1; // get page from url query
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    res.status(200).json({
      message: "DB fetched successfully",
      posts: posts,
      totalItems: totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get /feed/post/:postId action
exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Post fetched successfully",
      post: post
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// put /feed/post/:postId action
exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);
  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed. Entered data incorrect.");
      error.statusCode = 422;
      throw error;
    }

    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image; // retrieved from the frontEnd
    // if new file found
    if (req.file) {
      const filePath = req.file.path.replace(/\\/g, "/"); // get image file path
      imageUrl = filePath;
    }

    if (!imageUrl) {
      const error = new Error("No file picked");
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");

    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not Authorized");
      error.statusCode = 403;
      throw error;
    }

    if (post.imageUrl !== imageUrl) {
      deleteImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;

    const updatedPost = await post.save();
    io.getIO().emit("posts", { action: "update", post: updatedPost });
    res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// http method + path
exports.createPost = async (req, res, next) => {
  const image = req.file; // fetch uploaded file object config
  const errors = validationResult(req);
  try {
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed. Entered data incorrect.");
      error.statusCode = 422;
      throw error;
    }

    // console.log(image);
    if (!image) {
      // if no file was uploaded edge case
      const error = new Error("No file picked");
      error.statusCode = 422;
      throw error;
    }

    // important if you are on Windows replace system path defaluts to POSIX
    // for correct file path save&display
    const imageUrl = image.path.replace(/\\/g, "/"); // get image file path

    const title = req.body.title;
    const content = req.body.content;

    const post = new Post({
      title: title,
      imageUrl: imageUrl,
      content: content,
      creator: req.userId
    });

    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } }
    });
    // 201 - success resource created
    res.status(201).json({
      message: "Post created successfully!",
      post: post,
      creator: {
        _id: user._id,
        name: user.name
      }
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Post not found");
      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not Authorized");
      error.statusCode = 403;
      throw error;
    }

    // check logged user
    deleteImage(post.imageUrl);
    await Post.findOneAndDelete({ _id: postId });
    // https://docs.mongodb.com/manual/reference/operator/update/pull/
    const user = await User.findById({ _id: req.userId})
    user.posts.pull(postId);
    await user.save();
    io.getIO().emit('posts', {action: 'delete', post: postId})
    res.status(200).json({
      message: "Post deleted successfully!"
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// helper function for deleting old image
const deleteImage = filepath => {
  filepath = path.join(__dirname, "..", filepath);
  fs.unlink(filepath, err => {
    console.log(err);
  });
};
