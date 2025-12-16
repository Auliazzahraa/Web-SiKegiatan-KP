import { useNavigate } from "react-router-dom";

export default function Landingpage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Welcome to Web PKM</h1>
      <div className="flex gap-4">
        <button
          onClick={() => navigate("/signup")}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded shadow"
        >
          Sign Up
        </button>
        <button
          onClick={() => navigate("/")}
          className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded shadow"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
