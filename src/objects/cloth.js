/**
 * @fileoverview Cloth mesh creation and rendering
 * @module objects/cloth
 *
 * This module handles the creation of the visual cloth mesh that is rendered
 * on screen. The mesh vertices are positioned based on the Verlet simulation
 * data, with each mesh vertex centered between 4 Verlet vertices.
 */

import * as THREE from "three/webgpu";
import { Fn, attribute, transformNormalToView, cross, float, vec3, select, uint } from "three/tsl";
import { vertexPositionBuffer } from "../verlet/buffers.js";
import { verletVertexColumns, verletVertexColumnsBottom } from "../verlet/geometry.js";
import {
  CLOTH_NUM_SEGMENTS_X,
  CLOTH_NUM_SEGMENTS_Y,
  CLOTH_WIDTH,
  CLOTH_HEIGHT,
  DEFAULT_COLORS,
  SPRING_BREAK_THRESHOLD,
} from "../config/constants.js";

// Calculate max edge length before considering it broken (same as wireframe)
const REST_LENGTH = Math.max(
  CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X,
  CLOTH_HEIGHT / CLOTH_NUM_SEGMENTS_Y
);
const MAX_EDGE_LENGTH = REST_LENGTH * SPRING_BREAK_THRESHOLD;

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
  // Each Verlet quad gets its own 4 vertices in the mesh (not shared)
  // This makes each quad independent - no triangles span across quads
  // We render both TOP and BOTTOM layers for thickness
  const quadsPerLayer = CLOTH_NUM_SEGMENTS_X * CLOTH_NUM_SEGMENTS_Y;
  const quadCount = quadsPerLayer * 2; // Top + Bottom layers
  const vertexCount = quadCount * 4; // 4 vertices per quad
  const geometry = new THREE.BufferGeometry();

  // Each vertex stores the 4 Verlet vertex IDs of its parent quad
  const verletVertexIdArray = new Uint32Array(vertexCount * 4);
  // Store which corner of the quad this vertex represents (0-3)
  const cornerIndexArray = new Uint32Array(vertexCount);
  const indices = [];

  // Build the mesh geometry - each quad is independent
  let vertexIndex = 0;
  
  // ========== TOP LAYER ==========
  for (let x = 0; x < CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y < CLOTH_NUM_SEGMENTS_Y; y++) {
      // Get the 4 Verlet vertex IDs for this quad (TOP layer)
      const v0id = verletVertexColumns[x][y].id;
      const v1id = verletVertexColumns[x + 1][y].id;
      const v2id = verletVertexColumns[x][y + 1].id;
      const v3id = verletVertexColumns[x + 1][y + 1].id;

      // Create 4 mesh vertices for this quad
      for (let corner = 0; corner < 4; corner++) {
        const idx = vertexIndex * 4;
        verletVertexIdArray[idx] = v0id;
        verletVertexIdArray[idx + 1] = v1id;
        verletVertexIdArray[idx + 2] = v2id;
        verletVertexIdArray[idx + 3] = v3id;
        cornerIndexArray[vertexIndex] = corner;
        vertexIndex++;
      }

      // Create 2 triangles for this quad (front-facing for top layer)
      const baseIndex = (x * CLOTH_NUM_SEGMENTS_Y + y) * 4;
      indices.push(baseIndex + 0, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }
  }
  
  // ========== BOTTOM LAYER ==========
  const bottomLayerOffset = quadsPerLayer * 4;
  for (let x = 0; x < CLOTH_NUM_SEGMENTS_X; x++) {
    for (let y = 0; y < CLOTH_NUM_SEGMENTS_Y; y++) {
      // Get the 4 Verlet vertex IDs for this quad (BOTTOM layer)
      const v0id = verletVertexColumnsBottom[x][y].id;
      const v1id = verletVertexColumnsBottom[x + 1][y].id;
      const v2id = verletVertexColumnsBottom[x][y + 1].id;
      const v3id = verletVertexColumnsBottom[x + 1][y + 1].id;

      // Create 4 mesh vertices for this quad
      for (let corner = 0; corner < 4; corner++) {
        const idx = vertexIndex * 4;
        verletVertexIdArray[idx] = v0id;
        verletVertexIdArray[idx + 1] = v1id;
        verletVertexIdArray[idx + 2] = v2id;
        verletVertexIdArray[idx + 3] = v3id;
        cornerIndexArray[vertexIndex] = corner;
        vertexIndex++;
      }

      // Create 2 triangles for this quad (reverse winding for bottom layer)
      const baseIndex = bottomLayerOffset + (x * CLOTH_NUM_SEGMENTS_Y + y) * 4;
      indices.push(baseIndex + 0, baseIndex + 2, baseIndex + 1);
      indices.push(baseIndex + 1, baseIndex + 2, baseIndex + 3);
    }
  }

  // Set up geometry buffers
  geometry.setAttribute("position", new THREE.BufferAttribute(
    new Float32Array(vertexCount * 3), 3, false
  ));
  geometry.setAttribute("vertexIds", new THREE.BufferAttribute(
    verletVertexIdArray, 4, false
  ));
  geometry.setAttribute("cornerIndex", new THREE.BufferAttribute(
    cornerIndexArray, 1, false
  ));
  geometry.setIndex(indices);

  // Create material with physical properties for realistic cloth rendering
  clothMaterial = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color().setHex(DEFAULT_COLORS.color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
    roughness: 0.4,
    metalness: 0.4,
    emissive: new THREE.Color().setHex(DEFAULT_COLORS.color),
    emissiveIntensity: 0.2,
  });

  // Custom position node that calculates vertex position and normal
  // Each vertex is positioned at one of the 4 corners of its Verlet quad
  clothMaterial.positionNode = Fn(({ material }) => {
    // Get the IDs of the 4 Verlet vertices for this quad
    const vertexIds = attribute("vertexIds");
    // Get which corner of the quad this vertex represents (0-3)
    const cornerIndex = attribute("cornerIndex");
    
    // Get all 4 Verlet positions
    const v0 = vertexPositionBuffer.element(vertexIds.x).toVar();
    const v1 = vertexPositionBuffer.element(vertexIds.y).toVar();
    const v2 = vertexPositionBuffer.element(vertexIds.z).toVar();
    const v3 = vertexPositionBuffer.element(vertexIds.w).toVar();
    
    // Check if any edge of this quad is broken (too long)
    // Quad edges: v0-v1 (top), v2-v3 (bottom), v0-v2 (left), v1-v3 (right)
    const edge01 = v1.sub(v0).length();
    const edge23 = v3.sub(v2).length();
    const edge02 = v2.sub(v0).length();
    const edge13 = v3.sub(v1).length();
    
    const maxEdgeThreshold = float(MAX_EDGE_LENGTH);
    const isQuadBroken = edge01.greaterThan(maxEdgeThreshold)
      .or(edge23.greaterThan(maxEdgeThreshold))
      .or(edge02.greaterThan(maxEdgeThreshold))
      .or(edge13.greaterThan(maxEdgeThreshold));
    
    // Select position based on corner index
    // Corner 0 = v0, Corner 1 = v1, Corner 2 = v2, Corner 3 = v3
    const isCorner0 = cornerIndex.equal(uint(0));
    const isCorner1 = cornerIndex.equal(uint(1));
    const isCorner2 = cornerIndex.equal(uint(2));
    
    const cornerPosition = select(isCorner0, v0,
      select(isCorner1, v1,
        select(isCorner2, v2, v3)
      )
    );
    
    // If quad is broken, collapse ALL vertices to the same point (v0)
    // This makes both triangles degenerate (zero area) and invisible
    const position = select(isQuadBroken, v0, cornerPosition);
    
    // Calculate edge midpoints for normal calculation
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
    
    return position;
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
