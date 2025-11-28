/**
 * @fileoverview Scene initialization and setup
 * @module scene/setup
 *
 * This module handles the initialization of the Three.js scene, including
 * the renderer, camera, controls, lighting, and environment setup.
 */

import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Inspector } from "three/addons/inspector/Inspector.js";
import {
  CAMERA_CONFIG,
  CONTROLS_CONFIG,
  BACKGROUND_COLOR,
} from "../config/constants.js";

/**
 * The WebGPU renderer
 * @type {THREE.WebGPURenderer|null}
 */
export let renderer = null;

/**
 * The Three.js scene
 * @type {THREE.Scene|null}
 */
export let scene = null;

/**
 * The perspective camera
 * @type {THREE.PerspectiveCamera|null}
 */
export let camera = null;

/**
 * The orbit controls
 * @type {OrbitControls|null}
 */
export let controls = null;

/**
 * Initializes the Three.js renderer
 *
 * Creates a WebGPU renderer with antialiasing and configures
 * tone mapping for HDR rendering. Also attaches the Inspector
 * for debugging purposes.
 *
 * @returns {THREE.WebGPURenderer} The initialized renderer
 * @throws {Error} If renderer cannot be created
 */
export function initRenderer() {
  renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.inspector = new Inspector();
  document.body.appendChild(renderer.domElement);

  return renderer;
}

/**
 * Initializes the Three.js scene
 *
 * Creates a new empty scene that will contain all 3D objects,
 * lights, and effects.
 *
 * @returns {THREE.Scene} The initialized scene
 */
export function initScene() {
  scene = new THREE.Scene();
  return scene;
}

/**
 * Initializes the camera
 *
 * Creates a perspective camera with configured field of view,
 * aspect ratio, and clipping planes. Positions the camera
 * based on the configuration constants.
 *
 * @returns {THREE.PerspectiveCamera} The initialized camera
 */
export function initCamera() {
  camera = new THREE.PerspectiveCamera(
    CAMERA_CONFIG.fov,
    window.innerWidth / window.innerHeight,
    CAMERA_CONFIG.near,
    CAMERA_CONFIG.far,
  );
  camera.position.set(
    CAMERA_CONFIG.position.x,
    CAMERA_CONFIG.position.y,
    CAMERA_CONFIG.position.z,
  );

  return camera;
}

/**
 * Initializes the camera controls
 *
 * Creates OrbitControls for interactive camera movement with
 * configured distance limits and target position.
 *
 * @param {THREE.Camera} cam - The camera to control
 * @param {HTMLElement} domElement - The DOM element for event listeners
 * @returns {OrbitControls} The initialized controls
 * @throws {Error} If controls cannot be created
 */
export function initControls(cam, domElement) {
  controls = new OrbitControls(cam, domElement);
  controls.minDistance = CONTROLS_CONFIG.minDistance;
  controls.maxDistance = CONTROLS_CONFIG.maxDistance;
  controls.target.set(
    CONTROLS_CONFIG.target.x,
    CONTROLS_CONFIG.target.y,
    CONTROLS_CONFIG.target.z,
  );
  controls.update();

  return controls;
}

/**
 * Sets up the scene background and lighting
 *
 * Applies a simple background color to the scene and adds
 * ambient and directional lighting for proper visibility.
 *
 * @param {THREE.Scene} sceneObj - The scene to apply the background to
 */
export function setupSceneBackground(sceneObj) {
  sceneObj.background = new THREE.Color(BACKGROUND_COLOR);

  // Low ambient to avoid washing out shadows
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
  sceneObj.add(ambientLight);

  // Hemisphere light - subtle gradient
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
  hemiLight.position.set(0, 10, 0);
  sceneObj.add(hemiLight);

  // Strong key light from above-front-right (main light source)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(5, 12, 5);
  sceneObj.add(keyLight);

  // Fill light from left side (much softer than key)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-8, 4, 2);
  sceneObj.add(fillLight);

  // Back light for rim/edge definition
  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(0, 3, -10);
  sceneObj.add(backLight);

  // Subtle bottom fill
  const bottomLight = new THREE.DirectionalLight(0xffffff, 0.15);
  bottomLight.position.set(0, -5, 0);
  sceneObj.add(bottomLight);
}

/**
 * Handles window resize events
 *
 * Updates camera aspect ratio and renderer size when the browser
 * window is resized to maintain proper rendering proportions.
 */
export function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Gets the renderer instance
 * @returns {THREE.WebGPURenderer|null} The renderer
 */
export function getRenderer() {
  return renderer;
}

/**
 * Gets the scene instance
 * @returns {THREE.Scene|null} The scene
 */
export function getScene() {
  return scene;
}

/**
 * Gets the camera instance
 * @returns {THREE.PerspectiveCamera|null} The camera
 */
export function getCamera() {
  return camera;
}

/**
 * Gets the controls instance
 * @returns {OrbitControls|null} The controls
 */
export function getControls() {
  return controls;
}
