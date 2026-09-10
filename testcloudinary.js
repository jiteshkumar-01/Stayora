require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
 cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,    // ✅ 
  api_secret: process.env.CLOUD_API_SECRET, 
   timeout: 1200000,
});

cloudinary.api.ping()
  .then(res => console.log("✅ Cloudinary Connected:", res))
  .catch(err => console.error("❌ Cloudinary Error:", err.message));

