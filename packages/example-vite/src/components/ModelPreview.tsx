import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { useCursor } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MeshMerger, DecalInstance } from "@poppod/three-mesh-merger";

const modes = ["translate", "rotate", "scale"] as const;

// Helper to create a merged mesh from an Object3D
// DecalGeometry requires proper normals and non-indexed geometry works better
// Important: We need to apply the full world transform relative to the group
function createMergedMeshFromGroup(group: THREE.Object3D): THREE.Mesh | null {
  // First, ensure world matrices are up to date
  group.updateWorldMatrix(true, true);

  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      meshes.push(child);
    }
  });

  console.log("createMergedMeshFromGroup: found", meshes.length, "meshes");

  if (meshes.length === 0) return null;

  try {
    const geometries: THREE.BufferGeometry[] = [];

    // Get group's world matrix inverse to transform meshes to group's local space
    const groupWorldMatrixInverse = group.matrixWorld.clone().invert();

    meshes.forEach((mesh, index) => {
      let geo = mesh.geometry.clone();

      console.log(`Mesh ${index}:`, {
        hasIndex: geo.index !== null,
        attributes: Object.keys(geo.attributes),
        vertexCount: geo.attributes.position?.count,
      });

      // Convert indexed geometry to non-indexed for better DecalGeometry support
      if (geo.index !== null) {
        geo = geo.toNonIndexed();
        console.log(
          `  After toNonIndexed: vertexCount =`,
          geo.attributes.position?.count
        );
      }

      // Ensure normals exist
      if (!geo.attributes.normal) {
        geo.computeVertexNormals();
        console.log(`  Computed normals`);
      }

      // Apply mesh's world matrix, then transform to group's local space
      // This accounts for any parent transforms within the model
      mesh.updateWorldMatrix(true, false);
      const relativeMatrix = mesh.matrixWorld
        .clone()
        .premultiply(groupWorldMatrixInverse);
      geo.applyMatrix4(relativeMatrix);

      console.log(`  Applied relative transform`);

      geometries.push(geo);
    });

    let finalGeo: THREE.BufferGeometry;
    if (geometries.length === 1) {
      finalGeo = geometries[0];
    } else {
      const merged = mergeGeometries(geometries, false);
      if (!merged) {
        console.warn("mergeGeometries returned null");
        return null;
      }
      finalGeo = merged;
    }

    // Ensure final geometry has normals
    if (!finalGeo.attributes.normal) {
      finalGeo.computeVertexNormals();
    }

    console.log("Final geometry:", {
      attributes: Object.keys(finalGeo.attributes),
      vertexCount: finalGeo.attributes.position?.count,
    });

    const resultMesh = new THREE.Mesh(finalGeo, new THREE.MeshBasicMaterial());
    // Update matrices for DecalGeometry
    resultMesh.updateMatrix();
    resultMesh.updateMatrixWorld(true);

    return resultMesh;
  } catch (e) {
    console.warn("Failed to merge meshes:", e);
    return null;
  }
}

