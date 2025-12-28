import { useEffect, useMemo, useState } from "react";
import { db } from "../../services/firebase";
import SidebarAdmin from "../../assets/components/sidebarAdmin";
import DataTable from "react-data-table-component";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { toast, ToastContainer } from "react-toastify";
import { Plus, FileDown, RotateCcw } from "lucide-react";

import {
  collectionGroup,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  runTransaction,
} from "firebase/firestore";

import {
  handleExportSemua,
  handleExportPerBulan,
  handleExportPerKegiatan,
} from "../../utills/exportHandlers";

import API from "../../services/api";
import "react-toastify/dist/ReactToastify.css";

dayjs.locale("id");

/* Helpers */
function extractCloudinaryPublicId(fotoObj) {
  // kasus baru: { url, public_id }
  if (fotoObj && typeof fotoObj === "object" && fotoObj.public_id) {
    return fotoObj.public_id;
  }

  // kasus lama: string URL atau { url }
  const url = typeof fotoObj === "string" ? fotoObj : fotoObj?.url;
  if (!url || typeof url !== "string") return null;

  // parse URL cloudinary: .../upload/v123/folder/name.jpg
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");

    const uploadIdx = parts.findIndex((p) => p === "upload");
    if (uploadIdx === -1) return null;

    let after = parts.slice(uploadIdx + 1);

    // buang version v123...
    after = after.filter(
      (p) => !(p.startsWith("v") && /^\d+$/.test(p.slice(1)))
    );

    const joined = after.join("/");
    if (!joined) return null;

    // hapus ekstensi
    return joined.replace(/\.[a-zA-Z0-9]+$/, "");
  } catch {
    return null;
  }
}

function toDayjs(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : ts;
  const dj = dayjs(d);
  return dj.isValid() ? dj : null;
}

