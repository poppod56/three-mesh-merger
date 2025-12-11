import { useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  TransformControls,
} from "@react-three/drei";
import { ModelPreview } from "./ModelPreview";
import type {
  MeshMerger,
  Transform,
  DecalInstance,
} from "@poppod/three-mesh-merger";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Object3D, Texture } from "three";

interface SceneProps {
  merger: MeshMerger;
  isMerged: boolean;
  selectedModelId?: string;
  transformMode?: "translate" | "rotate" | "scale";
  onModelSelect?: (id: string | undefined) => void;
  onTransformChange?: (id: string, transform: Partial<Transform>) => void;
  onModeChange?: (mode: "translate" | "rotate" | "scale") => void;
  // Decal props
  decals?: DecalInstance[];
  selectedDecalId?: string;
  isPlacingDecal?: boolean;
  activeDecalTexture?: Texture | null;
  stampScale?: number;
  stampRotation?: number;
  onPlaceDecal?: (
    targetModelId: string,
    position: [number, number, number],
    normal: [number, number, number],
    modelScale: number,
    uv?: [number, number]
  ) => void;
  onSelectDecal?: (id: string | undefined) => void;
  onDecalTransformChange?: (id: string, transform: Partial<Transform>) => void;
}

function Controls({
  selectedModelId,
  transformMode,
  onTransformChange,
}: {
  selectedModelId?: string;
  transformMode?: "translate" | "rotate" | "scale";
  onTransformChange?: (id: string, transform: Partial<Transform>) => void;
}) {
  const { scene } = useThree();
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const transformRef = useRef<any>(null);
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);

  // Find object by name every frame to ensure we have the latest reference
  useFrame(() => {
    if (selectedModelId) {
      const obj = scene.getObjectByName(selectedModelId);
      if (obj !== selectedObject) {
        setSelectedObject(obj || null);
      }
    } else if (selectedObject !== null) {
      setSelectedObject(null);
    }
  });

  // Attach event listeners to TransformControls to disable OrbitControls when dragging
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const handleDraggingChanged = (event: any) => {
      if (orbitRef.current) {
        orbitRef.current.enabled = !event.value;
      }
    };

    controls.addEventListener("dragging-changed", handleDraggingChanged);
    return () => {
      controls.removeEventListener("dragging-changed", handleDraggingChanged);
    };
  }, [selectedObject]);

  return (
    <>
      {/* TransformControls must come BEFORE OrbitControls */}
      {selectedObject && (
        <TransformControls
          ref={transformRef}
          object={selectedObject}
          mode={transformMode}
          onObjectChange={() => {
            if (selectedModelId && selectedObject && onTransformChange) {
              const position: [number, number, number] = [
                selectedObject.position.x,
                selectedObject.position.y,
                selectedObject.position.z,
              ];
              const rotation: [number, number, number] = [
                selectedObject.rotation.x,
                selectedObject.rotation.y,
                selectedObject.rotation.z,
              ];
              const scale: [number, number, number] = [
                selectedObject.scale.x,
                selectedObject.scale.y,
                selectedObject.scale.z,
              ];

              onTransformChange(selectedModelId, { position, rotation, scale });
            }
          }}
        />
      )}
      {/* makeDefault makes the controls known to r3f, now transform-controls can auto-disable them when active */}
      <OrbitControls ref={orbitRef} makeDefault />
    </>
  );
}

export function Scene({
  merger,
  isMerged,
  selectedModelId,
  transformMode,
  onModelSelect,
  onTransformChange,
  onModeChange,
  // Decal props
  decals = [],
  isPlacingDecal,
  activeDecalTexture,
  stampScale,
  stampRotation,
  onPlaceDecal,
}: SceneProps) {
  return (
    <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Environment preset="studio" />

      {/* Grid */}
      <Grid
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6B7280"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9CA3AF"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
      />

      {/* Models */}
      <ModelPreview
        merger={merger}
        isMerged={isMerged}
        selectedModelId={selectedModelId}
        transformMode={transformMode}
        onSelect={onModelSelect}
        onModeChange={onModeChange}
        // Decal props
        decals={decals}
        isPlacingDecal={isPlacingDecal}
        activeDecalTexture={activeDecalTexture}
        stampScale={stampScale}
        stampRotation={stampRotation}
        onPlaceDecal={onPlaceDecal}
      />

      {/* Controls - must be after models so it can find them in the scene */}
      {!isMerged && (
        <Controls
          selectedModelId={selectedModelId}
          transformMode={transformMode}
          onTransformChange={onTransformChange}
        />
      )}
    </Canvas>
  );
}
