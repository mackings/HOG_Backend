const multer = require("multer");
const fs = require("fs");
const ImageKit = require("imagekit");
const path = require("path");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT, // e.g., https://ik.imagekit.io/arosebine
});

// Multer setup
const upload = multer({ dest: "reva" });

const imageKitUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const result = await imagekit.upload({
      file: fileBuffer,
      fileName: req.file.originalname,
      folder: "/uploads",
    });

    fs.unlinkSync(req.file.path);

    req.imageUrl = result.url;

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Image upload failed",
      error: error.message,
    });
  }
};

module.exports = {
  imageUpload: upload.single("image"),
  imageKitUpload,
};
