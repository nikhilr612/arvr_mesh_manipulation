/**
 * @fileoverview Sphere collision object
 * @module objects/sphere
 *
 * This module creates and manages the sphere object that the cloth
 * collides with during the simulation. The sphere moves in a pattern
 * and provides a dynamic obstacle for the cloth physics.
 */

import * as THREE from "three/webgpu";
import { SPHERE_RADIUS } from "../config/constants.js";

/**
 * The sphere mesh object
 * @type {THREE.Mesh|null}
 */
export let sphere = null;

/**
 * Sets up the collision sphere
 *
 * Creates a sphere mesh with an icosahedron geometry that serves as
 * a collision object for the cloth simulation. The sphere is slightly
 * smaller (95%) than the collision radius used in the compute shader
 * to provide a visual buffer.
 *
 * @param {THREE.Scene} scene - The Three.js scene to add the sphere to
 * @throws {Error} If the sphere cannot be created or added to the scene
 */
export function setupSphere(scene) {
  // Use icosahedron geometry for a smooth sphere with fewer polygons
  // The radius is slightly smaller than the collision radius for visual effect
  const geometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS * 0.95, 4);
  const material = new THREE.MeshBasicNodeMaterial({ color: 0x808080 });

  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
}

/**
 * Updates the sphere position based on time
 *
 * Moves the sphere vertically down into the flat cloth and back up,
 * creating a deformation effect.
 *
 * @param {number} timestamp - Current simulation timestamp
 * @param {Object} spherePositionUniform - Uniform to update with new position
 */
export function updateSphere(timestamp, spherePositionUniform) {
  if (!sphere) return;

  // Create vertical motion - sphere moves down into cloth and back up
  // Use sine wave to create smooth oscillation between +0.8 (above) and -0.3 (below/through cloth)
  const yPosition = Math.sin(timestamp * 0.8) * 1.0 + 0.25;

  sphere.position.set(
    0, // X: centered
    yPosition, // Y: oscillates vertically through the cloth
    0, // Z: centered
  );

  // Update the uniform used by the compute shader
  spherePositionUniform.value.copy(sphere.position);
}

/**
 * Gets the sphere mesh object
 * @returns {THREE.Mesh|null} The sphere mesh
 */
export function getSphere() {
  return sphere;
}
