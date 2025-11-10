/**
 * @fileoverview Cloth mesh creation and rendering
 * @module objects/cloth
 *
 * This module handles the creation of the visual cloth mesh that is rendered
 * on screen. The mesh vertices are positioned based on the Verlet simulation
 * data, with each mesh vertex centered between 4 Verlet vertices.
 */

import * as THREE from "three/webgpu";
import { Fn, attribute, transformNormalToView, cross } from "three/tsl";
import { vertexPositionBuffer } from "../verlet/buffers.js";
import { verletVertexColumns } from "../verlet/geometry.js";
import {
  CLOTH_NUM_SEGMENTS_X,
  CLOTH_NUM_SEGMENTS_Y,
  DEFAULT_COLORS,
} from "../config/constants.js";

/**
 * The cloth mesh object
 * @type {THREE.Mesh|null}
 */
export let clothMesh = null;

/**
 * The cloth material
 * @type {THREE.MeshPhysicalNodeMaterial|null}
 */
export let clothMaterial = null;

/**
 * Sets up the cloth mesh for rendering
 *
 * This function generates a Three.js Geometry and Mesh to render the cloth
 * based on the Verlet system's position data. It creates a plane mesh where
 * each vertex is centered between 4 Verlet vertices.
 *
 * The mesh uses a custom position node that:
 * - Reads the positions of 4 surrounding Verlet vertices
 * - Calculates the center position
 * - Computes surface normal from tangent and bitangent vectors
 *
 * The material uses physical-based rendering with sheen effect for
 * realistic cloth appearance.
 *
 * @param {THREE.Scene} scene - The Three.js scene to add the mesh to
 * @throws {Error} If the mesh cannot be created or added to the scene
 */
export function setupClothMesh(scene) {
  const vertexCount = CLOTH_NUM_SEGMENTS_X * CLOTH_NUM_SEGMENTS_Y;
  const geometry = new THREE.BufferGeometry();

  // verletVertexIdArray will hold the 4 Verlet vertex IDs that contribute
  // to each geometry vertex's position
  const verletVertexIdArray = new Uint32Array(vertexCount * 4);
  const indices = [];

  /**
   * Helper function to convert 2D grid coordinates to 1D array index
   * @param {number} x - X coordinate in grid
   * @param {number} y - Y coordinate in grid
   * @returns {number} 1D array index
   */
  const getIndex = (x, y) => {
    return y * CLOTH_NUM_SEGMENTS_X + x;
  };

  // Build the mesh geometry
  for (let x = 0; x < CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y < CLOTH_NUM_SEGMENTS_Y; y++) {
      const index = getIndex(x, y);

      // Store the IDs of the 4 Verlet vertices surrounding this mesh vertex
      // These form a quad: (x,y), (x+1,y), (x,y+1), (x+1,y+1)
      verletVertexIdArray[index * 4] = verletVertexColumns[x][y].id;
      verletVertexIdArray[index * 4 + 1] = verletVertexColumns[x + 1][y].id;
      verletVertexIdArray[index * 4 + 2] = verletVertexColumns[x][y + 1].id;
      verletVertexIdArray[index * 4 + 3] = verletVertexColumns[x + 1][y + 1].id;

      // Build triangle indices for this quad (2 triangles per quad)
      if (x > 0 && y > 0) {
        // First triangle
        indices.push(
          getIndex(x, y),
          getIndex(x - 1, y),
          getIndex(x - 1, y - 1),
        );
        // Second triangle
        indices.push(
          getIndex(x, y),
          getIndex(x - 1, y - 1),
          getIndex(x, y - 1),
        );
      }
    }
  }

  // Set up geometry buffers
  const verletVertexIdBuffer = new THREE.BufferAttribute(
    verletVertexIdArray,
    4,
    false,
  );
  const positionBuffer = new THREE.BufferAttribute(
    new Float32Array(vertexCount * 3),
    3,
    false,
  );
  geometry.setAttribute("position", positionBuffer);
  geometry.setAttribute("vertexIds", verletVertexIdBuffer);
  geometry.setIndex(indices);

  // Create material with physical properties for realistic cloth rendering
  clothMaterial = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color().setHex(DEFAULT_COLORS.color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    roughness: 0.7,
    metalness: 0.0,
    emissive: new THREE.Color().setHex(DEFAULT_COLORS.color),
    emissiveIntensity: 0.2,
  });

  // Custom position node that calculates vertex position and normal
  // from the 4 surrounding Verlet vertices
  clothMaterial.positionNode = Fn(({ material }) => {
    // Get the IDs of the 4 Verlet vertices surrounding this mesh vertex
    const vertexIds = attribute("vertexIds");
    const v0 = vertexPositionBuffer.element(vertexIds.x).toVar();
    const v1 = vertexPositionBuffer.element(vertexIds.y).toVar();
    const v2 = vertexPositionBuffer.element(vertexIds.z).toVar();
    const v3 = vertexPositionBuffer.element(vertexIds.w).toVar();

    // Calculate edge midpoints
    const top = v0.add(v1); // Top edge
    const right = v1.add(v3); // Right edge
    const bottom = v2.add(v3); // Bottom edge
    const left = v0.add(v2); // Left edge

    // Calculate tangent and bitangent vectors
    const tangent = right.sub(left).normalize();
    const bitangent = bottom.sub(top).normalize();

    // Calculate surface normal from cross product
    const normal = cross(tangent, bitangent);

    // Send the normal from vertex shader to fragment shader
    material.normalNode = transformNormalToView(normal).toVarying();

    // Return the center position of the 4 vertices
    return v0.add(v1).add(v2).add(v3).mul(0.25);
  })();

  // Create and add the mesh to the scene
  clothMesh = new THREE.Mesh(geometry, clothMaterial);
  clothMesh.frustumCulled = false; // Don't cull to avoid flickering
  scene.add(clothMesh);
}

/**
 * Gets the cloth mesh object
 * @returns {THREE.Mesh|null} The cloth mesh
 */
export function getClothMesh() {
  return clothMesh;
}

/**
 * Gets the cloth material
 * @returns {THREE.MeshPhysicalNodeMaterial|null} The cloth material
 */
export function getClothMaterial() {
  return clothMaterial;
}
