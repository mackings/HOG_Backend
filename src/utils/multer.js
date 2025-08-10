const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file, cb) => {
        return {
            folder: 'revaMarket',
            resource_type: 'auto',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'ogg', 'wav', 'webm'],
            transformation: [
                { width: 500, height: 500, crop: 'fit' },
            ],
            path: file.path,
        };
    },
});


const upload = multer({ storage: storage });

module.exports = upload;

