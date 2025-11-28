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
  CLOTH_THICKNESS,
  Z_SPRING_STIFFNESS,
} from "../config/constants.js";

/**
 * Default stiffness for in-plane springs (will be overridden by uniform)
 */
const DEFAULT_IN_PLANE_STIFFNESS = 0.2;

/**
 * Array storing all Verlet vertices in the simulation
 * @type {Array<Object>}
 */
export const verletVertices = [];

/**
 * Array storing all Verlet springs (both in-plane and Z-springs unified)
 * @type {Array<Object>}
 */
export const verletSprings = [];

/**
 * 2D array storing TOP layer vertices organized by column for easy grid access
 * @type {Array<Array<Object>>}
 */
export const verletVertexColumns = [];

/**
 * 2D array storing BOTTOM layer vertices organized by column
 * @type {Array<Array<Object>>}
 */
export const verletVertexColumnsBottom = [];

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
 * @param {number} stiffness - Spring stiffness coefficient
 * @param {boolean} isZSpring - Whether this is a Z-spring (unbreakable)
 * @returns {Object} The created spring object
 */
function addVerletSpring(vertex0, vertex1, stiffness = DEFAULT_IN_PLANE_STIFFNESS, isZSpring = false) {
  const id = verletSprings.length;
  const spring = {
    id,
    vertex0,
    vertex1,
    stiffness,
    isZSpring, // Z-springs are unbreakable, in-plane springs can break
  };
  vertex0.springIds.push({ id, isZSpring });
  vertex1.springIds.push({ id, isZSpring });
  verletSprings.push(spring);
  return spring;
}

/**
 * Sets up the Verlet geometry system with dual-layer thickness
 *
 * Creates two layers of vertices (top and bottom) connected by:
 * - In-plane springs (horizontal, vertical, diagonal) for each layer
 * - Z-springs connecting corresponding vertices between layers (volume preservation)
 *
 * All springs are stored in a unified array with per-spring stiffness.
 * The total energy is: E_total = E_linear + E_z_spring
 *
 * @throws {Error} If vertices or springs cannot be created
 */
export function setupVerletGeometry() {
  // Clear any existing geometry
  verletVertices.length = 0;
  verletSprings.length = 0;
  verletVertexColumns.length = 0;
  verletVertexColumnsBottom.length = 0;

  const halfThickness = CLOTH_THICKNESS / 2;

  // ========================================================================
  // Create TOP layer vertices (y = +halfThickness)
  // ========================================================================
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    const column = [];

    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      const posX = x * (CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X) - CLOTH_WIDTH * 0.5;
      const posZ = y * (CLOTH_HEIGHT / CLOTH_NUM_SEGMENTS_Y) - CLOTH_HEIGHT * 0.5;

      // Fix ALL edge vertices to create tension
      const isLeftEdge = x === 0;
      const isRightEdge = x === CLOTH_NUM_SEGMENTS_X;
      const isFrontEdge = y === 0;
      const isBackEdge = y === CLOTH_NUM_SEGMENTS_Y;
      const isFixed = isLeftEdge || isRightEdge || isFrontEdge || isBackEdge;

      const vertex = addVerletVertex(posX, halfThickness, posZ, isFixed);
      vertex.layer = 'top';
      column.push(vertex);
    }

    verletVertexColumns.push(column);
  }

  // ========================================================================
  // Create BOTTOM layer vertices (y = -halfThickness)
  // ========================================================================
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    const column = [];

    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      const posX = x * (CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X) - CLOTH_WIDTH * 0.5;
      const posZ = y * (CLOTH_HEIGHT / CLOTH_NUM_SEGMENTS_Y) - CLOTH_HEIGHT * 0.5;

      // Fix ALL edge vertices to create tension
      const isLeftEdge = x === 0;
      const isRightEdge = x === CLOTH_NUM_SEGMENTS_X;
      const isFrontEdge = y === 0;
      const isBackEdge = y === CLOTH_NUM_SEGMENTS_Y;
      const isFixed = isLeftEdge || isRightEdge || isFrontEdge || isBackEdge;

      const vertex = addVerletVertex(posX, -halfThickness, posZ, isFixed);
      vertex.layer = 'bottom';
      column.push(vertex);
    }

    verletVertexColumnsBottom.push(column);
  }

  // ========================================================================
  // Create in-plane springs for TOP layer
  // ========================================================================
  createLayerSprings(verletVertexColumns);

  // ========================================================================
  // Create in-plane springs for BOTTOM layer
  // ========================================================================
  createLayerSprings(verletVertexColumnsBottom);

  // ========================================================================
  // Create Z-springs connecting top and bottom layers (volume preservation)
  // ========================================================================
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      const topVertex = verletVertexColumns[x][y];
      const bottomVertex = verletVertexColumnsBottom[x][y];
      
      // Connect corresponding vertices between layers with higher stiffness
      // Z-springs are marked as unbreakable (isZSpring = true)
      addVerletSpring(topVertex, bottomVertex, Z_SPRING_STIFFNESS, true);
    }
  }
}

/**
 * Creates in-plane springs for a single layer
 * @param {Array<Array<Object>>} columns - The vertex columns for this layer
 */
function createLayerSprings(columns) {
  for (let x = 0; x <= CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y <= CLOTH_NUM_SEGMENTS_Y; y++) {
      const vertex0 = columns[x][y];

      // Horizontal spring (left)
      if (x > 0) {
        addVerletSpring(vertex0, columns[x - 1][y]);
      }

      // Vertical spring (up)
      if (y > 0) {
        addVerletSpring(vertex0, columns[x][y - 1]);
      }

      // Diagonal spring (up-left)
      if (x > 0 && y > 0) {
        addVerletSpring(vertex0, columns[x - 1][y - 1]);
      }

      // Diagonal spring (down-left)
      if (x > 0 && y < CLOTH_NUM_SEGMENTS_Y) {
        addVerletSpring(vertex0, columns[x - 1][y + 1]);
      }
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
 * Gets the total number of springs (in-plane + Z-springs)
 * @returns {number} The spring count
 */
export function getSpringCount() {
  return verletSprings.length;
}
