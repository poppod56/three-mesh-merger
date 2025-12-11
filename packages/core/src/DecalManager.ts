import * as THREE from "three";
import type { DecalInstance, DecalOptions, Transform } from "./types";
import { generateId } from "./utils/mathUtils";

/**
 * Default decal options
 */
const DEFAULT_DECAL_OPTIONS: Required<Omit<DecalOptions, "uv">> = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  opacity: 1,
};

/**
 * Manages decal instances for placing textures on 3D mesh surfaces
 */
export class DecalManager {
  private decals: Map<string, DecalInstance> = new Map();
  private textureLoader: THREE.TextureLoader;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Add a decal from texture URL
   */
  async addDecal(
    targetModelId: string,
    textureUrl: string,
    options?: DecalOptions
  ): Promise<string> {
    const texture = await this.loadTexture(textureUrl);

    const id = generateId();
    const decal: DecalInstance = {
      id,
      textureUrl,
      texture,
      position: options?.position ?? DEFAULT_DECAL_OPTIONS.position,
      rotation: options?.rotation ?? DEFAULT_DECAL_OPTIONS.rotation,
      scale: options?.scale ?? DEFAULT_DECAL_OPTIONS.scale,
      targetModelId,
      opacity: options?.opacity ?? DEFAULT_DECAL_OPTIONS.opacity,
      uv: options?.uv,
    };

    this.decals.set(id, decal);
    return id;
  }

  /**
   * Add a decal from existing THREE.Texture
   */
  addDecalFromTexture(
    targetModelId: string,
    texture: THREE.Texture,
    options?: DecalOptions
  ): string {
    const id = generateId();
    const decal: DecalInstance = {
      id,
      textureUrl: "texture-object",
      texture,
      position: options?.position ?? DEFAULT_DECAL_OPTIONS.position,
      rotation: options?.rotation ?? DEFAULT_DECAL_OPTIONS.rotation,
      scale: options?.scale ?? DEFAULT_DECAL_OPTIONS.scale,
      targetModelId,
      opacity: options?.opacity ?? DEFAULT_DECAL_OPTIONS.opacity,
      uv: options?.uv,
    };

    this.decals.set(id, decal);
    return id;
  }

  /**
   * Update decal transform
   */
  updateDecalTransform(id: string, transform: Partial<Transform>): void {
    const decal = this.decals.get(id);
    if (!decal) {
      throw new Error(`Decal with id ${id} not found`);
    }

    if (transform.position) {
      decal.position = transform.position;
    }
    if (transform.rotation) {
      decal.rotation = transform.rotation;
    }
    if (transform.scale) {
      decal.scale = transform.scale;
    }
  }

  /**
   * Update decal opacity
   */
  updateDecalOpacity(id: string, opacity: number): void {
    const decal = this.decals.get(id);
    if (!decal) {
      throw new Error(`Decal with id ${id} not found`);
    }
    decal.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Remove a decal
   */
  removeDecal(id: string): void {
    if (!this.decals.has(id)) {
      throw new Error(`Decal with id ${id} not found`);
    }
    this.decals.delete(id);
  }

  /**
   * Get all decals
   */
  getDecals(): DecalInstance[] {
    return Array.from(this.decals.values());
  }

  /**
   * Get decals for a specific model
   */
  getDecalsForModel(modelId: string): DecalInstance[] {
    return this.getDecals().filter((d) => d.targetModelId === modelId);
  }

  /**
   * Get a specific decal by ID
   */
  getDecal(id: string): DecalInstance | undefined {
    return this.decals.get(id);
  }

  /**
   * Clear all decals
   */
  clear(): void {
    this.decals.clear();
  }

  /**
   * Clear decals for a specific model
   */
  clearDecalsForModel(modelId: string): void {
    const decalsToRemove = this.getDecalsForModel(modelId);
    decalsToRemove.forEach((d) => this.decals.delete(d.id));
  }

  /**
   * Load texture from URL
   */
  private loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Clone a decal with new ID
   */
  cloneDecal(id: string): string | undefined {
    const original = this.decals.get(id);
    if (!original) return undefined;

    const newId = generateId();
    const clone: DecalInstance = {
      ...original,
      id: newId,
      position: [...original.position],
      rotation: [...original.rotation],
      scale: [...original.scale],
    };

    this.decals.set(newId, clone);
    return newId;
  }
}
