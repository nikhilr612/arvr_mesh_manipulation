/**
 * @fileoverview Verlet buffer management for GPU compute shaders
 * @module verlet/buffers
 *
 * This module manages the creation and configuration of GPU buffers
 * that store vertex and spring data for the volume-preserving thick cloth simulation.
 * All springs (in-plane and Z-springs) are combined into unified buffers.
 */

import { instancedArray } from 'three/tsl';
import { verletVertices, verletSprings } from './geometry.js';

/**
 * Buffer storing vertex positions (vec3 per vertex)
 * @type {Object|null}
 */
export let vertexPositionBuffer = null;

/**
 * Buffer storing accumulated forces on vertices (vec3 per vertex)
 * @type {Object|null}
 */
export let vertexForceBuffer = null;

/**
 * Buffer storing vertex parameters (uvec3: isFixed, springCount, springPointer)
 * @type {Object|null}
 */
export let vertexParamsBuffer = null;

/**
 * Buffer storing spring vertex IDs (uvec2 per spring: vertex0 ID, vertex1 ID)
 * @type {Object|null}
 */
export let springVertexIdBuffer = null;

/**
 * Buffer storing spring rest lengths (float per spring)
 * @type {Object|null}
 */
export let springRestLengthBuffer = null;

/**
 * Buffer storing per-spring stiffness values (float per spring)
 * Different stiffness for in-plane springs vs Z-springs
 * When a spring breaks, its stiffness is set to 0
 * @type {Object|null}
 */
export let springStiffnessBuffer = null;

/**
 * Buffer storing spring type flags (uint per spring)
 * 0 = in-plane spring (breakable), 1 = Z-spring (unbreakable)
 * @type {Object|null}
 */
export let springTypeBuffer = null;

/**
 * Buffer storing vertex broken flags (uint per vertex)
 * 0 = intact, 1 = has broken spring connection
 * Used by cloth shader to hide torn areas
 * @type {Object|null}
 */
export let vertexBrokenBuffer = null;

/**
 * Buffer storing spring forces (vec3 per spring)
 * @type {Object|null}
 */
export let springForceBuffer = null;

/**
 * Buffer storing the list of spring IDs ordered by affected vertex
 * @type {Object|null}
 */
export let springListBuffer = null;

/**
 * Sets up vertex buffers for the compute shaders
 *
 * Creates GPU buffers containing:
 * - Vertex positions (x, y, z)
 * - Vertex forces (initialized to zero)
 * - Vertex parameters (isFixed flag, spring count, spring list pointer)
 * - Spring list (ordered list of all spring IDs for efficient iteration)
 *
 * @throws {Error} If vertex buffers cannot be created
 */
export function setupVerletVertexBuffers() {
  const vertexCount = verletVertices.length;

  const springListArray = [];

  const vertexPositionArray = new Float32Array(vertexCount * 3);
  const vertexParamsArray = new Uint32Array(vertexCount * 3);
  // Params array (uvec3):
  // x: isFixed (1 if immovable, 0 if movable)
  // y: springCount (total number of springs connected to this vertex)
  // z: springPointer (index in springListArray of first connected spring)

  for (let i = 0; i < vertexCount; i++) {
    const vertex = verletVertices[i];

    // Set initial position
    vertexPositionArray[i * 3] = vertex.position.x;
    vertexPositionArray[i * 3 + 1] = vertex.position.y;
    vertexPositionArray[i * 3 + 2] = vertex.position.z;

    // Set fixed flag
    vertexParamsArray[i * 3] = vertex.isFixed ? 1 : 0;

    // Collect all spring IDs (both in-plane and Z-springs are now unified)
    const allSpringIds = vertex.springIds.map(ref => ref.id);

    // Only add spring data for movable vertices
    if (!vertex.isFixed) {
      vertexParamsArray[i * 3 + 1] = allSpringIds.length;
      vertexParamsArray[i * 3 + 2] = springListArray.length;
      springListArray.push(...allSpringIds);
    }
  }

  // Create GPU buffers
  vertexPositionBuffer = instancedArray(vertexPositionArray, 'vec3').setPBO(true);
  vertexForceBuffer = instancedArray(vertexCount, 'vec3');
  vertexParamsBuffer = instancedArray(vertexParamsArray, 'uvec3');
  springListBuffer = instancedArray(new Uint32Array(springListArray.length > 0 ? springListArray : [0]), 'uint').setPBO(true);
  
  // Buffer to track vertices with broken spring connections (0 = intact, 1 = broken)
  vertexBrokenBuffer = instancedArray(new Uint32Array(vertexCount), 'uint');
}

