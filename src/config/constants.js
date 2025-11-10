/**
 * @fileoverview Configuration constants for the cloth simulation
 * @module config/constants
 */

/**
 * Cloth dimensions and segmentation
 */
export const CLOTH_WIDTH = 1.5;
export const CLOTH_HEIGHT = 1.5;
export const CLOTH_NUM_SEGMENTS_X = 30;
export const CLOTH_NUM_SEGMENTS_Y = 30;

/**
 * Sphere collision object radius
 */
export const SPHERE_RADIUS = 0.12;

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
  color: 0xff6b6b,
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
export const BACKGROUND_COLOR = 0x222244;

/**
 * Simulation time step configuration
 */
export const STEPS_PER_SECOND = 360;
export const MAX_DELTA_TIME = 1 / 60;
