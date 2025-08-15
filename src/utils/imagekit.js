import multer from "multer";
import fs from "fs";
import ImageKit from "imagekit";
import path from "path";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT, // e.g., https://ik.imagekit.io/arosebine
});


const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

export const imageUpload = multer({ storage }).single('image'); // 

export const imageKitUpload = async (req, res, next) => {
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



export const multipleImageUpload = multer({ storage }).array("images", 10); 

export const multipleImageKitUpload = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No image files provided" });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const fileBuffer = fs.readFileSync(file.path);

      const result = await imagekit.upload({
        file: fileBuffer,
        fileName: file.originalname,
        folder: "/uploads",
      });

      fs.unlinkSync(file.path); // delete local file

      uploadedImages.push(result.url);
    }

    req.imageUrls = uploadedImages; // store all image URLs in req
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Image upload failed",
      error: error.message,
    });
  }
};