/**
 * Sets up spring buffers for the compute shaders
 *
 * Creates GPU buffers containing:
 * - Spring vertex IDs (pairs of vertex indices)
 * - Spring rest lengths (target distance between vertices)
 * - Spring stiffness values (per-spring, different for in-plane vs Z-springs)
 * - Spring forces (initialized storage for computed forces)
 *
 * @throws {Error} If spring buffers cannot be created
 */
export function setupVerletSpringBuffers() {
  const springCount = verletSprings.length;

  const springVertexIdArray = new Uint32Array(springCount * 2);
  const springRestLengthArray = new Float32Array(springCount);
  const springStiffnessArray = new Float32Array(springCount);
  const springTypeArray = new Uint32Array(springCount);

  for (let i = 0; i < springCount; i++) {
    const spring = verletSprings[i];

    springVertexIdArray[i * 2] = spring.vertex0.id;
    springVertexIdArray[i * 2 + 1] = spring.vertex1.id;

    springRestLengthArray[i] = spring.vertex0.position.distanceTo(
      spring.vertex1.position
    );

    // Use the spring's stiffness value (different for Z-springs vs in-plane)
    springStiffnessArray[i] = spring.stiffness;
    
    // Spring type: 0 = in-plane (breakable), 1 = Z-spring (unbreakable)
    springTypeArray[i] = spring.isZSpring ? 1 : 0;
  }

  springVertexIdBuffer = instancedArray(springVertexIdArray.length > 0 ? springVertexIdArray : new Uint32Array([0, 0]), 'uvec2').setPBO(true);
  springRestLengthBuffer = instancedArray(springRestLengthArray.length > 0 ? springRestLengthArray : new Float32Array([1]), 'float');
  springStiffnessBuffer = instancedArray(springStiffnessArray.length > 0 ? springStiffnessArray : new Float32Array([0.2]), 'float');
  springTypeBuffer = instancedArray(springTypeArray.length > 0 ? springTypeArray : new Uint32Array([0]), 'uint');
  springForceBuffer = instancedArray(Math.max(springCount, 1) * 3, 'vec3').setPBO(true);
}

/**
 * Resets all simulation buffers to their initial state
 * 
 * Restores vertex positions to their original locations and
 * resets spring stiffness values (repairing any broken springs).
 */
export function resetSimulationBuffers() {
  const vertexCount = verletVertices.length;
  const springCount = verletSprings.length;

  // Get the underlying arrays from the TSL instancedArray nodes
  const positionArray = vertexPositionBuffer.value.array;
  const stiffnessArray = springStiffnessBuffer.value.array;
  const brokenArray = vertexBrokenBuffer.value.array;

  // Reset vertex positions to initial values
  for (let i = 0; i < vertexCount; i++) {
    const vertex = verletVertices[i];
    positionArray[i * 3] = vertex.position.x;
    positionArray[i * 3 + 1] = vertex.position.y;
    positionArray[i * 3 + 2] = vertex.position.z;
  }
  // Mark buffer as needing update
  vertexPositionBuffer.value.needsUpdate = true;

  // Reset spring stiffness values (repair broken springs)
  for (let i = 0; i < springCount; i++) {
    stiffnessArray[i] = verletSprings[i].stiffness;
  }
  springStiffnessBuffer.value.needsUpdate = true;

  // Reset vertex broken flags
  for (let i = 0; i < vertexCount; i++) {
    brokenArray[i] = 0;
  }
  vertexBrokenBuffer.value.needsUpdate = true;
}
