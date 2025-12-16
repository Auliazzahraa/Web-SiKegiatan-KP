import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");

    if (authCode) {
      // TODO: Tukar kode dengan access token via backend / fetch langsung ke Google
      console.log("Authorization code:", authCode);
      // navigate("/upload"); // misalnya pindah ke halaman upload
    } else {
      alert("Authorization failed");
    }
  }, []);

  return <div>Mengautentikasi...</div>;
}
