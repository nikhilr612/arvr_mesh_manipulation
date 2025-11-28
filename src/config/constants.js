/**
 * @fileoverview Configuration constants for the cloth simulation
 * @module config/constants
 */

/**
 * Cloth dimensions and segmentation
 */
export const CLOTH_WIDTH = 1.5;
export const CLOTH_HEIGHT = 1.5;
export const CLOTH_NUM_SEGMENTS_X = 100;
export const CLOTH_NUM_SEGMENTS_Y = 100;

/**
 * Sphere collision object radius
 */
export const SPHERE_RADIUS = 0.12;

/**
 * Cloth thickness parameters for volume preservation
 * The cloth is modeled as two layers connected by Z-springs
 */
export const CLOTH_THICKNESS = 0.003; // Distance between top and bottom layers
export const Z_SPRING_STIFFNESS = 0.8; // Stiffness of springs connecting layers (volume preservation)
export const BENDING_STIFFNESS = 12000 / (CLOTH_NUM_SEGMENTS_X * CLOTH_NUM_SEGMENTS_Y); // Stiffness of torsional/bending springs

/**
 * Cloth breaking/tearing parameters
 * Applies to all springs (both in-plane and Z-springs)
 */
export const SPRING_BREAK_THRESHOLD = 1.9; // Break at 190% of rest length
export const SPRING_BREAK_ENABLED = true; // Toggle cloth tearing on/off

/**
 * Default simulation parameters
 */
export const DEFAULT_PARAMS = {
  wireframe: false,
  sphere: true,
  wind: 0.0,
};

/**
 * Default material colors (sRGB)
 */
export const DEFAULT_COLORS = {
  color: 0x4fc1ff,
  sheenColor: 0xffffff,
};

/**
 * Camera configuration
 */
export const CAMERA_CONFIG = {
  fov: 40,
  near: 0.01,
  far: 10,
  position: {
    x: 1.5,
    y: 2.0,
    z: 1.5,
  },
};

/**
 * Camera controls configuration
 */
export const CONTROLS_CONFIG = {
  minDistance: 1,
  maxDistance: 5,
  target: {
    x: 0,
    y: 0,
    z: 0,
  },
};

/**
 * Scene background color
 */
export const BACKGROUND_COLOR = 0x333337;

/**
 * Simulation time step configuration
 */
export const STEPS_PER_SECOND = 360;
export const MAX_DELTA_TIME = 1 / 60;
