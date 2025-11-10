/**
 * @fileoverview Verlet buffer management for GPU compute shaders
 * @module verlet/buffers
 *
 * This module manages the creation and configuration of GPU buffers
 * that store vertex and spring data for the Verlet cloth simulation.
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
 * - Spring list (ordered list of spring IDs for efficient iteration)
 *
 * The spring list is organized so that each vertex can efficiently
 * iterate over all springs connected to it during force accumulation.
 *
 * @throws {Error} If vertex buffers cannot be created
 */
export function setupVerletVertexBuffers() {
  const vertexCount = verletVertices.length;

  const springListArray = [];
  // Spring list array holds a list of spring IDs, ordered by the ID of
  // the vertex affected by that spring. This allows the compute shader
  // to efficiently iterate over all springs affecting each vertex.

  const vertexPositionArray = new Float32Array(vertexCount * 3);
  const vertexParamsArray = new Uint32Array(vertexCount * 3);
  // Params array holds three values for each Verlet vertex:
  // x: isFixed (1 if immovable, 0 if movable)
  // y: springCount (number of springs connected to this vertex)
  // z: springPointer (index in springListArray of first connected spring)

  for (let i = 0; i < vertexCount; i++) {
    const vertex = verletVertices[i];

    // Set initial position
    vertexPositionArray[i * 3] = vertex.position.x;
    vertexPositionArray[i * 3 + 1] = vertex.position.y;
    vertexPositionArray[i * 3 + 2] = vertex.position.z;

    // Set fixed flag
    vertexParamsArray[i * 3] = vertex.isFixed ? 1 : 0;

    // Only add spring data for movable vertices
    if (!vertex.isFixed) {
      vertexParamsArray[i * 3 + 1] = vertex.springIds.length;
      vertexParamsArray[i * 3 + 2] = springListArray.length;
      springListArray.push(...vertex.springIds);
    }
  }

  // Create GPU buffers
  // setPBO(true) is important for WebGL fallback compatibility
  vertexPositionBuffer = instancedArray(vertexPositionArray, 'vec3').setPBO(true);
  vertexForceBuffer = instancedArray(vertexCount, 'vec3');
  vertexParamsBuffer = instancedArray(vertexParamsArray, 'uvec3');
  springListBuffer = instancedArray(new Uint32Array(springListArray), 'uint').setPBO(true);
}

/**
 * Sets up spring buffers for the compute shaders
 *
 * Creates GPU buffers containing:
 * - Spring vertex IDs (pairs of vertex indices)
 * - Spring rest lengths (target distance between vertices)
 * - Spring forces (initialized storage for computed forces)
 *
 * Rest lengths are calculated based on the initial distance between
 * the two vertices connected by each spring.
 *
 * @throws {Error} If spring buffers cannot be created
 */
export function setupVerletSpringBuffers() {
  const springCount = verletSprings.length;

  const springVertexIdArray = new Uint32Array(springCount * 2);
  const springRestLengthArray = new Float32Array(springCount);

  for (let i = 0; i < springCount; i++) {
    const spring = verletSprings[i];

    // Store the IDs of the two vertices connected by this spring
    springVertexIdArray[i * 2] = spring.vertex0.id;
    springVertexIdArray[i * 2 + 1] = spring.vertex1.id;

    // Calculate and store the rest length (initial distance)
    springRestLengthArray[i] = spring.vertex0.position.distanceTo(
      spring.vertex1.position
    );
  }

  // Create GPU buffers
  // setPBO(true) is important for WebGL fallback compatibility
  springVertexIdBuffer = instancedArray(springVertexIdArray, 'uvec2').setPBO(true);
  springRestLengthBuffer = instancedArray(springRestLengthArray, 'float');
  springForceBuffer = instancedArray(springCount * 3, 'vec3').setPBO(true);
}
