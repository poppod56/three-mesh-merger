import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Transform, MaterialMapping } from "./types";
import { applyTransformToGeometry } from "./utils/mathUtils";

/**
 * Ensure geometry has UV attribute, create default if missing
 */
function ensureUVAttribute(geometry: THREE.BufferGeometry): void {
  if (!geometry.attributes.uv) {
    const positionCount = geometry.attributes.position.count;
    const uvArray = new Float32Array(positionCount * 2);

    // Create simple planar UV mapping
    for (let i = 0; i < positionCount; i++) {
      uvArray[i * 2] = 0; // u = 0
      uvArray[i * 2 + 1] = 0; // v = 0
    }

    geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));
  }
}

/**
 * Ensure geometry has normal attribute, compute if missing
 */
function ensureNormalAttribute(geometry: THREE.BufferGeometry): void {
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
}

/**
 * Normalize geometry attributes to ensure compatibility for merging
 * All geometries must have the same attributes for mergeGeometries to work
 */
function normalizeGeometryAttributes(geometries: THREE.BufferGeometry[]): void {
  if (geometries.length === 0) return;

  // First, ensure all geometries have essential attributes (position, normal, uv)
  geometries.forEach((geo) => {
    ensureUVAttribute(geo);
    ensureNormalAttribute(geo);
  });

  // Collect all attribute names across all geometries
  const allAttributes = new Set<string>();
  geometries.forEach((geo) => {
    Object.keys(geo.attributes).forEach((name) => allAttributes.add(name));
  });

  // Essential attributes that we want to keep
  const essentialAttributes = new Set(["position", "normal", "uv"]);

  // For each geometry, ensure it has all attributes or remove non-common ones
  // Strategy: Keep essential attributes + common non-essential attributes
  const commonAttributes = new Set<string>();

  allAttributes.forEach((attrName) => {
    if (essentialAttributes.has(attrName)) {
      commonAttributes.add(attrName);
    } else {
      const allHave = geometries.every(
        (geo) => geo.attributes[attrName] !== undefined
      );
      if (allHave) {
        commonAttributes.add(attrName);
      }
    }
  });

  // Remove non-common attributes from all geometries
  geometries.forEach((geo) => {
    Object.keys(geo.attributes).forEach((attrName) => {
      if (!commonAttributes.has(attrName)) {
        geo.deleteAttribute(attrName);
      }
    });

    // Also remove morph attributes as they can cause issues
    geo.morphAttributes = {};
    geo.morphTargetsRelative = false;
  });

  console.log("Normalized attributes:", Array.from(commonAttributes));
}

/**
 * Ensure geometry is non-indexed (convert if needed)
 */
function ensureNonIndexed(
  geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  if (geometry.index !== null) {
    return geometry.toNonIndexed();
  }
  return geometry;
}

/**
 * Handles geometry merging operations
 */
export class GeometryMerger {
  /**
   * Merge multiple meshes into a single geometry
   * Returns merged geometry, materials array (in correct order), and material to triangle indices mapping
   */
  merge(
    scenes: THREE.Scene[],
    transforms: Required<Transform>[]
  ): {
    geometry: THREE.BufferGeometry;
    materials: THREE.Material[];
    materialMapping: MaterialMapping;
  } {
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const materialMapping: MaterialMapping = new Map();

    let vertexOffset = 0;

    // Process each scene with its corresponding transform
    scenes.forEach((scene, sceneIndex) => {
      const transform = transforms[sceneIndex];
      let meshCount = 0;

      // Collect all meshes from this scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshCount++;
          console.log(`Found mesh in scene ${sceneIndex}:`, {
            name: object.name,
            hasGeometry: !!object.geometry,
            vertexCount: object.geometry?.attributes?.position?.count || 0,
          });

          let geometry = object.geometry.clone();

          // Convert indexed geometry to non-indexed
          geometry = ensureNonIndexed(geometry);

          // First, apply the mesh's world matrix (bake the original transform from GLB)
          // This includes all parent transforms in the hierarchy
          object.updateWorldMatrix(true, false);
          geometry.applyMatrix4(object.matrixWorld);

          // Then apply the custom scene transform from user
          applyTransformToGeometry(geometry, transform);

          // Track material to triangle indices
          const material = object.material as THREE.Material;
          const vertexCount = geometry.attributes.position.count;
          const triangleIndices: number[] = [];

          // Calculate triangle indices for this geometry
          const triangleCount = vertexCount / 3;
          for (let i = 0; i < triangleCount; i++) {
            triangleIndices.push(vertexOffset + i);
          }

          if (materialMapping.has(material)) {
            materialMapping.get(material)!.push(...triangleIndices);
          } else {
            materialMapping.set(material, triangleIndices);
            materials.push(material);
          }

          vertexOffset += triangleCount;
          geometries.push(geometry);
        }
      });

      console.log(`Scene ${sceneIndex}: found ${meshCount} meshes`);
    });

    console.log(`Total geometries to merge: ${geometries.length}`);

    if (geometries.length === 0) {
      throw new Error("No meshes found in scenes");
    }

    // Normalize attributes to ensure all geometries have the same attributes
    normalizeGeometryAttributes(geometries);

    // Merge all geometries
    const mergedGeometry = mergeGeometries(geometries, false);

    if (!mergedGeometry) {
      throw new Error("Failed to merge geometries");
    }

    return {
      geometry: mergedGeometry,
      materials,
      materialMapping,
    };
  }

  /**
   * Get all unique materials from scenes
   */
  getMaterials(scenes: THREE.Scene[]): THREE.Material[] {
    const materialsSet = new Set<THREE.Material>();

    scenes.forEach((scene) => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => materialsSet.add(mat));
          } else {
            materialsSet.add(object.material);
          }
        }
      });
    });

    return Array.from(materialsSet);
  }
}
