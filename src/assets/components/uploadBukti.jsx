import { useState } from "react";
import axios from "axios";

export default function UploadBukti() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const handleUpload = async () => {
    if (!file) return alert("Silakan pilih file terlebih dahulu.");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await axios.post("http://localhost:3001/upload", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const fileId = res.data.fileId;
      const preview = `https://drive.google.com/file/d/${fileId}/preview`;
      setPreviewUrl(preview);

      alert("✅ Upload berhasil!");
    } catch (error) {
      console.error("❌ Upload gagal:", error);
      alert("Upload gagal");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Upload Bukti Kegiatan</h1>

      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files[0])}
        className="block mt-2"
      />

      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Upload ke Google Drive
      </button>

      {previewUrl && (
        <iframe
          src={previewUrl}
          className="w-full h-[500px] mt-4 border"
          allow="autoplay"
          title="Preview File"
        ></iframe>
      )}
    </div>
  );
}
