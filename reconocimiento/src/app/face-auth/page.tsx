import FaceAuth from "@/components/FaceAuth";

export default function FaceAuthPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Autenticar de Rostro</h1>
      <FaceAuth />
    </div>
  );
}
