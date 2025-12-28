import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  onAuthStateChanged,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db } from "../services/firebase";
import Sidebar from "../assets/components/sidebar";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Pencil, Trash2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "react-toastify";
import API from "../services/api"; // pakai backend untuk delete cloudinary

function LoadingOverlay({ show, text }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      {text && <p className="mt-3 text-white font-medium">{text}</p>}
    </div>
  );
}

export default function EditProfile() {
  const authInst = getAuth();
  const navigate = useNavigate();

  // user state
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);

  // profile data
  const [photoURL, setPhotoURL] = useState("");
  const [photoPublicId, setPhotoPublicId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nama, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [nip, setNip] = useState("");
  const [email, setEmail] = useState("");

  // UI states
  const [loading, setLoading] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // preview instan (sebelum selesai upload ke cloudinary)
  const [localPreview, setLocalPreview] = useState("");

  // edit email
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  // errors ringan
  const [formErrors, setFormErrors] = useState({ nama: "" });

  // ambil data user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInst, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        navigate("/");
        return;
      }

      setCurrentUser(user);

      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);

          setDisplayName(data.displayName || "");
          setName(data.nama || "");
          setGender(data.gender || "");
          setBirthdate(data.birthdate || "");
          setPhotoURL(data.photoURL || "");
          setPhotoPublicId(data.photoPublicId || "");
          setNip(data.nip || "");
          setEmail(data.email || user.email || "");
        }
      } catch (e) {
        console.error(e);
        toast.error("Gagal memuat profil.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, authInst]);

  // upload ke cloudinary (unsigned upload OK)
  const uploadToCloudinary = async (file) => {
    const url = "https://api.cloudinary.com/v1_1/dmdfgqk2h/image/upload";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "profile_foto");

    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Gagal mengunggah gambar");
    const data = await response.json();

    return { url: data.secure_url, public_id: data.public_id };
  };

  // simpan profil (TIDAK upload foto lagi, hanya simpan field2)
  const handleSaveProfile = async () => {
    if (!currentUser) return;

    if (!nama.trim()) {
      toast.error("Nama tidak boleh kosong");
      setFormErrors((prev) => ({ ...prev, nama: "Nama tidak boleh kosong" }));
      return;
    }

    try {
      setSavingProfile(true);

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          nama,
          displayName: nama, // biar sinkron
          gender,
          birthdate,
          photoURL,
          photoPublicId,
          email,
        },
        { merge: true }
      );

      toast.success("Profil berhasil diperbarui.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan profil: " + (err?.message || "unknown"));
    } finally {
      setSavingProfile(false);
    }
  };

  // update email (butuh reauth)
  const handleUpdateEmail = async () => {
    if (!currentUser) return;

    if (!newEmail.trim()) {
      toast.error("Email baru tidak boleh kosong");
      return;
    }
    if (!password) {
      toast.error("Masukkan password lama untuk verifikasi");
      return;
    }

    try {
      setUpdatingEmail(true);

      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);

      await updateEmail(currentUser, newEmail);

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { email: newEmail });

      setEmail(newEmail);
      setPassword("");
      setNewEmail("");

      toast.success("Email berhasil diganti!");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Gagal update email");
    } finally {
      setUpdatingEmail(false);
    }
  };

  // hapus foto profil: Cloudinary + Firestore
  const handleDeleteProfilePhoto = async () => {
    if (!currentUser) return;

    try {
      setDeletingPhoto(true);

      // 1) hapus cloudinary via backend
      if (photoPublicId) {
        await API.post("/delete-image", { publicId: photoPublicId });
      }

      // 2) bersihkan firestore
      await setDoc(
        doc(db, "users", currentUser.uid),
        { photoURL: "", photoPublicId: "" },
        { merge: true }
      );

      setPhotoURL("");
      setPhotoPublicId("");
      setLocalPreview("");

      toast.success("Foto profil berhasil dihapus.");
    } catch (err) {
      console.error("❌ delete photo error:", err);
      toast.error(err?.response?.data?.error || err?.message || "Gagal hapus foto profil");
    } finally {
      setDeletingPhoto(false);
    }
  };

  // upload foto: LANGSUNG upload saat pilih file
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // preview instan biar user ga nunggu
    const tempPreview = URL.createObjectURL(file);
    setLocalPreview(tempPreview);

    try {
      setUploadingPhoto(true);

      // kompres biar cepat & hemat kuota
      const options = { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      // upload baru dulu
      const { url, public_id } = await uploadToCloudinary(compressedFile);

      // OPTIONAL: hapus foto lama biar ga numpuk (kalau ada)
      if (photoPublicId) {
        try {
          await API.post("/delete-image", { publicId: photoPublicId });
        } catch (cleanupErr) {
          console.warn("⚠️ gagal hapus foto lama (abaikan dulu):", cleanupErr);
        }
      }

      // simpan ke firestore langsung (jadi ga perlu klik simpan utk foto)
      await setDoc(
        doc(db, "users", currentUser.uid),
        { photoURL: url, photoPublicId: public_id },
        { merge: true }
      );

      // update UI
      setPhotoURL(url);
      setPhotoPublicId(public_id);

      toast.success("Foto profil berhasil diunggah.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal upload foto: " + (err?.message || "unknown"));
      // fallback: hapus preview kalau gagal
      setLocalPreview("");
    } finally {
      setUploadingPhoto(false);
      // reset input supaya bisa pilih file yg sama lagi
      e.target.value = "";
    }
  };

  // form validation
  const handleNameChange = (value) => {
    setName(value);
    setDisplayName(value);

    if (!value.trim()) {
      setFormErrors((prev) => ({ ...prev, nama: "Nama tidak boleh kosong" }));
    } else {
      setFormErrors((prev) => ({ ...prev, nama: "" }));
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!userData) return <div className="p-6 text-center">🔄 Memuat data...</div>;

  const busy =
    savingProfile || uploadingPhoto || deletingPhoto || updatingEmail;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <LoadingOverlay
        show={busy}
        text={
          uploadingPhoto
            ? "Mengunggah foto..."
            : deletingPhoto
            ? "Menghapus foto..."
            : updatingEmail
            ? "Mengupdate email..."
            : savingProfile
            ? "Menyimpan profil..."
            : ""
        }
      />

      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col max-w-xl w-full mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow">
        <h1 className="text-lg sm:text-xl font-bold mb-6">Profilku</h1>

        {/* Foto */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6">
          {localPreview || photoURL ? (
            <img
              src={localPreview || photoURL}
              alt="Preview"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border"
            />
          ) : (
            <img
              src="/profilepict.png"
              alt="Placeholder"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border"
            />
          )}

          {/* Ganti foto */}
          <label
            className={`absolute bottom-1 right-1 bg-[#006106] p-2 rounded-full cursor-pointer shadow ${
              uploadingPhoto ? "opacity-60 pointer-events-none" : ""
            }`}
            title="Ganti foto"
          >
            <Pencil className="w-4 h-4 text-white" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* Hapus foto */}
          {(photoURL || localPreview) && (
            <button
              onClick={handleDeleteProfilePhoto}
              className="absolute top-1 right-1 bg-red-600 p-2 rounded-full shadow disabled:opacity-60"
              disabled={uploadingPhoto || deletingPhoto}
              title="Hapus foto"
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        {/* Nama */}
        <label className="block mb-2 text-sm">Nama Lengkap *</label>
        <input
          type="text"
          value={nama}
          onChange={(e) => handleNameChange(e.target.value)}
          className={`border p-2 w-full mb-1 rounded ${formErrors.nama ? "border-red-500" : ""}`}
        />
        {formErrors.nama && <p className="text-red-500 text-xs mb-3">{formErrors.nama}</p>}

        {/* NIP */}
        <label className="block mb-2 text-sm">NIP</label>
        <input
          type="text"
          value={nip}
          readOnly
          className="border p-2 w-full mb-4 rounded bg-gray-100 text-gray-600 cursor-not-allowed"
        />

        {/* Email */}
        <label className="block mb-2 text-sm">Email *</label>
        <input
          type="email"
          value={email}
          readOnly
          className="border p-2 w-full rounded mb-3 bg-gray-50"
        />

        {/* Ganti Email */}
        <div className="p-4 border rounded mb-4">
          <h2 className="text-lg font-bold mb-2">Ganti Email</h2>

          <input
            type="email"
            placeholder="Email baru"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="border p-2 rounded w-full mb-2"
            disabled={updatingEmail}
          />

          <input
            type="password"
            placeholder="Password lama"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded w-full mb-2"
            disabled={updatingEmail}
          />

          <button
            onClick={handleUpdateEmail}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={updatingEmail}
          >
            {updatingEmail ? "Memproses..." : "Update Email"}
          </button>
        </div>

        {/* Gender */}
        <label className="block mb-2 text-sm">Gender</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
          disabled={savingProfile}
        >
          <option value="">Pilih Gender</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>

        {/* Tanggal lahir */}
        <label className="block mb-2 text-sm">Tanggal Lahir</label>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="border p-2 w-full mb-6 rounded"
          disabled={savingProfile}
        />

        {/* Simpan */}
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile || uploadingPhoto || deletingPhoto || updatingEmail}
          className="bg-[#006106] text-white px-4 py-2 rounded disabled:opacity-60 w-full"
        >
          {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </div>
  );
}
