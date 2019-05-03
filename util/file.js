const path = require('path');
const fs = require('fs');

// helper function for deleting old image
const deleteImage = filepath => {
  filepath = path.join(__dirname, '..', filepath);
  fs.unlink(filepath, err => {
    console.log(err);
  });
};

exports.deleteImage = deleteImage;