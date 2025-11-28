/**
 * @fileoverview Wireframe visualization for debugging
 * @module objects/wireframe
 *
 * This module provides wireframe visualizations of the Verlet system
 * (vertices and springs) for debugging purposes. These helpers make
 * it easy to see the underlying physics structure.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  instanceIndex,
  attribute,
  select,
  float,
} from 'three/tsl';
import {
  vertexPositionBuffer,
  springVertexIdBuffer,
  springStiffnessBuffer,
} from '../verlet/buffers.js';
import { verletVertices, verletSprings } from '../verlet/geometry.js';
import {
  CLOTH_WIDTH,
  CLOTH_HEIGHT,
  CLOTH_NUM_SEGMENTS_X,
  CLOTH_NUM_SEGMENTS_Y,
  SPRING_BREAK_THRESHOLD,
} from '../config/constants.js';

// Calculate the max edge length for tear detection (same as cloth.js)
const REST_LENGTH = Math.max(
  CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X,
  CLOTH_HEIGHT / CLOTH_NUM_SEGMENTS_Y
);
const MAX_EDGE_LENGTH = REST_LENGTH * SPRING_BREAK_THRESHOLD;

/**
 * Mesh object for visualizing Verlet vertices
 * @type {THREE.Mesh|null}
 */
export let vertexWireframeObject = null;

/**
 * Line object for visualizing Verlet springs
 * @type {THREE.Line|null}
 */
export let springWireframeObject = null;

/**
 * Sets up wireframe visualization helpers
 *
 * Creates visual helpers to display the underlying Verlet system structure:
 * 1. Vertex visualizer - Small sprites at each Verlet vertex position
 * 2. Spring visualizer - Lines connecting vertices that have springs between them
 *
 * These visualizations are useful for debugging and understanding the
 * physics simulation structure. They can be toggled on/off via UI controls.
 *
 * @param {THREE.Scene} scene - The Three.js scene to add the wireframes to
 * @throws {Error} If wireframe objects cannot be created or added to the scene
 */
export function setupWireframe(scene) {
  // ========================================================================
  // Verlet Vertex Visualizer
  // ========================================================================
  // Creates small sprites at each vertex position that update in real-time
  // with the compute shader position buffer
  const vertexWireframeMaterial = new THREE.SpriteNodeMaterial();
  vertexWireframeMaterial.positionNode =
    vertexPositionBuffer.element(instanceIndex);

  vertexWireframeObject = new THREE.Mesh(
    new THREE.PlaneGeometry(0.01, 0.01),
    vertexWireframeMaterial
  );
  vertexWireframeObject.frustumCulled = false;
  vertexWireframeObject.count = verletVertices.length;
  scene.add(vertexWireframeObject);

  // ========================================================================
  // Verlet Spring Visualizer
  // ========================================================================
  // Creates lines connecting vertices that have springs between them
  // Each line dynamically updates its endpoints based on vertex positions

  // Create dummy position buffer (actual positions come from compute shader)
  const springWireframePositionBuffer = new THREE.BufferAttribute(
    new Float32Array(6),
    3,
    false
  );

  // Index buffer to define the two endpoints of each line
  const springWireframeIndexBuffer = new THREE.BufferAttribute(
    new Uint32Array([0, 1]),
    1,
    false
  );

  // Material with custom position node that reads from compute shader buffer
  const springWireframeMaterial = new THREE.LineBasicNodeMaterial();
  springWireframeMaterial.positionNode = Fn(() => {
    // Get the two vertex IDs connected by this spring
    const vertexIds = springVertexIdBuffer.element(instanceIndex);
    
    // Get both vertex positions
    const pos0 = vertexPositionBuffer.element(vertexIds.x);
    const pos1 = vertexPositionBuffer.element(vertexIds.y);
    
    // Calculate the spring length
    const springLength = pos1.sub(pos0).length();
    
    // Check if spring is broken (stretched beyond threshold)
    const isBroken = springLength.greaterThan(float(MAX_EDGE_LENGTH));

    // Select which vertex position to use based on which end of the line
    // we're rendering (determined by the vertexIndex attribute)
    const vertexId = select(
      attribute('vertexIndex').equal(0),
      vertexIds.x,  // First vertex of the spring
      vertexIds.y   // Second vertex of the spring
    );

    // Get the position of the selected vertex
    const position = vertexPositionBuffer.element(vertexId);
    
    // If broken, scale to 0 (hide the line)
    const scale = select(isBroken, float(0.0), float(1.0));
    
    return position.mul(scale);
  })();

  // Create instanced buffer geometry for efficient rendering
  const springWireframeGeometry = new THREE.InstancedBufferGeometry();
  springWireframeGeometry.setAttribute(
    'position',
    springWireframePositionBuffer
  );
  springWireframeGeometry.setAttribute(
    'vertexIndex',
    springWireframeIndexBuffer
  );
  springWireframeGeometry.instanceCount = verletSprings.length;

  // Create line object and add to scene
  springWireframeObject = new THREE.Line(
    springWireframeGeometry,
    springWireframeMaterial
  );
  springWireframeObject.frustumCulled = false;
  springWireframeObject.count = verletSprings.length;
  scene.add(springWireframeObject);
}

/**
 * Gets the vertex wireframe object
 * @returns {THREE.Mesh|null} The vertex wireframe mesh
 */
export function getVertexWireframeObject() {
  return vertexWireframeObject;
}

/**
 * Gets the spring wireframe object
 * @returns {THREE.Line|null} The spring wireframe line object
 */
export function getSpringWireframeObject() {
  return springWireframeObject;
}
