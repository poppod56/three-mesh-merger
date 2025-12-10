import * as THREE from "three";

/**
 * Convert THREE.Texture to HTMLCanvasElement
 */
export function textureToCanvas(texture: THREE.Texture): HTMLCanvasElement {
  const image = texture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  // Handle case where image is not loaded or has no dimensions
  const width = image?.width || 1;
  const height = image?.height || 1;

  canvas.width = width;
  canvas.height = height;

  if (image && width > 0 && height > 0) {
    ctx.drawImage(image, 0, 0);
  } else {
    // If no image, fill with a default color (white for albedo compatibility)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  return canvas;
}

/**
 * Resize canvas to new dimensions
 */
export function resizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return canvas;
}

/**
 * Convert HTMLCanvasElement to THREE.Texture
 */
export function canvasToTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a solid color texture of specified size
 * Default size is 256 to ensure proper atlas packing
 */
export function createSolidColorTexture(
  color: THREE.Color,
  size: number = 256
): THREE.Texture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  canvas.width = size;
  canvas.height = size;

  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  return canvasToTexture(canvas);
}

/**
 * Create a solid grayscale texture for roughness/metalness maps
 * Default size is 256 to ensure proper atlas packing
 */
export function createSolidGrayscaleTexture(
  value: number,
  size: number = 256
): THREE.Texture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  canvas.width = size;
  canvas.height = size;

  const gray = Math.floor(value * 255);
  ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
  ctx.fillRect(0, 0, size, size);

  return canvasToTexture(canvas);
}

/**
 * Wait for texture to load
 */
export function waitForTextureLoad(
  texture: THREE.Texture
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    if (texture.image && (texture.image.complete || texture.image.width > 0)) {
      resolve(texture);
      return;
    }

    const image = texture.image as HTMLImageElement;

    image.onload = () => resolve(texture);
    image.onerror = () => reject(new Error("Failed to load texture"));
  });
}
