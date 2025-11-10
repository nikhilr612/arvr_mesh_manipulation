/**
 * @fileoverview Verlet geometry setup and management
 * @module verlet/geometry
 *
 * This module handles the creation and configuration of the Verlet system geometry,
 * including vertices and springs that form the cloth simulation structure.
 */

import * as THREE from "three/webgpu";
import {
  CLOTH_WIDTH,
  CLOTH_HEIGHT,
  CLOTH_NUM_SEGMENTS_X,
  CLOTH_NUM_SEGMENTS_Y,
} from "../config/constants.js";

/**
 * Array storing all Verlet vertices in the simulation
 * @type {Array<Object>}
 */
export const verletVertices = [];

/**
 * Array storing all Verlet springs in the simulation
 * @type {Array<Object>}
 */
export const verletSprings = [];

/**
 * 2D array storing vertices organized by column for easy grid access
 * @type {Array<Array<Object>>}
 */
export const verletVertexColumns = [];

/**
 * Adds a Verlet vertex to the simulation
 *
 * @param {number} x - X position of the vertex
 * @param {number} y - Y position of the vertex
 * @param {number} z - Z position of the vertex
 * @param {boolean} isFixed - Whether the vertex position is immovable
 * @returns {Object} The created vertex object
 */
function addVerletVertex(x, y, z, isFixed) {
  const id = verletVertices.length;
  const vertex = {
    id,
    position: new THREE.Vector3(x, y, z),
    isFixed,
    springIds: [],
  };
  verletVertices.push(vertex);
  return vertex;
}

/**
 * Adds a Verlet spring connecting two vertices
 *
 * @param {Object} vertex0 - First vertex to connect
 * @param {Object} vertex1 - Second vertex to connect
 * @returns {Object} The created spring object
 */
function addVerletSpring(vertex0, vertex1) {
  const id = verletSprings.length;
  const spring = {
    id,
    vertex0,
    vertex1,
  };
  vertex0.springIds.push(id);
  vertex1.springIds.push(id);
  verletSprings.push(spring);
  return spring;
}

/**
 * Sets up the Verlet geometry system
 *
 * Creates a grid of vertices connected by springs to simulate cloth behavior.
 * Vertices are organized in columns for efficient access. Some top vertices
 * are marked as fixed to create anchor points for the cloth.
 *
 * Springs are created between:
 * - Adjacent horizontal vertices
 * - Adjacent vertical vertices
 * - Diagonal vertices (for structural stability)
 *
 * @throws {Error} If vertices or springs cannot be created
 */
export function setupVerletGeometry() {
  // Clear any existing geometry
  verletVertices.length = 0;
  verletSprings.length = 0;
  verletVertexColumns.length = 0;

  // Create the cloth's Verlet vertices in a grid pattern
  // Cloth lays flat on the ground (XZ plane)
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    const column = [];

    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      // Calculate world position for this vertex
      const posX = x * (CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X) - CLOTH_WIDTH * 0.5;
      const posZ =
        y * (CLOTH_HEIGHT / CLOTH_NUM_SEGMENTS_Y) - CLOTH_HEIGHT * 0.5;

      // Fix ALL edge vertices to create tension
      const isLeftEdge = x === 0;
      const isRightEdge = x === CLOTH_NUM_SEGMENTS_X;
      const isFrontEdge = y === 0;
      const isBackEdge = y === CLOTH_NUM_SEGMENTS_Y;
      const isFixed = isLeftEdge || isRightEdge || isFrontEdge || isBackEdge;

      const vertex = addVerletVertex(posX, 0, posZ, isFixed);
      column.push(vertex);
    }

    verletVertexColumns.push(column);
  }

  // Create the cloth's Verlet springs
  // Springs connect adjacent and diagonal vertices for structural integrity
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      const vertex0 = verletVertexColumns[x][y];

      // Horizontal spring (left)
      if (x > 0) {
        addVerletSpring(vertex0, verletVertexColumns[x - 1][y]);
      }

      // Vertical spring (up)
      if (y > 0) {
        addVerletSpring(vertex0, verletVertexColumns[x][y - 1]);
      }

      // Diagonal spring (up-left)
      if (x > 0 && y > 0) {
        addVerletSpring(vertex0, verletVertexColumns[x - 1][y - 1]);
      }

      // Diagonal spring (down-left)
      if (x > 0 && y < CLOTH_NUM_SEGMENTS_Y) {
        addVerletSpring(vertex0, verletVertexColumns[x - 1][y + 1]);
      }

      // Optional: Add additional springs for increased rigidity
      // Uncommenting these will make the cloth more rigid by adding
      // springs between vertices that are further apart

      // if (x > 1) addVerletSpring(vertex0, verletVertexColumns[x - 2][y]);
      // if (y > 1) addVerletSpring(vertex0, verletVertexColumns[x][y - 2]);
    }
  }
}

/**
 * Gets the total number of Verlet vertices
 * @returns {number} The vertex count
 */
export function getVertexCount() {
  return verletVertices.length;
}

/**
 * Gets the total number of Verlet springs
 * @returns {number} The spring count
 */
export function getSpringCount() {
  return verletSprings.length;
}