export default function LihatBuktiKeg() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntryMeta, setSelectedEntryMeta] = useState(null);

  // filter state
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [dateYMD, setDateYMD] = useState("");
  const [jenis, setJenis] = useState("");

  // modal preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // modal edit
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // users map: nip -> nama
  const [usersMap, setUsersMap] = useState({});

  // delete foto modal
  const [confirmDelete, setConfirmDelete] = useState(null); // { foto, entryId, bulanKey }
  const [deletingFotoId, setDeletingFotoId] = useState(null); // publicId yang sedang dihapus

  // ini dipakai saat klik preview (buat passing foto array awal)
  const [selectedFotoUrls, setSelectedFotoUrls] = useState([]);

  // tambah kegiatan
  const [tambahOpen, setTambahOpen] = useState(false);
  const [newRow, setNewRow] = useState({
    namaKegiatan: "",
    tanggal: new Date(),
    lokasi: "",
    jenisKegiatan: "",
    nipKegiatan: [],
    foto: [],
  });

  /* ===================== Firestore listeners ===================== */
  useEffect(() => {
    setLoading(true);

    const unsub = onSnapshot(
      collectionGroup(db, "entries"),
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.ref.path, // path unik
          docId: docSnap.id,
          parentPath: docSnap.ref.parent.path, // jadwal/{bulan}/entries
          ...docSnap.data(),
        }));
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error("❌ Gagal ambil data:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // ambil pelaksana dari users + users_pending
  useEffect(() => {
    let mapUsers = {};
    let mapPending = {};

    const merge = () => {
      // users menang kalau nip sama
      setUsersMap({ ...mapPending, ...mapUsers });
    };

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const m = {};
      snapshot.forEach((d) => {
        const u = d.data();
        const nipKey = u?.nip != null ? String(u.nip) : null;
        const nama = u?.nama || u?.displayName;
        if (nipKey && nama) m[nipKey] = nama;
      });
      mapUsers = m;
      merge();
    });

    const unsubPending = onSnapshot(collection(db, "users_pending"), (snapshot) => {
      const m = {};
      snapshot.forEach((d) => {
        const u = d.data();
        const nipKey = u?.nip != null ? String(u.nip) : null;
        const nama = u?.nama || u?.displayName;
        if (nipKey && nama) m[nipKey] = nama;
      });
      mapPending = m;
      merge();
    });

    return () => {
      unsubUsers();
      unsubPending();
    };
  }, []);

  /* Helpers Pelaksana */
  const getPelaksanaNames = (row) => {
    if (Array.isArray(row?.nipKegiatan) && row.nipKegiatan.length) {
      const names = row.nipKegiatan
        .map((nip) => usersMap[String(nip)])
        .filter(Boolean);
      if (names.length) return names;
    }
    // legacy fallback
    if (Array.isArray(row?.pelaksana)) return row.pelaksana;
    if (typeof row?.pelaksana === "string" && row.pelaksana.trim()) {
      return row.pelaksana
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  /* Filtering*/
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.filter((row) => {
      const pelaksanaNames = getPelaksanaNames(row).join(", ");
      const needle = [
        row.namaKegiatan,
        row.lokasi,
        row.jenisKegiatan,
        pelaksanaNames,
        Array.isArray(row.nipKegiatan)
          ? row.nipKegiatan.join(", ")
          : row.nipKegiatan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = !q || needle.includes(q);

      const dj = toDayjs(row.tanggal);
      const matchMonth = !month || (dj && dj.format("YYYY-MM") === month);
      const matchDate = !dateYMD || (dj && dj.format("YYYY-MM-DD") === dateYMD);

      const matchJenis =
        !jenis ||
        (row.jenisKegiatan &&
          row.jenisKegiatan.toLowerCase() === jenis.toLowerCase());

      return matchSearch && matchMonth && matchDate && matchJenis;
    });
  }, [data, search, month, dateYMD, jenis, usersMap]);

  /* ===================== Date bounds ===================== */
  const monthMin = month
    ? dayjs(`${month}-01`).startOf("month").format("YYYY-MM-DD")
    : undefined;
  const monthMax = month
    ? dayjs(`${month}-01`).endOf("month").format("YYYY-MM-DD")
    : undefined;

  /* ===================== CRUD: Edit ===================== */
  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSaving(true);

    try {
      const docRef = doc(db, editRow.parentPath, editRow.docId);

      const updatedData = {
        namaKegiatan: editRow.namaKegiatan,
        tanggal: editRow.tanggal,
        lokasi: editRow.lokasi,
        jenisKegiatan: editRow.jenisKegiatan,
        foto: editRow.foto || [],
        nipKegiatan: editRow.nipKegiatan || [],
      };

      await updateDoc(docRef, updatedData);

      setData((prev) =>
        prev.map((row) =>
          row.id === editRow.id ? { ...row, ...updatedData } : row
        )
      );

      toast.success("✅ Data berhasil diperbarui!");
      setEditOpen(false);
    } catch (err) {
      console.error("❌ Gagal update:", err);
      toast.error("Gagal update data.");
    } finally {
      setSaving(false);
    }
  };

  // kalau kamu pakai docId dinamis + pindah bulan
  const handleSaveEditDynamicId = async () => {
    if (!editRow) return;
    setSaving(true);

    try {
      const oldRef = doc(db, editRow.parentPath, editRow.docId);

      let parsedDate;
      if (editRow.tanggal?.toDate) {
        parsedDate = editRow.tanggal.toDate();
      } else if (typeof editRow.tanggal === "string") {
        parsedDate = dayjs(editRow.tanggal, ["YYYY-MM-DD", "DD/MM/YYYY"]).toDate();
      } else {
        parsedDate = new Date(editRow.tanggal);
      }

      if (isNaN(parsedDate)) parsedDate = new Date();

      const dj = dayjs(parsedDate);
      const newBulanKey = dj.format("MMMM-YYYY").toLowerCase();
      const newDocId = `${editRow.namaKegiatan}_${editRow.lokasi}_${dj.format(
        "YYYY-MM-DD"
      )}`;

      const newRef = doc(db, "jadwal", newBulanKey, "entries", newDocId);

      const updatedData = {
        namaKegiatan: editRow.namaKegiatan,
        tanggal: parsedDate,
        lokasi: editRow.lokasi,
        jenisKegiatan: editRow.jenisKegiatan,
        foto: editRow.foto || [],
        nipKegiatan: editRow.nipKegiatan || [],
      };

      const oldBulanKey = editRow.parentPath.split("/")[1];
      if (newDocId === editRow.docId && newBulanKey === oldBulanKey) {
        await updateDoc(oldRef, updatedData);
      } else {
        await setDoc(newRef, updatedData);
        await deleteDoc(oldRef);
      }

      setData((prev) =>
        prev.map((row) =>
          row.id === editRow.id
            ? {
                ...row,
                ...updatedData,
                docId: newDocId,
                parentPath: `jadwal/${newBulanKey}/entries`,
                id: `jadwal/${newBulanKey}/entries/${newDocId}`,
              }
            : row
        )
      );

      toast.success("✅ Data berhasil diperbarui!");
      setEditOpen(false);
    } catch (err) {
      console.error("❌ Gagal update:", err);
      toast.error("Gagal update data.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editRow) return;
    if (!confirm("Yakin ingin menghapus kegiatan ini?")) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, editRow.parentPath, editRow.docId));
      toast.success("✅ Data berhasil dihapus!");
      setEditOpen(false);
    } catch (err) {
      console.error("❌ Gagal hapus:", err);
      toast.error("Gagal hapus data.");
    } finally {
      setDeleting(false);
    }
  };

  /* ===================== CRUD: Tambah ===================== */
  const handleSaveTambah = async () => {
    if (!newRow.namaKegiatan || !newRow.tanggal || !newRow.lokasi || !newRow.jenisKegiatan) {
      toast.error("⚠️ Mohon lengkapi semua field.");
      return;
    }

    try {
      const dj = dayjs(newRow.tanggal);
      const bulanTahun = dj.format("MMMM-YYYY").toLowerCase();
      const id = `${newRow.namaKegiatan}_${newRow.lokasi}_${dj.format("YYYY-MM-DD")}`;

      const docRef = doc(db, "jadwal", bulanTahun, "entries", id);

      const payload = {
        ...newRow,
        tanggal: new Date(newRow.tanggal),
        foto: newRow.foto || [],
        nipKegiatan: newRow.nipKegiatan || [],
      };

      await setDoc(docRef, payload);

      toast.success("✅ Kegiatan berhasil ditambahkan!");
      setTambahOpen(false);
      setNewRow({
        namaKegiatan: "",
        tanggal: new Date(),
        lokasi: "",
        jenisKegiatan: "",
        nipKegiatan: [],
        foto: [],
      });
    } catch (err) {
      console.error("❌ Gagal tambah:", err);
      toast.error("Gagal menambahkan kegiatan.");
    }
  };

  /* ===================== DELETE FOTO: Cloudinary + Firestore ===================== */
  const handleDeleteImage = async (foto, entryId, bulanKey) => {
    try {
      const publicId = extractCloudinaryPublicId(foto);

      if (!publicId) {
        toast.error("Foto ini tidak punya public_id, jadi tidak bisa dihapus dari Cloudinary.");
        return;
      }

      // 1) Hapus Cloudinary lewat backend
      await API.post("/delete-image", { publicId });

      // 2) Hapus referensi di Firestore
      const entryRef = doc(db, "jadwal", bulanKey, "entries", entryId);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(entryRef);
        if (!snap.exists()) throw new Error("Entry tidak ditemukan");

        const dataNow = snap.data();
        const updatedFoto = (dataNow.foto || []).filter((f) => {
          const fPublicId = extractCloudinaryPublicId(f);
          return fPublicId !== publicId;
        });

        transaction.update(entryRef, { foto: updatedFoto });
      });

      toast.success("✅ Foto berhasil dihapus");
    } catch (err) {
      console.error("❌ Gagal hapus foto (admin):", err);
      toast.error(err?.response?.data?.error || err?.message || "Gagal menghapus foto");
    }
  };

  /* ===================== DataTable columns ===================== */
  const columns = [
    { name: "No.", cell: (_row, index) => index + 1, width: "70px" },
    {
      name: "Tanggal",
      selector: (row) => {
        const dj = toDayjs(row.tanggal);
        return dj ? dj.format("DD/MM/YYYY") : "-";
      },
      sortable: true,
      width: "130px",
    },
    { name: "Nama Kegiatan", selector: (row) => row.namaKegiatan || "-", wrap: true },
    { name: "Lokasi", selector: (row) => row.lokasi || "-", wrap: true },
    {
      name: "Pelaksana",
      selector: (row) => {
        const names = getPelaksanaNames(row);
        return names.length ? names.join(", ") : "-";
      },
      wrap: true,
    },
    {
      name: "NIP Kegiatan",
      selector: (row) =>
        Array.isArray(row.nipKegiatan)
          ? row.nipKegiatan.join(", ")
          : row.nipKegiatan || "-",
      wrap: true,
    },
    { name: "Jenis Kegiatan", selector: (row) => row.jenisKegiatan || "-", wrap: true },
    {
      name: "Bukti Gambar",
      cell: (row) => {
        const fotos = Array.isArray(row.foto) ? row.foto : row.foto ? [row.foto] : [];
        return fotos.length ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFotoUrls(fotos);
              setSelectedEntryMeta({
                id: row.docId,
                bulanKey: row.parentPath.split("/")[1], // jadwal/{bulan}/entries
              });
              setPreviewOpen(true);
            }}
            className="text-blue-600 underline"
          >
            Preview
          </button>
        ) : (
          "-"
        );
      },
      ignoreRowClick: true,
    },
    {
      name: "Aksi",
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleExportPerKegiatan(row);
          }}
          className="px-2 py-1 bg-green-600 text-white rounded text-sm"
        >
          Export
        </button>
      ),
      ignoreRowClick: true,
      width: "120px",
    },
  ];

  /* ===================== UI ===================== */
  return (
    <div className="flex min-h-screen bg-white font-sans">
      <div className="sticky top-0 h-screen">
        <SidebarAdmin />
      </div>

      <div className="flex-1 p-4 sm:p-10 overflow-x-hidden">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">Lihat Bukti Kegiatan</h1>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Left: search & filter */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search…"
              className="border px-3 py-2 rounded-xl w-80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <input
              type="month"
              className="border px-3 py-2 rounded-xl w-28"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setDateYMD("");
              }}
            />

            <input
              type="date"
              className="border px-3 py-2 rounded-xl"
              value={dateYMD}
              onChange={(e) => setDateYMD(e.target.value)}
              min={monthMin}
              max={monthMax}
              disabled={!month}
            />

            {(search || month || dateYMD || jenis) && (
              <button
                onClick={() => {
                  setSearch("");
                  setMonth("");
                  setDateYMD("");
                  setJenis("");
                }}
                className="px-3 py-2 rounded-xl border hover:bg-gray-100 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          {/* Right: export & tambah */}
          <div className="flex overflow-x-auto gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => handleExportSemua(filteredData)}
              className="flex-shrink-0 text-xs sm:text-base px-4 py-2 border rounded-xl flex items-center gap-2 hover:bg-gray-100"
            >
              <FileDown className="sm:w-4 sm:h-4" />
              Export Semua
            </button>

            <button
              onClick={() => handleExportPerBulan(filteredData, month)}
              disabled={!month}
              className={`flex-shrink-0 text-xs sm:text-base px-4 py-2 rounded-xl flex items-center gap-2 ${
                month ? "border hover:bg-gray-100" : "border bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              <FileDown className="sm:w-4 sm:h-4" />
              Export Bulan
            </button>

            <button
              onClick={() => setTambahOpen(true)}
              className="flex-shrink-0 text-xs sm:text-base px-4 py-2 bg-green-600 text-white rounded-xl flex items-center gap-2 hover:bg-green-700"
            >
              <Plus className="sm:w-4 sm:h-4" />
              Tambah Kegiatan
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={filteredData}
              pagination
              highlightOnHover
              striped
              responsive
              noDataComponent="Tidak ada data yang cocok"
              onRowClicked={(row) => {
                setEditRow(row);
                setEditOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* ===================== Modal Preview Foto ===================== */}
      {previewOpen && selectedEntryMeta && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-3xl w-full relative">
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">Preview Foto</h2>

            {(() => {
              const currentEntry = data.find(
                (r) =>
                  r.docId === selectedEntryMeta.id &&
                  r.parentPath.split("/")[1] === selectedEntryMeta.bulanKey
              );

              const fotos = Array.isArray(currentEntry?.foto)
                ? currentEntry.foto
                : currentEntry?.foto
                ? [currentEntry.foto]
                : selectedFotoUrls || [];

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                  {fotos.length === 0 ? (
                    <p className="text-center text-gray-500">Tidak ada foto</p>
                  ) : (
                    fotos.map((fotoObj, idx) => {
                      const url = typeof fotoObj === "string" ? fotoObj : fotoObj?.url;
                      const pid = extractCloudinaryPublicId(fotoObj);
                      const isDeleting = deletingFotoId === pid;

                      return (
                        <div key={idx} className="relative border rounded overflow-hidden">
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                foto: fotoObj,
                                entryId: selectedEntryMeta.id,
                                bulanKey: selectedEntryMeta.bulanKey,
                              })
                            }
                            disabled={isDeleting}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-2 rounded-full disabled:opacity-60"
                          >
                            {isDeleting ? (
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-4 0v4m4-4v4M6 7h12"
                                />
                              </svg>
                            )}
                          </button>

                          {url ? (
                            <img
                              src={url}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-auto object-contain"
                            />
                          ) : (
                            <div className="p-6 text-sm text-gray-500">URL foto tidak valid</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================== Modal Konfirmasi Hapus Foto ===================== */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-[95%] max-w-md relative">
            <h2 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h2>
            <p className="mb-6">
              Apakah Anda yakin ingin menghapus foto ini? Tindakan ini tidak bisa dibatalkan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
                disabled={deletingFotoId !== null}
              >
                Batal
              </button>

              <button
                onClick={async () => {
                  const { foto, entryId, bulanKey } = confirmDelete;
                  const pid = extractCloudinaryPublicId(foto);

                  setDeletingFotoId(pid);
                  try {
                    await handleDeleteImage(foto, entryId, bulanKey);
                    setConfirmDelete(null);
                  } finally {
                    setDeletingFotoId(null);
                  }
                }}
                disabled={deletingFotoId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deletingFotoId !== null ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== Modal Edit ===================== */}
      {editOpen && editRow && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg p-6 w-[95%] max-w-2xl relative max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setEditOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">Edit Kegiatan</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Nama Kegiatan</label>
                <input
                  type="text"
                  value={editRow.namaKegiatan || ""}
                  onChange={(e) => setEditRow({ ...editRow, namaKegiatan: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Tanggal</label>
                <input
                  type="date"
                  value={editRow.tanggal ? dayjs(toDayjs(editRow.tanggal)).format("YYYY-MM-DD") : ""}
                  onChange={(e) => setEditRow({ ...editRow, tanggal: new Date(e.target.value) })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Lokasi</label>
                <input
                  type="text"
                  value={editRow.lokasi || ""}
                  onChange={(e) => setEditRow({ ...editRow, lokasi: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Jenis Kegiatan</label>
                <select
                  value={editRow.jenisKegiatan || ""}
                  onChange={(e) => setEditRow({ ...editRow, jenisKegiatan: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Pilih Jenis</option>
                  <option value="Dalam Ruangan">Dalam Ruangan</option>
                  <option value="luar ruangan">Luar Ruangan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Pelaksana</label>
                <div className="space-y-2">
                  {Array.isArray(editRow.nipKegiatan) &&
                    editRow.nipKegiatan.map((nip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border rounded px-3 py-2"
                      >
                        <span>{usersMap[String(nip)] || nip}</span>
                        <button
                          onClick={() => {
                            const newList = editRow.nipKegiatan.filter((n) => String(n) !== String(nip));
                            setEditRow({ ...editRow, nipKegiatan: newList });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                  <PelaksanaSelector
                    usersMap={usersMap}
                    onSelect={(nip) => {
                      const nipStr = String(nip);
                      const current = (editRow.nipKegiatan || []).map(String);
                      if (nipStr && !current.includes(nipStr)) {
                        setEditRow({
                          ...editRow,
                          nipKegiatan: [...(editRow.nipKegiatan || []), nipStr],
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>

              <button
                onClick={handleSaveEditDynamicId}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== Modal Tambah ===================== */}
      {tambahOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg p-6 w-[95%] max-w-2xl relative max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setTambahOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">Tambah Kegiatan</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Nama Kegiatan</label>
                <input
                  type="text"
                  value={newRow.namaKegiatan}
                  onChange={(e) => setNewRow({ ...newRow, namaKegiatan: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Tanggal</label>
                <input
                  type="date"
                  value={dayjs(newRow.tanggal).format("YYYY-MM-DD")}
                  onChange={(e) => setNewRow({ ...newRow, tanggal: new Date(e.target.value) })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Lokasi</label>
                <input
                  type="text"
                  value={newRow.lokasi}
                  onChange={(e) => setNewRow({ ...newRow, lokasi: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Jenis Kegiatan</label>
                <select
                  value={newRow.jenisKegiatan}
                  onChange={(e) => setNewRow({ ...newRow, jenisKegiatan: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Pilih Jenis</option>
                  <option value="Dalam Ruangan">Dalam Ruangan</option>
                  <option value="luar ruangan">Luar Ruangan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Pelaksana</label>
                <div className="space-y-2">
                  {newRow.nipKegiatan.map((nip, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border rounded px-3 py-2"
                    >
                      <span>{usersMap[String(nip)] || nip}</span>
                      <button
                        onClick={() => {
                          const newList = newRow.nipKegiatan.filter((n) => String(n) !== String(nip));
                          setNewRow({ ...newRow, nipKegiatan: newList });
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <PelaksanaSelector
                    usersMap={usersMap}
                    onSelect={(nip) => {
                      const nipStr = String(nip);
                      const current = (newRow.nipKegiatan || []).map(String);
                      if (nipStr && !current.includes(nipStr)) {
                        setNewRow({ ...newRow, nipKegiatan: [...newRow.nipKegiatan, nipStr] });
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveTambah}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

/* ===================== Pelaksana Selector ===================== */
function PelaksanaSelector({ usersMap, onSelect }) {
  const [search, setSearch] = useState("");

  const filteredUsers = Object.entries(usersMap).filter(([nip, nama]) => {
    const n = (nama || "").toLowerCase();
    return n.includes(search.toLowerCase()) || (nip || "").includes(search);
  });

  return (
    <div className="border rounded p-2 space-y-2">
      <input
        type="text"
        placeholder="Cari nama / NIP..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border px-2 py-1 rounded w-full"
      />
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filteredUsers.map(([nip, nama]) => (
          <button
            key={nip}
            onClick={() => onSelect(nip)}
            className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded"
          >
            {nama} ({nip})
          </button>
        ))}
        {!filteredUsers.length && (
          <p className="text-sm text-gray-500 px-2">Tidak ditemukan</p>
        )}
      </div>
    </div>
  );
}
