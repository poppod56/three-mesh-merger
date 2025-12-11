import * as THREE from "three";
import potpack from "potpack";
import type {
  AtlasMode,
  MaterialOverrides,
  MaterialMapping,
  AtlasResult,
} from "./types";
import {
  textureToCanvas,
  resizeCanvas,
  canvasToTexture,
  createSolidColorTexture,
  createSolidGrayscaleTexture,
} from "./utils/textureUtils";

interface PackBox {
  w: number;
  h: number;
  x?: number;
  y?: number;
}

/**
 * Handles texture atlas generation and UV remapping
 */
export class MaterialAtlas {
  private lastPackingLayout: PackBox[] | null = null;

  /**
   * Get the last packing layout (for decal baking)
   */
  getLastPackingLayout(): PackBox[] | null {
    return this.lastPackingLayout;
  }

  /**
   * Generate texture atlases and merged material
   */
  async generate(
    materials: THREE.Material[],
    materialMapping: MaterialMapping,
    geometry: THREE.BufferGeometry,
    options: {
      atlasSize: number;
      quality: number;
      atlasMode: Required<AtlasMode>;
      materialOverrides?: MaterialOverrides;
    }
  ): Promise<AtlasResult> {
    const { atlasSize, quality, atlasMode, materialOverrides } = options;

    console.log("MaterialAtlas.generate:", {
      materialsCount: materials.length,
      materialMappingSize: materialMapping.size,
      atlasSize,
    });

    // Verify that all materials are in the mapping
    materials.forEach((mat, i) => {
      const hasMapping = materialMapping.has(mat);
      const triangleCount = materialMapping.get(mat)?.length || 0;
      console.log(
        `Material ${i}: hasMapping=${hasMapping}, triangles=${triangleCount}`
      );
    });

    // Extract textures by type
    const texturesByType = this.extractTexturesByType(materials, atlasMode);

    // Generate packing layout (same for all atlases)
    const packingLayout = this.generatePackingLayout(
      texturesByType.albedo || [],
      atlasSize
    );

    // Store for decal baking
    this.lastPackingLayout = packingLayout;

    // Create atlases for each enabled map type
    const result: AtlasResult = {
      material: new THREE.MeshStandardMaterial(),
    };

    if (atlasMode.albedo && texturesByType.albedo) {
      result.albedoAtlas = await this.createAtlas(
        texturesByType.albedo,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.map = result.albedoAtlas;
    }

    if (atlasMode.normal && texturesByType.normal) {
      result.normalAtlas = await this.createAtlas(
        texturesByType.normal,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.normalMap = result.normalAtlas;
    }

    if (atlasMode.roughness && texturesByType.roughness) {
      result.roughnessAtlas = await this.createAtlas(
        texturesByType.roughness,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.roughnessMap = result.roughnessAtlas;
    }

    if (atlasMode.metalness && texturesByType.metalness) {
      result.metalnessAtlas = await this.createAtlas(
        texturesByType.metalness,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.metalnessMap = result.metalnessAtlas;
    }

    if (atlasMode.emissive && texturesByType.emissive) {
      result.emissiveAtlas = await this.createAtlas(
        texturesByType.emissive,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.emissiveMap = result.emissiveAtlas;
    }

    if (atlasMode.aoMap && texturesByType.aoMap) {
      result.aoAtlas = await this.createAtlas(
        texturesByType.aoMap,
        packingLayout,
        atlasSize,
        quality
      );
      result.material.aoMap = result.aoAtlas;
    }

    // Update UV coordinates
    this.updateUVCoordinates(
      geometry,
      materials,
      materialMapping,
      packingLayout,
      atlasSize
    );

    // Set material properties
    this.setMaterialProperties(result.material, materials, materialOverrides);

    return result;
  }

  /**
   * Extract textures from materials by type
   */
  private extractTexturesByType(
    materials: THREE.Material[],
    atlasMode: Required<AtlasMode>
  ): Record<string, THREE.Texture[]> {
    const result: Record<string, THREE.Texture[]> = {};

    const extractTexture = (
      material: THREE.Material,
      property: keyof THREE.MeshStandardMaterial,
      fallback: () => THREE.Texture
    ): THREE.Texture => {
      const mat = material as THREE.MeshStandardMaterial;
      const texture = mat[property] as THREE.Texture | null;
      return texture || fallback();
    };

    materials.forEach((material) => {
      const mat = material as THREE.MeshStandardMaterial;

      if (atlasMode.albedo) {
        if (!result.albedo) result.albedo = [];
        const albedoTexture = extractTexture(mat, "map", () =>
          createSolidColorTexture(mat.color || new THREE.Color(1, 1, 1))
        );
        console.log("MaterialAtlas extracting albedo texture:", {
          materialName: mat.name,
          textureUUID: albedoTexture.uuid,
          textureSize: albedoTexture.image
            ? `${albedoTexture.image.width}x${albedoTexture.image.height}`
            : "no image",
        });
        result.albedo.push(albedoTexture);
      }

      if (atlasMode.normal) {
        if (!result.normal) result.normal = [];
        result.normal.push(
          extractTexture(mat, "normalMap", () =>
            createSolidColorTexture(new THREE.Color(0.5, 0.5, 1))
          )
        );
      }

      if (atlasMode.roughness) {
        if (!result.roughness) result.roughness = [];
        result.roughness.push(
          extractTexture(mat, "roughnessMap", () =>
            createSolidGrayscaleTexture(mat.roughness ?? 1)
          )
        );
      }

      if (atlasMode.metalness) {
        if (!result.metalness) result.metalness = [];
        result.metalness.push(
          extractTexture(mat, "metalnessMap", () =>
            createSolidGrayscaleTexture(mat.metalness ?? 0)
          )
        );
      }

      if (atlasMode.emissive) {
        if (!result.emissive) result.emissive = [];
        result.emissive.push(
          extractTexture(mat, "emissiveMap", () =>
            createSolidColorTexture(mat.emissive || new THREE.Color(0, 0, 0))
          )
        );
      }

      if (atlasMode.aoMap) {
        if (!result.aoMap) result.aoMap = [];
        result.aoMap.push(
          extractTexture(mat, "aoMap", () => createSolidGrayscaleTexture(1))
        );
      }
    });

    return result;
  }

  /**
   * Generate packing layout using potpack
   */
  private generatePackingLayout(
    textures: THREE.Texture[],
    atlasSize: number
  ): PackBox[] {
    const boxes: PackBox[] = textures.map((texture, index) => {
      const image = texture.image as HTMLImageElement | HTMLCanvasElement;
      const w = image.width || 256;
      const h = image.height || 256;
      console.log(`Texture ${index} original size:`, { w, h });
      return { w, h };
    });

    const { w, h } = potpack(boxes);
    console.log("Potpack result:", { w, h });

    // Scale to fit atlas size
    const scale = Math.min(atlasSize / w, atlasSize / h);
    console.log("Scale factor:", scale);

    boxes.forEach((box, index) => {
      const originalW = box.w;
      const originalH = box.h;
      box.w = Math.floor(box.w * scale);
      box.h = Math.floor(box.h * scale);
      box.x = Math.floor((box.x || 0) * scale);
      box.y = Math.floor((box.y || 0) * scale);
      console.log(`Box ${index} after scale:`, {
        original: { w: originalW, h: originalH },
        scaled: { x: box.x, y: box.y, w: box.w, h: box.h },
      });
    });

    return boxes;
  }

  /**
   * Create atlas texture from packed textures
   */
  private async createAtlas(
    textures: THREE.Texture[],
    layout: PackBox[],
    atlasSize: number,
    _quality: number
  ): Promise<THREE.Texture> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    canvas.width = atlasSize;
    canvas.height = atlasSize;

    // Clear canvas
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, atlasSize, atlasSize);

    // Draw each texture to packed position
    // Using canvas coordinate system (Y=0 at top)
    textures.forEach((texture, index) => {
      const box = layout[index];
      if (box.x === undefined || box.y === undefined) return;

      // Skip if texture image is not loaded or invalid
      const image = texture.image;
      if (!image || !image.width || !image.height) {
        console.warn("Skipping texture with invalid image");
        return;
      }

      const sourceCanvas = textureToCanvas(texture);

      // Skip if source canvas has no dimensions
      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        console.warn("Skipping texture with zero-size canvas");
        return;
      }

      const resized = resizeCanvas(sourceCanvas, box.w, box.h);

      // Draw at the packed position (no flip needed - we'll use flipY=false on texture)
      ctx.drawImage(resized, box.x, box.y);
    });

    // Convert to texture
    const atlasTexture = canvasToTexture(canvas);
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    atlasTexture.generateMipmaps = true;
    // Use flipY=false so UV coordinates match canvas coordinates directly
    atlasTexture.flipY = false;

    return atlasTexture;
  }

  /**
   * Update UV coordinates to match atlas layout
   */
  private updateUVCoordinates(
    geometry: THREE.BufferGeometry,
    materials: THREE.Material[],
    materialMapping: MaterialMapping,
    layout: PackBox[],
    atlasSize: number
  ): void {
    const uvAttribute = geometry.attributes.uv as THREE.BufferAttribute;

    if (!uvAttribute) {
      console.warn("Geometry has no UV attribute");
      return;
    }

    const uvArray = uvAttribute.array as Float32Array;

    console.log("UV remapping debug:", {
      totalUVs: uvArray.length / 2,
      materialsCount: materials.length,
      layoutCount: layout.length,
    });

    materials.forEach((material, materialIndex) => {
      const triangleIndices = materialMapping.get(material);
      if (!triangleIndices) {
        console.log(`Material ${materialIndex}: no triangle indices`);
        return;
      }

      const box = layout[materialIndex];
      if (box.x === undefined || box.y === undefined) {
        console.log(`Material ${materialIndex}: no box position`);
        return;
      }

      console.log(`Material ${materialIndex}:`, {
        triangleCount: triangleIndices.length,
        box: { x: box.x, y: box.y, w: box.w, h: box.h },
      });

      // Calculate UV transform
      // With flipY=false on texture, UV coordinates match canvas coordinates directly
      // UV (0,0) = top-left of texture, same as canvas
      const scaleX = box.w / atlasSize;
      const scaleY = box.h / atlasSize;
      const offsetX = box.x / atlasSize;
      const offsetY = box.y / atlasSize;

      // Update UVs for each triangle (3 vertices per triangle)
      triangleIndices.forEach((triangleIndex) => {
        // Each triangle has 3 vertices
        for (let i = 0; i < 3; i++) {
          const vertexIndex = triangleIndex * 3 + i;
          const uvIndex = vertexIndex * 2;

          if (uvIndex + 1 < uvArray.length) {
            // Transform UV: new_uv = (old_uv * scale) + offset
            uvArray[uvIndex] = uvArray[uvIndex] * scaleX + offsetX;
            uvArray[uvIndex + 1] = uvArray[uvIndex + 1] * scaleY + offsetY;
          }
        }
      });
    });

    uvAttribute.needsUpdate = true;
  }

  /**
   * Set material properties (average or override)
   */
  private setMaterialProperties(
    targetMaterial: THREE.MeshStandardMaterial,
    sourceMaterials: THREE.Material[],
    overrides?: MaterialOverrides
  ): void {
    if (overrides) {
      // Apply overrides
      if (overrides.roughness !== undefined) {
        targetMaterial.roughness = overrides.roughness;
      }
      if (overrides.metalness !== undefined) {
        targetMaterial.metalness = overrides.metalness;
      }
      if (overrides.color !== undefined) {
        targetMaterial.color = new THREE.Color(overrides.color);
      }
      if (overrides.emissive !== undefined) {
        targetMaterial.emissive = new THREE.Color(overrides.emissive);
      }
      if (overrides.emissiveIntensity !== undefined) {
        targetMaterial.emissiveIntensity = overrides.emissiveIntensity;
      }
    } else {
      // Calculate average values
      let totalRoughness = 0;
      let totalMetalness = 0;
      const avgColor = new THREE.Color(0, 0, 0);

      sourceMaterials.forEach((material) => {
        const mat = material as THREE.MeshStandardMaterial;
        totalRoughness += mat.roughness ?? 1;
        totalMetalness += mat.metalness ?? 0;

        if (mat.color) {
          avgColor.r += mat.color.r;
          avgColor.g += mat.color.g;
          avgColor.b += mat.color.b;
        }
      });

      const count = sourceMaterials.length;
      targetMaterial.roughness = totalRoughness / count;
      targetMaterial.metalness = totalMetalness / count;
      targetMaterial.color = new THREE.Color(
        avgColor.r / count,
        avgColor.g / count,
        avgColor.b / count
      );
    }

    targetMaterial.needsUpdate = true;
  }
}
