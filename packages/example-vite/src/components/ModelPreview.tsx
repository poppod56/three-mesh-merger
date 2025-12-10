import { useRef, useMemo, useState } from "react";
import { useCursor } from "@react-three/drei";
import type { MeshMerger } from "@poppod/three-mesh-merger";

const modes = ["translate", "rotate", "scale"] as const;

interface ModelPreviewProps {
  merger: MeshMerger;
  isMerged: boolean;
  onSelect?: (id: string | undefined) => void;
  selectedModelId?: string;
  transformMode?: "translate" | "rotate" | "scale";
  onModeChange?: (mode: "translate" | "rotate" | "scale") => void;
  onObjectRef?: (id: string, ref: any) => void;
}

export function ModelPreview({
  merger,
  isMerged,
  onSelect,
  selectedModelId,
  transformMode: _transformMode,
  onModeChange,
}: ModelPreviewProps) {
  const clonedObjectsRef = useRef<Map<string, any>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  useCursor(!!hovered);

  // Get current models
  const models = merger.getModels();

  // Clone models only when they're added/removed, not on every render
  const clonedModels = useMemo(() => {
    if (isMerged) {
      // Clear clones when merged
      clonedObjectsRef.current.clear();
      return [];
    }

    const newClones: Array<{ id: string; object: any }> = [];
    const existingIds = new Set(clonedObjectsRef.current.keys());
    const currentIds = new Set(models.map((m) => m.id));

    // Remove deleted models
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        clonedObjectsRef.current.delete(id);
      }
    }

    // Add or reuse existing clones
    models.forEach((model) => {
      let clone = clonedObjectsRef.current.get(model.id);

      if (!clone) {
        // Create new clone only if it doesn't exist
        clone = model.scene.clone(true);
        // Reset clone transform - we'll apply transform to the wrapper group instead
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);
        clonedObjectsRef.current.set(model.id, clone);
      }

      newClones.push({ id: model.id, object: clone });
    });

    return newClones;
  }, [models.map((m) => m.id).join(","), isMerged]);

  // Get merged mesh
  const mergedMesh = isMerged ? merger.getMergedMesh() : null;

  // Get transform for a model
  const getTransform = (id: string) => {
    const model = models.find((m) => m.id === id);
    return (
      model?.transform || {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }
    );
  };

  return (
    <>
      {/* Render individual models */}
      {!isMerged &&
        clonedModels.map(({ id, object }) => {
          const transform = getTransform(id);
          return (
            <group
              key={id}
              name={id}
              position={transform.position as [number, number, number]}
              rotation={transform.rotation as [number, number, number]}
              scale={transform.scale as [number, number, number]}
              // Click sets the mesh as the new target
              onClick={(e: any) => {
                e.stopPropagation();
                onSelect?.(id);
              }}
              // If a click happened but this mesh wasn't hit we null out the target
              onPointerMissed={(e: any) => {
                if (e.type === "click") {
                  onSelect?.(undefined);
                }
              }}
              // Right click cycles through the transform modes
              onContextMenu={(e: any) => {
                if (selectedModelId === id && onModeChange && _transformMode) {
                  e.stopPropagation();
                  const currentIndex = modes.indexOf(_transformMode);
                  const nextMode = modes[(currentIndex + 1) % modes.length];
                  onModeChange(nextMode);
                }
              }}
              onPointerOver={(e: any) => {
                e.stopPropagation();
                setHovered(id);
              }}
              onPointerOut={() => setHovered(null)}
            >
              <primitive object={object} />
            </group>
          );
        })}

      {/* Render merged mesh */}
      {isMerged && mergedMesh && <primitive object={mergedMesh} />}
    </>
  );
}