// Component to render a single decal using DecalGeometry
function ModelDecal({
  decal,
  parentGroup,
}: {
  decal: DecalInstance;
  parentGroup: THREE.Object3D;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [decalGeometry, setDecalGeometry] =
    useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!parentGroup) return;

    const targetMesh = createMergedMeshFromGroup(parentGroup);
    if (!targetMesh) return;

    try {
      const position = new THREE.Vector3(...decal.position);
      const rotation = new THREE.Euler(...decal.rotation);
      const size = new THREE.Vector3(...decal.scale);

      // Check mesh bounding box to verify position is within range
      targetMesh.geometry.computeBoundingBox();
      const bbox = targetMesh.geometry.boundingBox;

      console.log("=== DECAL DEBUG ===");
      console.log(
        "Position:",
        position.x.toFixed(3),
        position.y.toFixed(3),
        position.z.toFixed(3)
      );
      console.log(
        "Rotation:",
        rotation.x.toFixed(3),
        rotation.y.toFixed(3),
        rotation.z.toFixed(3)
      );
      console.log(
        "Size:",
        size.x.toFixed(3),
        size.y.toFixed(3),
        size.z.toFixed(3)
      );
      console.log(
        "BBox min:",
        bbox?.min.x.toFixed(3),
        bbox?.min.y.toFixed(3),
        bbox?.min.z.toFixed(3)
      );
      console.log(
        "BBox max:",
        bbox?.max.x.toFixed(3),
        bbox?.max.y.toFixed(3),
        bbox?.max.z.toFixed(3)
      );

      // Check if position is inside bounding box
      const isInside =
        bbox &&
        position.x >= bbox.min.x &&
        position.x <= bbox.max.x &&
        position.y >= bbox.min.y &&
        position.y <= bbox.max.y &&
        position.z >= bbox.min.z &&
        position.z <= bbox.max.z;
      console.log("Position inside bbox:", isInside);

      const decalGeo = new DecalGeometry(targetMesh, position, rotation, size);

      if (
        decalGeo.attributes.position &&
        decalGeo.attributes.position.count > 0
      ) {
        setDecalGeometry(decalGeo);
        console.log(
          "Decal geometry created with",
          decalGeo.attributes.position.count,
          "vertices"
        );
      } else {
        console.warn("Decal geometry has no vertices");
      }

      targetMesh.geometry.dispose();
    } catch (e) {
      console.warn("Failed to create decal:", e);
    }
  }, [parentGroup, decal.position, decal.rotation, decal.scale]);

  if (!decalGeometry || !decal.texture) return null;

  return (
    <mesh ref={meshRef} geometry={decalGeometry} renderOrder={100}>
      <meshBasicMaterial
        map={decal.texture}
        transparent
        opacity={decal.opacity}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Decal preview component for hover effect
function DecalPreview({
  parentGroup,
  position,
  rotation,
  scale,
  texture,
}: {
  parentGroup: THREE.Object3D;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  texture: THREE.Texture;
}) {
  const [decalGeometry, setDecalGeometry] =
    useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!parentGroup) return;

    const targetMesh = createMergedMeshFromGroup(parentGroup);
    if (!targetMesh) return;

    try {
      const pos = new THREE.Vector3(...position);
      const rot = new THREE.Euler(...rotation);
      const size = new THREE.Vector3(scale, scale, scale);

      const decalGeo = new DecalGeometry(targetMesh, pos, rot, size);

      if (
        decalGeo.attributes.position &&
        decalGeo.attributes.position.count > 0
      ) {
        setDecalGeometry(decalGeo);
      }

      targetMesh.geometry.dispose();
    } catch (e) {
      // Silent fail for preview
    }
  }, [parentGroup, position, rotation, scale]);

  if (!decalGeometry) return null;

  return (
    <mesh geometry={decalGeometry} renderOrder={101}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.5}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface ModelPreviewProps {
  merger: MeshMerger;
  isMerged: boolean;
  onSelect?: (id: string | undefined) => void;
  selectedModelId?: string;
  transformMode?: "translate" | "rotate" | "scale";
  onModeChange?: (mode: "translate" | "rotate" | "scale") => void;
  onObjectRef?: (id: string, ref: any) => void;
  // Decal props
  decals?: DecalInstance[];
  isPlacingDecal?: boolean;
  activeDecalTexture?: THREE.Texture | null;
  stampScale?: number;
  stampRotation?: number; // in degrees
  onPlaceDecal?: (
    targetModelId: string,
    position: [number, number, number],
    normal: [number, number, number],
    modelScale: number, // Model scale to adjust decal size proportionally
    uv?: [number, number] // UV at click point from raycaster
  ) => void;
}

// Hover state for decal preview
interface HoverState {
  modelId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  modelScale: number; // Model's scale factor for proportional decal sizing
}

