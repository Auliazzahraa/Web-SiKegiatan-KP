// backend/index.js
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // WAJIB ada untuk generate signature
});

// Delete endpoint
app.post("/delete-image", async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ error: "public_id diperlukan" });
    }

    // Hapus langsung via Cloudinary API
    const result = await cloudinary.uploader.destroy(public_id);
    return res.json(result);
  } catch (error) {
    console.error("❌ Error delete:", error);
    res.status(500).json({ error: "Gagal hapus gambar" });
  }
});

app.listen(5000, () => console.log("Server jalan di port 5000"));
