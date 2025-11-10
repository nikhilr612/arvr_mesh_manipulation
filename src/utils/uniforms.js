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

  return {
    dampening: dampeningUniform,
    spherePosition: spherePositionUniform,
    stiffness: stiffnessUniform,
    sphere: sphereUniform,
    wind: windUniform,
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
