// src/utills/uploadToCloudinary.js
export async function uploadToCloudinary(fileOrBlob, opts = {}) {
  const { folder } = opts; // contoh: "kegiatan/agustus-2025"
  const url = "https://api.cloudinary.com/v1_1/dmdfgqk2h/image/upload";
  const fd = new FormData();
  fd.append("file", fileOrBlob);
  fd.append("upload_preset", "upload_open"); // pakai upload preset kamu
  if (folder) fd.append("folder", folder);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload gagal");
  const data = await res.json();
  // kembalikan url & public_id (berguna kalau nanti mau hard-delete dari Cloudinary)
  return { url: data.secure_url, public_id: data.public_id };
}
