import { useState, useCallback } from "react";
import * as THREE from "three";
import type {
  MeshMerger,
  Transform,
  DecalOptions,
} from "@poppod/three-mesh-merger";

export interface DecalState {
  id: string;
  textureUrl: string;
  texture?: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  targetModelId: string;
  opacity: number;
}

// Stamp settings for placing decals
export interface StampSettings {
  scale: number;
  rotation: number; // Z rotation in degrees
  opacity: number;
}

const DEFAULT_STAMP_SETTINGS: StampSettings = {
  scale: 0.5,
  rotation: 0,
  opacity: 1,
};

export function useDecals(merger: MeshMerger) {
  const [decals, setDecals] = useState<DecalState[]>([]);
  const [selectedDecalId, setSelectedDecalId] = useState<string | undefined>();
  const [activeDecalTexture, setActiveDecalTexture] =
    useState<THREE.Texture | null>(null);
  const [activeDecalName, setActiveDecalName] = useState<string>("");
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [stampSettings, setStampSettings] = useState<StampSettings>(
    DEFAULT_STAMP_SETTINGS
  );

  /**
   * Set the active decal texture for placing (enters stamp mode)
   */
  const selectDecalTexture = useCallback(
    (texture: THREE.Texture | null, name?: string) => {
      setActiveDecalTexture(texture);
      setActiveDecalName(name || "");
      setIsPlacingMode(texture !== null);
      setSelectedDecalId(undefined); // Deselect any selected decal
      // Reset stamp settings for new decal
      if (texture) {
        setStampSettings(DEFAULT_STAMP_SETTINGS);
      }
    },
    []
  );

  /**
   * Update stamp settings (scale, rotation, opacity)
   */
  const updateStampSettings = useCallback(
    (settings: Partial<StampSettings>) => {
      setStampSettings((prev) => ({ ...prev, ...settings }));
    },
    []
  );

  /**
   * Cancel stamp mode
   */
  const cancelStampMode = useCallback(() => {
    setActiveDecalTexture(null);
    setActiveDecalName("");
    setIsPlacingMode(false);
  }, []);

  /**
   * Add a decal at the specified position (stamp it!)
   * @param targetModelId - The model to place decal on
   * @param position - Position in model's local space
   * @param normal - Surface normal in model's local space
   * @param modelScale - The model's scale factor (to adjust decal size proportionally)
   * @param uv - UV coordinates at click point (from raycaster)
   */
  const addDecal = useCallback(
    (
      targetModelId: string,
      position: [number, number, number],
      normal: [number, number, number],
      modelScale: number = 1,
      uv?: [number, number]
    ) => {
      if (!activeDecalTexture) return;

      // For DecalGeometry, we need to calculate the orientation
      // The rotation should make the decal face outward along the normal

      const normalVec = new THREE.Vector3(...normal).normalize();

      // Calculate rotation to orient decal to face along normal
      // We need to find the rotation that points -Z (default decal direction) along the normal
      const forward = new THREE.Vector3(0, 0, -1);

      // Create quaternion that rotates forward to normal direction
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        forward,
        normalVec
      );

      // Apply user's rotation around the normal axis
      const zRotation = (stampSettings.rotation * Math.PI) / 180;
      const rotationAroundNormal = new THREE.Quaternion().setFromAxisAngle(
        normalVec,
        zRotation
      );
      quaternion.premultiply(rotationAroundNormal);

      const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");

      // Adjust decal scale to be proportional to model's local space
      // If model is scaled up 30x, the decal in local space should be 1/30 of world scale
      // This ensures the decal appears the same visual size regardless of model scale
      const localScale = stampSettings.scale / modelScale;

      const options: DecalOptions = {
        position,
        rotation: [euler.x, euler.y, euler.z],
        scale: [localScale, localScale, localScale],
        opacity: stampSettings.opacity,
        uv, // Pass UV from raycaster for accurate baking
      };

      // Add to merger
      const id = merger.addDecalFromTexture(
        targetModelId,
        activeDecalTexture,
        options
      );

      // Get the decal from merger and update local state
      const decal = merger.getDecal(id);
      if (decal) {
        setDecals((prev) => [
          ...prev,
          {
            id: decal.id,
            textureUrl: decal.textureUrl,
            texture: decal.texture,
            position: decal.position,
            rotation: decal.rotation,
            scale: decal.scale,
            targetModelId: decal.targetModelId,
            opacity: decal.opacity,
          },
        ]);

        // Select the new decal
        setSelectedDecalId(id);
      }

      // Stay in placing mode so user can stamp multiple times!
      // Don't exit stamp mode - user can cancel manually

      return id;
    },
    [merger, activeDecalTexture, stampSettings]
  );

  /**
   * Update decal transform
   */
  const updateDecalTransform = useCallback(
    (id: string, transform: Partial<Transform>) => {
      merger.updateDecalTransform(id, transform);

      setDecals((prev) =>
        prev.map((decal) => {
          if (decal.id !== id) return decal;

          const updated = merger.getDecal(id);
          if (!updated) return decal;

          return {
            ...decal,
            position: updated.position,
            rotation: updated.rotation,
            scale: updated.scale,
          };
        })
      );
    },
    [merger]
  );

  /**
   * Update decal opacity
   */
  const updateDecalOpacity = useCallback(
    (id: string, opacity: number) => {
      merger.updateDecalOpacity(id, opacity);

      setDecals((prev) =>
        prev.map((decal) => (decal.id === id ? { ...decal, opacity } : decal))
      );
    },
    [merger]
  );

  /**
   * Remove a decal
   */
  const removeDecal = useCallback(
    (id: string) => {
      merger.removeDecal(id);
      setDecals((prev) => prev.filter((d) => d.id !== id));

      if (selectedDecalId === id) {
        setSelectedDecalId(undefined);
      }
    },
    [merger, selectedDecalId]
  );

  /**
   * Clear all decals
   */
  const clearDecals = useCallback(() => {
    decals.forEach((d) => {
      try {
        merger.removeDecal(d.id);
      } catch (e) {
        // Ignore errors for already removed decals
      }
    });
    setDecals([]);
    setSelectedDecalId(undefined);
    setActiveDecalTexture(null);
    setIsPlacingMode(false);
  }, [merger, decals]);

  /**
   * Select a decal
   */
  const selectDecal = useCallback((id: string | undefined) => {
    setSelectedDecalId(id);
    // Exit placing mode when selecting a decal
    if (id) {
      setIsPlacingMode(false);
      setActiveDecalTexture(null);
    }
  }, []);

  return {
    decals,
    selectedDecalId,
    activeDecalTexture,
    activeDecalName,
    isPlacingMode,
    stampSettings,
    selectDecalTexture,
    updateStampSettings,
    cancelStampMode,
    addDecal,
    updateDecalTransform,
    updateDecalOpacity,
    removeDecal,
    clearDecals,
    selectDecal,
  };
}
