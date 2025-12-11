import * as THREE from "three";

/**
 * 3D transformation parameters
 */
export interface Transform {
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler angles in radians
  scale?: [number, number, number];
}

/**
 * Model instance in the merger
 */
export interface ModelInstance {
  id: string;
  url: string;
  scene: THREE.Scene;
  transform: Required<Transform>;
}

/**
 * Atlas mode configuration - which texture maps to include in atlas
 */
export interface AtlasMode {
  albedo?: boolean; // Default: true (color/map)
  normal?: boolean; // Default: false
  roughness?: boolean; // Default: false
  metalness?: boolean; // Default: false
  emissive?: boolean; // Default: false
  aoMap?: boolean; // Default: false (ambient occlusion)
}

/**
 * Material property overrides
 */
export interface MaterialOverrides {
  roughness?: number;
  metalness?: number;
  color?: number | string; // THREE.Color compatible
  emissive?: number | string;
  emissiveIntensity?: number;
}

/**
 * Merge operation options
 */
export interface MergeOptions {
  atlasSize?: number; // Default: 2048
  textureQuality?: number; // 0-1, Default: 0.9
  generateMipmaps?: boolean; // Default: true
  atlasMode?: AtlasMode; // Which maps to atlas
  materialOverrides?: MaterialOverrides; // Override material properties
}

/**
 * Progress callback for merge operations
 */
export type ProgressCallback = (stage: string, progress: number) => void;

/**
 * Texture packing result from potpack
 */
export interface PackedTexture {
  texture: THREE.Texture;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Atlas generation result
 */
export interface AtlasResult {
  albedoAtlas?: THREE.Texture;
  normalAtlas?: THREE.Texture;
  roughnessAtlas?: THREE.Texture;
  metalnessAtlas?: THREE.Texture;
  emissiveAtlas?: THREE.Texture;
  aoAtlas?: THREE.Texture;
  material: THREE.MeshStandardMaterial;
}

/**
 * Material to triangle indices mapping
 */
export type MaterialMapping = Map<THREE.Material, number[]>;

/**
 * Decal instance for placing textures on mesh surfaces
 */
export interface DecalInstance {
  id: string;
  textureUrl: string;
  texture?: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  targetModelId: string;
  opacity: number;
  /** UV coordinates at click point (captured from raycaster) */
  uv?: [number, number];
}

/**
 * Decal creation options
 */
export interface DecalOptions {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  opacity?: number;
  /** UV coordinates at click point (captured from raycaster) */
  uv?: [number, number];
}

/**
 * UV projection result for decal baking
 */
export interface UVProjection {
  u: number;
  v: number;
  valid: boolean;
}

/**
 * Decal baking options
 */
export interface DecalBakeOptions {
  padding?: number; // Padding around decal edges (default: 2)
  blendMode?: "normal" | "multiply" | "overlay"; // How to blend with base texture
  targetTextureSize?: number; // Target atlas texture size (if not provided, uses original texture size)
}
