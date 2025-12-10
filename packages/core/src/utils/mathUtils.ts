import * as THREE from 'three'
import type { Transform } from '../types'

/**
 * Apply transform (position, rotation, scale) to a geometry
 */
export function applyTransformToGeometry(
  geometry: THREE.BufferGeometry,
  transform: Required<Transform>
): void {
  const matrix = new THREE.Matrix4()

  // Create transformation matrix
  const position = new THREE.Vector3(...transform.position)
  const rotation = new THREE.Euler(...transform.rotation)
  const scale = new THREE.Vector3(...transform.scale)

  matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale)

  // Apply matrix to geometry
  geometry.applyMatrix4(matrix)
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create default transform
 */
export function createDefaultTransform(): Required<Transform> {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  }
}

/**
 * Merge partial transform with defaults
 */
export function mergeTransform(partial?: Transform): Required<Transform> {
  const defaults = createDefaultTransform()
  if (!partial) return defaults

  return {
    position: partial.position ?? defaults.position,
    rotation: partial.rotation ?? defaults.rotation,
    scale: partial.scale ?? defaults.scale
  }
}