export function ModelPreview({
  merger,
  isMerged,
  onSelect,
  selectedModelId,
  transformMode: _transformMode,
  onModeChange,
  // Decal props
  decals = [],
  isPlacingDecal,
  activeDecalTexture,
  stampScale = 0.5,
  stampRotation = 0,
  onPlaceDecal,
}: ModelPreviewProps) {
  const clonedObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverState | null>(null);
  useCursor(!!hovered || !!isPlacingDecal);

  // Calculate decal rotation from normal
  const calculateDecalRotation = useCallback(
    (normal: THREE.Vector3): [number, number, number] => {
      const normalVec = normal.clone().normalize();
      const forward = new THREE.Vector3(0, 0, -1);

      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        forward,
        normalVec
      );

      // Apply user rotation around the normal axis
      const zRotation = (stampRotation * Math.PI) / 180;
      const rotationAroundNormal = new THREE.Quaternion().setFromAxisAngle(
        normalVec,
        zRotation
      );
      quaternion.premultiply(rotationAroundNormal);

      const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
      return [euler.x, euler.y, euler.z];
    },
    [stampRotation]
  );

  // Handle pointer move for preview
  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>, modelId: string) => {
      if (!isPlacingDecal || !activeDecalTexture) return;

      e.stopPropagation();

      const worldPoint = e.point.clone();
      const normal = e.face?.normal || new THREE.Vector3(0, 1, 0);
      const worldNormal = normal.clone();
      if (e.object) {
        worldNormal.transformDirection(e.object.matrixWorld);
      }

      // Convert to local space
      const model = merger.getModel(modelId);
      if (model) {
        const modelMatrix = new THREE.Matrix4();
        const pos = new THREE.Vector3(...model.transform.position);
        const rot = new THREE.Euler(...model.transform.rotation);
        const scale = new THREE.Vector3(...model.transform.scale);
        const quat = new THREE.Quaternion().setFromEuler(rot);
        modelMatrix.compose(pos, quat, scale);

        const inverseMatrix = modelMatrix.clone().invert();
        const localPoint = worldPoint.clone().applyMatrix4(inverseMatrix);

        const normalMatrix = new THREE.Matrix3().setFromMatrix4(inverseMatrix);
        const localNormal = worldNormal
          .clone()
          .applyMatrix3(normalMatrix)
          .normalize();

        const rotation = calculateDecalRotation(localNormal);

        // Calculate average scale (use geometric mean for uniform scaling)
        const avgScale = Math.cbrt(scale.x * scale.y * scale.z);

        setHoverPreview({
          modelId,
          position: [localPoint.x, localPoint.y, localPoint.z],
          rotation,
          modelScale: avgScale,
        });
      }
    },
    [isPlacingDecal, activeDecalTexture, merger, calculateDecalRotation]
  );

  // Handle click for decal placement
  const handleDecalClick = useCallback(
    (e: ThreeEvent<MouseEvent>, modelId: string) => {
      if (!isPlacingDecal || !onPlaceDecal) return;

      e.stopPropagation();

      // Get hit point in world space
      const worldPoint = e.point.clone();
      const normal = e.face?.normal || new THREE.Vector3(0, 1, 0);

      // Capture UV from raycaster - this is the most accurate!
      const hitUV = e.uv ? ([e.uv.x, e.uv.y] as [number, number]) : undefined;

      console.log("=== CLICK UV DEBUG ===");
      console.log("Hit UV:", hitUV);
      console.log("Hit object:", e.object?.name, e.object?.type);
      console.log("Face index:", e.faceIndex);

      // Transform normal to world space
      const worldNormal = normal.clone();
      if (e.object) {
        worldNormal.transformDirection(e.object.matrixWorld);
      }

      // Get the model's transform to convert world -> local
      const model = merger.getModel(modelId);
      if (model) {
        // Create inverse transform matrix from model transform
        const modelMatrix = new THREE.Matrix4();
        const pos = new THREE.Vector3(...model.transform.position);
        const rot = new THREE.Euler(...model.transform.rotation);
        const scale = new THREE.Vector3(...model.transform.scale);
        const quat = new THREE.Quaternion().setFromEuler(rot);
        modelMatrix.compose(pos, quat, scale);

        // Invert to get world -> local transform
        const inverseMatrix = modelMatrix.clone().invert();

        // Transform point to local space
        const localPoint = worldPoint.clone().applyMatrix4(inverseMatrix);

        // Transform normal to local space (only rotation, no translation)
        const normalMatrix = new THREE.Matrix3().setFromMatrix4(inverseMatrix);
        const localNormal = worldNormal
          .clone()
          .applyMatrix3(normalMatrix)
          .normalize();

        // Calculate average scale (use geometric mean for uniform scaling)
        const avgScale = Math.cbrt(scale.x * scale.y * scale.z);

        onPlaceDecal(
          modelId,
          [localPoint.x, localPoint.y, localPoint.z],
          [localNormal.x, localNormal.y, localNormal.z],
          avgScale,
          hitUV
        );
      } else {
        // Fallback: use world coordinates with scale 1
        onPlaceDecal(
          modelId,
          [worldPoint.x, worldPoint.y, worldPoint.z],
          [worldNormal.x, worldNormal.y, worldNormal.z],
          1,
          hitUV
        );
      }
    },
    [isPlacingDecal, onPlaceDecal, merger]
  );

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

  // Get decals for a specific model
  const getDecalsForModel = (modelId: string) => {
    return decals.filter((d) => d.targetModelId === modelId);
  };

  return (
    <>
      {/* Render individual models */}
      {!isMerged &&
        clonedModels.map(({ id, object }) => {
          const transform = getTransform(id);
          const modelDecals = getDecalsForModel(id);

          return (
            <group
              key={id}
              name={id}
              position={transform.position as [number, number, number]}
              rotation={transform.rotation as [number, number, number]}
              scale={transform.scale as [number, number, number]}
              // Click sets the mesh as the new target or places decal
              onClick={(e: ThreeEvent<MouseEvent>) => {
                if (isPlacingDecal) {
                  handleDecalClick(e, id);
                } else {
                  e.stopPropagation();
                  onSelect?.(id);
                }
              }}
              // If a click happened but this mesh wasn't hit we null out the target
              onPointerMissed={(e: any) => {
                if (e.type === "click" && !isPlacingDecal) {
                  onSelect?.(undefined);
                }
                setHoverPreview(null);
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
              onPointerOut={() => {
                setHovered(null);
                setHoverPreview(null);
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) =>
                handlePointerMove(e, id)
              }
            >
              <primitive object={object} />

              {/* Render decals on this model using DecalGeometry */}
              {modelDecals.map((decal) => (
                <ModelDecal key={decal.id} decal={decal} parentGroup={object} />
              ))}

              {/* Render decal preview on hover */}
              {isPlacingDecal &&
                activeDecalTexture &&
                hoverPreview &&
                hoverPreview.modelId === id && (
                  <DecalPreview
                    parentGroup={object}
                    position={hoverPreview.position}
                    rotation={hoverPreview.rotation}
                    scale={stampScale / hoverPreview.modelScale}
                    texture={activeDecalTexture}
                  />
                )}
            </group>
          );
        })}

      {/* Render merged mesh */}
      {isMerged && mergedMesh && <primitive object={mergedMesh} />}
    </>
  );
}
