import { useState, useRef, ChangeEvent } from "react";
import * as THREE from "three";

// Sample decal images (will be added to public folder)
const SAMPLE_DECALS = [
  { name: "Star", url: "/decals/star.svg" },
  { name: "Heart", url: "/decals/heart.svg" },
  { name: "Logo", url: "/decals/logo.svg" },
  { name: "Smile", url: "/decals/smile.svg" },
];

interface DecalLibraryProps {
  onSelectDecal: (texture: THREE.Texture, name: string) => void;
  disabled?: boolean;
}

/**
 * Decal library panel for selecting decal textures
 */
export function DecalLibrary({ onSelectDecal, disabled }: DecalLibraryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textureLoader = useRef(new THREE.TextureLoader());

  const loadTexture = async (url: string, name: string) => {
    setLoading(true);
    setError(null);

    try {
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.current.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            resolve(tex);
          },
          undefined,
          reject
        );
      });
      onSelectDecal(texture, name);
    } catch (err) {
      setError("Failed to load decal texture");
      console.error("Failed to load decal:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const url = URL.createObjectURL(file);
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.current.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            resolve(tex);
          },
          undefined,
          reject
        );
      });
      onSelectDecal(texture, file.name);
    } catch (err) {
      setError("Failed to load uploaded image");
      console.error("Failed to load uploaded decal:", err);
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="panel decal-library">
      <h3>🎨 Decal Library</h3>

      {error && <div className="error-message">{error}</div>}

      {/* Sample decals */}
      <div className="decal-grid">
        {SAMPLE_DECALS.map((decal) => (
          <button
            key={decal.name}
            className="decal-button"
            onClick={() => loadTexture(decal.url, decal.name)}
            disabled={disabled || loading}
            title={decal.name}
          >
            <img
              src={decal.url}
              alt={decal.name}
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span>{decal.name}</span>
          </button>
        ))}
      </div>

      {/* Upload custom decal */}
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileUpload}
          style={{ display: "none" }}
          disabled={disabled || loading}
        />
        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || loading}
        >
          📁 Upload Custom Decal
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}
    </div>
  );
}
