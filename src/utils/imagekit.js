import multer from "multer";
import fs from "fs";
import axios from "axios";
import ImageKit from "imagekit";
import path from "path";
import mime from "mime-types";
import FormData from "form-data";
import os from "os";

// Use /tmp directory for Vercel serverless compatibility
const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/';

// Ensure upload directory exists (only needed for local development)
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

export const imageUpload = multer({ storage }).array("images", 10);
export const fileUpload = multer({ storage }).array("files", 10);

const uploadFilesToImageKit = async (req, res, next, { required }) => {
  if (req.body?.imageUrls || req.body?.imageUrl) {
    return res.status(400).json({
      success: false,
      message: "Upload files from the device instead of submitting image URLs.",
    });
  }

  if (!req.files || req.files.length === 0) {
    if (!required) return next();
    return res.status(400).json({ message: "No images provided" });
  }

  try {
    const uploadPromises = req.files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", fs.createReadStream(file.path));
      formData.append("fileName", file.originalname);
      formData.append("folder", "/uploads");

      const response = await axios.post(
        "https://upload.imagekit.io/api/v1/files/upload",
        formData,
        {
          auth: {
            username: process.env.IMAGEKIT_PRIVATE_KEY,
          },
          headers: formData.getHeaders(),
        }
      );

      fs.unlinkSync(file.path);

      return {
        url: response.data.url,
        mimeType: file.mimetype || mime.lookup(file.originalname) || undefined,
        originalName: file.originalname,
        sizeBytes: file.size,
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    req.uploadedFiles = uploadedFiles;
    req.imageUrls = uploadedFiles.map((file) => file.url);
    next();
  } catch (error) {
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }

    return res.status(error.response?.status || 500).json({
      message: "Image upload failed",
      error: error.response?.data || error.message,
    });
  }
};

export const imageKitUpload = (req, res, next) => uploadFilesToImageKit(req, res, next, { required: true });
export const optionalImageKitUpload = (req, res, next) => uploadFilesToImageKit(req, res, next, { required: false });
