// src/index.js (atau index.mjs)
import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const upload = multer({ dest: "uploads/" });

// ES module: dapatkan path absolut file JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔒 Autentikasi ke Google menggunakan Service Account
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../sikegiatan-sangkali-55837b246c93.json"),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

app.use(cors());

// 📤 Endpoint upload
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const drive = google.drive({ version: "v3", auth: await auth.getClient() });

    const fileMetadata = {
      name: req.file.originalname,
      parents: ["1auWuNjT-AR42toR7rpVs_2_gZkJq4u7M"], // <-- ID folder pusat kamu
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
      supportsAllDrives: true, // Penting kalau kamu pakai Shared Drive
    });

    fs.unlinkSync(req.file.path);

    res.send({ success: true, fileId: response.data.id });
  } catch (err) {
    console.error("❌ Gagal upload ke Google Drive:", err.message);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(3001, () => {
  console.log("🚀 Server berjalan di http://localhost:3001");
});
