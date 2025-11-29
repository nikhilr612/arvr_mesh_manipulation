/**
 * @fileoverview Cloth simulation orchestrator
 * @module simulation/cloth
 *
 * This module coordinates the setup and initialization of all components
 * needed for the volume-preserving thick cloth simulation, including 
 * dual-layer geometry, buffers, compute shaders, and visual objects.
 */

import { setupVerletGeometry } from "../verlet/geometry.js";
import {
  setupVerletVertexBuffers,
  setupVerletSpringBuffers,
} from "../verlet/buffers.js";
import { setupUniforms } from "../utils/uniforms.js";
import { setupComputeShaders, setUniforms } from "../compute/shaders.js";
import { setupWireframe } from "../objects/wireframe.js";
import { setupSphere } from "../objects/sphere.js";
import { setupClothMesh } from "../objects/cloth.js";

/**
 * Sets up the complete cloth simulation with volume-preserving thickness
 *
 * This function orchestrates the initialization of all components required
 * for the thick cloth simulation in the correct order:
 *
 * 1. Setup Verlet geometry (dual-layer vertices, all springs unified)
 * 2. Setup vertex buffers (position, force, parameters for both layers)
 * 3. Setup spring buffers (all springs with per-spring stiffness)
 * 4. Setup uniforms (simulation parameters)
 * 5. Setup compute shaders (spring and vertex physics)
 * 6. Setup wireframe visualization (debug helpers)
 * 7. Setup collision sphere
 * 8. Setup cloth mesh (visual representation - top layer)
 *
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @throws {Error} If any component fails to initialize
 */
export function setupCloth(scene) {
  // Step 1: Create the Verlet system geometry (dual-layer with springs)
  setupVerletGeometry();

  // Step 2: Create GPU buffers for vertex data
  setupVerletVertexBuffers();

  // Step 3: Create GPU buffers for spring data (unified in-plane + Z-springs)
  setupVerletSpringBuffers();

  // Step 4: Initialize uniform variables for shader parameters
  const uniforms = setupUniforms();

  // Step 5: Set up compute shaders and pass uniforms to them
  setUniforms(uniforms);
  setupComputeShaders();

  // Step 6: Create wireframe visualization helpers
  setupWireframe(scene);

  // Step 7: Create the collision sphere
  setupSphere(scene);

  // Step 8: Create the visual cloth mesh (renders top layer)
  setupClothMesh(scene);
}
