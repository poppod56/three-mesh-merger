import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Transform, MaterialMapping } from "./types";
import { applyTransformToGeometry } from "./utils/mathUtils";

/**
 * Normalize geometry attributes to ensure compatibility for merging
 * All geometries must have the same attributes for mergeGeometries to work
 */
function normalizeGeometryAttributes(geometries: THREE.BufferGeometry[]): void {
  if (geometries.length === 0) return;

  // Collect all attribute names across all geometries
  const allAttributes = new Set<string>();
  geometries.forEach((geo) => {
    Object.keys(geo.attributes).forEach((name) => allAttributes.add(name));
  });

  // For each geometry, ensure it has all attributes or remove non-common ones
  // Strategy: Keep only attributes that ALL geometries have
  const commonAttributes = new Set<string>();

  allAttributes.forEach((attrName) => {
    const allHave = geometries.every(
      (geo) => geo.attributes[attrName] !== undefined
    );
    if (allHave) {
      commonAttributes.add(attrName);
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
   * Returns merged geometry and material to triangle indices mapping
   */
  merge(
    scenes: THREE.Scene[],
    transforms: Required<Transform>[]
  ): {
    geometry: THREE.BufferGeometry;
    materialMapping: MaterialMapping;
  } {
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const materialMapping: MaterialMapping = new Map();

    let vertexOffset = 0;

    // Process each scene with its corresponding transform
    scenes.forEach((scene, sceneIndex) => {
      const transform = transforms[sceneIndex];

      // Collect all meshes from this scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          let geometry = object.geometry.clone();

          // Convert indexed geometry to non-indexed
          geometry = ensureNonIndexed(geometry);

          // Apply scene transform to geometry
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
    });

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
