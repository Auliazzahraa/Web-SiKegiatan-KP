import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import dayjs from "dayjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ JSON body parser bawaan express
app.use(express.json());

// ✅ CORS: boleh juga dibatasi ke domain Vercel kamu nanti
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-token"],
  })
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Firebase Admin init
if (!process.env.FIREBASE_CONFIG) {
  throw new Error("FIREBASE_CONFIG tidak terbaca. Pastikan ada di ENV Render.");
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} catch (e) {
  throw new Error(
    "FIREBASE_CONFIG bukan JSON valid. Pastikan private_key pakai \\n"
  );
}

console.log("FIREBASE_CONFIG ada?", !!process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* =========================================================
   ✅ Helper: kirim notif per user (sesuai jadwal user)
========================================================= */
async function sendNotifPersonal(uid) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      console.log(`⚠️ User ${uid} tidak ditemukan di Firestore`);
      return;
    }

    const { nip, fcmToken } = userDoc.data();
    if (!fcmToken) {
      console.log(`⚠️ User ${uid} tidak punya fcmToken`);
      return;
    }

    const today = dayjs().startOf("day");
    const tomorrow = dayjs().add(1, "day").startOf("day");
    const bulan = dayjs().format("MMMM-YYYY").toLowerCase();

    const snapshot = await db
      .collection("jadwal")
      .doc(bulan)
      .collection("entries")
      .where("tanggal", ">=", today.toDate())
      .where("tanggal", "<", tomorrow.toDate())
      .where("nipKegiatan", "array-contains", nip)
      .get();

    if (snapshot.empty) {
      console.log(`ℹ️ Tidak ada kegiatan untuk ${uid} hari ini`);
      return;
    }

    const kegiatan = snapshot.docs.map((d) => d.data());

    // ✅ bikin lebih toleran soal penulisan "Luar Ruangan"
    const dalam = kegiatan.filter(
      (k) => (k.jenisKegiatan || "").toLowerCase() === "dalam ruangan"
    );
    const luar = kegiatan.filter(
      (k) => (k.jenisKegiatan || "").toLowerCase() === "luar ruangan"
    );

    let notifBody = "";
    if (dalam.length > 0) {
      notifBody = `Hari ini ada kegiatan ${dalam[0].namaKegiatan} (Dalam Ruangan) di ${dalam[0].lokasi}`;
    } else if (luar.length === 1) {
      notifBody = `Hari ini ada kegiatan ${luar[0].namaKegiatan} (Luar Ruangan) di ${luar[0].lokasi}`;
    } else if (luar.length > 1) {
      notifBody = `Hari ini kamu punya ${luar.length} kegiatan luar ruangan.`;
    } else {
      notifBody = "Hari ini kamu tidak punya kegiatan terjadwal.";
    }

    const message = {
      token: fcmToken,
      notification: {
        title: "Kegiatan Hari Ini!",
        body: notifBody,
      },
      data: { uid },
    };

    const response = await admin.messaging().send(message);
    console.log(`📨 Notif terkirim ke ${uid}:`, response);
  } catch (err) {
    console.error(`❌ Gagal kirim notif ke ${uid}:`, err.message);
  }
}

/* =========================================================
   ✅ Endpoint manual test per UID
========================================================= */
app.post("/send-personal-notif/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    await sendNotifPersonal(uid);
    res.json({ success: true, message: "Notif diproses" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ✅ Endpoint cron aman pakai token (dipanggil Render Cron Job)
========================================================= */
app.post("/cron/send-daily-notifs", async (req, res) => {
  try {
    const token = req.headers["x-cron-token"];
    if (!token || token !== process.env.CRON_TOKEN) {
      return res.status(401).json({ error: "Unauthorized cron" });
    }

    const usersSnapshot = await db.collection("users").get();

    for (const docSnap of usersSnapshot.docs) {
      await sendNotifPersonal(docSnap.id);
    }

    res.json({ ok: true, totalUsers: usersSnapshot.size });
  } catch (err) {
    console.error("❌ Cron endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   ✅ Endpoint delete image
========================================================= */
app.post("/delete-image", async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId || typeof publicId !== "string") {
      return res.status(400).json({ error: "publicId kosong / bukan string" });
    }

    const result = await cloudinary.uploader.destroy(publicId);
    res.json({ message: "Berhasil hapus foto", result });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus foto", details: error.message });
  }
});

/* =========================================================
   ✅ Endpoint hapus user Firebase
========================================================= */
app.delete("/delete-user/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    await admin.auth().deleteUser(uid);
    await db.collection("users").doc(uid).delete();
    res.json({ message: `User ${uid} berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus user", details: error.message });
  }
});

/* =========================================================
   ✅ OPTIONAL: node-cron (aktifkan hanya kalau mau LOCAL)
   Di Render: jangan aktifin biar gak dobel.
========================================================= */
if (process.env.ENABLE_NODE_CRON === "true") {
  cron.schedule(
    "30 7 * * *",
    async () => {
      console.log("⏰ Node-cron jalan:", dayjs().format("YYYY-MM-DD HH:mm"));
      const usersSnapshot = await db.collection("users").get();
      for (const docSnap of usersSnapshot.docs) {
        await sendNotifPersonal(docSnap.id);
      }
    },
    { timezone: "Asia/Jakarta" }
  );
}

/* ========================================================= */
app.get("/", (req, res) => {
  res.send("✅ Backend API is running");
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
