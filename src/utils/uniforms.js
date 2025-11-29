/**
 * @fileoverview Uniform variables setup and management
 * @module utils/uniforms
 *
 * This module manages the creation and configuration of uniform variables
 * used by the compute shaders. Uniforms are values that remain constant
 * across all shader invocations but can be updated from the CPU.
 */

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

/**
 * Uniform controlling dampening/friction coefficient
 * Value close to 1.0 means less dampening, closer to 0 means more dampening
 * @type {Object|null}
 */
export let dampeningUniform = null;

/**
 * Uniform storing the sphere's current position in 3D space
 * @type {Object|null}
 */
export let spherePositionUniform = null;

/**
 * Uniform controlling spring stiffness coefficient
 * Higher values make springs stiffer/more rigid
 * @type {Object|null}
 */
export let stiffnessUniform = null;

/**
 * Uniform controlling sphere collision force multiplier
 * Set to 0 to disable sphere collision, 1 to enable
 * @type {Object|null}
 */
export let sphereUniform = null;

/**
 * Uniform controlling wind force intensity
 * Multiplier for the wind noise force applied to vertices
 * @type {Object|null}
 */
export let windUniform = null;

/**
 * Uniform controlling Z-spring stiffness multiplier
 * Affects springs connecting top and bottom layers (volume preservation)
 * @type {Object|null}
 */
export let zSpringStiffnessUniform = null;

/**
 * Uniform controlling in-plane spring stiffness multiplier
 * Affects horizontal, vertical, and diagonal springs within each layer
 * @type {Object|null}
 */
export let inPlaneStiffnessUniform = null;

/**
 * Uniform controlling sphere collision radius
 * Affects the size of the collision sphere/cylinder
 * @type {Object|null}
 */
export let sphereRadiusUniform = null;

/**
 * Uniform controlling cylinder collision height
 * When > 0, collision uses cylinder mode instead of sphere
 * @type {Object|null}
 */
export let cylinderHeightUniform = null;

/**
 * Sets up all uniforms for the simulation
 *
 * Initializes uniform variables with default values that can be
 * modified during runtime through UI controls or programmatically.
 *
 * Default values:
 * - dampening: 0.99 (minimal friction)
 * - spherePosition: (0, 0, 0) origin
 * - sphere: 1.0 (collision enabled)
 * - wind: 1.0 (normal wind strength)
 * - stiffness: 0.2 (moderate spring stiffness)
 *
 * @returns {Object} Object containing all uniforms
 */
export function setupUniforms() {
  dampeningUniform = uniform(0.99);
  spherePositionUniform = uniform(new THREE.Vector3(0, 0, 0));
  sphereUniform = uniform(1.0);
  windUniform = uniform(1.0);
  stiffnessUniform = uniform(0.2);
  zSpringStiffnessUniform = uniform(1.0);  // Multiplier for Z-spring stiffness
  inPlaneStiffnessUniform = uniform(1.0);  // Multiplier for in-plane spring stiffness
  sphereRadiusUniform = uniform(0.12);     // Collision sphere/cylinder radius
  cylinderHeightUniform = uniform(0.0);    // Cylinder height (0 = sphere mode)

  return {
    dampening: dampeningUniform,
    spherePosition: spherePositionUniform,
    stiffness: stiffnessUniform,
    sphere: sphereUniform,
    wind: windUniform,
    zSpringStiffness: zSpringStiffnessUniform,
    inPlaneStiffness: inPlaneStiffnessUniform,
    sphereRadius: sphereRadiusUniform,
    cylinderHeight: cylinderHeightUniform,
  };
}

/**
 * Gets the dampening uniform
 * @returns {Object|null} The dampening uniform
 */
export function getDampeningUniform() {
  return dampeningUniform;
}

/**
 * Gets the sphere position uniform
 * @returns {Object|null} The sphere position uniform
 */
export function getSpherePositionUniform() {
  return spherePositionUniform;
}

/**
 * Gets the stiffness uniform
 * @returns {Object|null} The stiffness uniform
 */
export function getStiffnessUniform() {
  return stiffnessUniform;
}

/**
 * Gets the sphere collision uniform
 * @returns {Object|null} The sphere uniform
 */
export function getSphereUniform() {
  return sphereUniform;
}

/**
 * Gets the wind uniform
 * @returns {Object|null} The wind uniform
 */
export function getWindUniform() {
  return windUniform;
}

/**
 * Gets the Z-spring stiffness multiplier uniform
 * @returns {Object|null} The Z-spring stiffness uniform
 */
export function getZSpringStiffnessUniform() {
  return zSpringStiffnessUniform;
}

/**
 * Gets the in-plane spring stiffness multiplier uniform
 * @returns {Object|null} The in-plane stiffness uniform
 */
export function getInPlaneStiffnessUniform() {
  return inPlaneStiffnessUniform;
}

/**
 * Gets the sphere collision radius uniform
 * @returns {Object|null} The sphere radius uniform
 */
export function getSphereRadiusUniform() {
  return sphereRadiusUniform;
}

/**
 * Gets the cylinder height uniform
 * @returns {Object|null} The cylinder height uniform
 */
export function getCylinderHeightUniform() {
  return cylinderHeightUniform;
}
