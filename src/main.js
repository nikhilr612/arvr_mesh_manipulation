/**
 * @fileoverview Main application entry point for cloth simulation
 * @module main
 *
 * This is the main entry point for the WebGPU cloth simulation application.
 * It initializes the scene, sets up the simulation, creates UI controls,
 * and runs the render loop.
 *
 * @author Nikhil R., Prakyath P. Nayak
 * @version 1.0.0
 */

import * as THREE from "three/webgpu";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import {
  initRenderer,
  initScene,
  initCamera,
  initControls,
  setupSceneBackground,
  onWindowResize,
  getRenderer,
  getScene,
  getCamera,
} from "./scene/setup.js";
import { setupCloth } from "./simulation/cloth.js";
import {
  getStiffnessUniform,
  getSphereUniform,
  getWindUniform,
  getSpherePositionUniform,
} from "./utils/uniforms.js";
import { getClothMesh, getClothMaterial } from "./objects/cloth.js";
import { getSphere, updateSphere } from "./objects/sphere.js";
import {
  getVertexWireframeObject,
  getSpringWireframeObject,
} from "./objects/wireframe.js";
import { computeSpringForces, computeVertexForces } from "./compute/shaders.js";
import {
  DEFAULT_PARAMS,
  DEFAULT_COLORS,
  STEPS_PER_SECOND,
  MAX_DELTA_TIME,
} from "./config/constants.js";

/**
 * Simulation parameters that can be modified through UI
 * @type {Object}
 */
const params = { ...DEFAULT_PARAMS };

/**
 * Material API for color controls
 * @type {Object}
 */
const API = {
  color: DEFAULT_COLORS.color,
  sheenColor: DEFAULT_COLORS.sheenColor,
};

/**
 * Clock for tracking time delta
 * @type {THREE.Clock}
 */
const clock = new THREE.Clock();

/**
 * Accumulated time since last simulation step
 * @type {number}
 */
let timeSinceLastStep = 0;

/**
 * Current simulation timestamp
 * @type {number}
 */
let timestamp = 0;

/**
 * Initializes the application
 *
 * This function performs the following initialization steps:
 * 1. Checks for WebGPU support
 * 2. Initializes renderer, scene, camera, and controls
 * 3. Loads HDR environment texture
 * 4. Sets up the cloth simulation
 * 5. Creates UI controls with the Inspector
 * 6. Sets up event listeners
 * 7. Starts the render loop
 *
 * @async
 * @throws {Error} If WebGPU is not supported or initialization fails
 */
async function init() {
  // Check for WebGPU support
  if (WebGPU.isAvailable() === false) {
    document.body.appendChild(WebGPU.getErrorMessage());
    throw new Error("No WebGPU support");
  }

  // Initialize renderer
  const renderer = initRenderer();

  // Initialize scene
  const scene = initScene();

  // Initialize camera
  const camera = initCamera();

  // Initialize camera controls
  initControls(camera, renderer.domElement);

  // Setup scene background
  setupSceneBackground(scene);

  // Setup the complete cloth simulation
  setupCloth(scene);

  // Create UI controls using the Inspector
  setupUI(renderer);

  // Setup window resize listener
  window.addEventListener("resize", onWindowResize);

  // Start the render loop
  renderer.setAnimationLoop(render);
}

/**
 * Sets up the UI controls
 *
 * Creates an Inspector panel with controls for:
 * - Simulation parameters (stiffness, wireframe, sphere, wind)
 * - Material properties (color, roughness, sheen)
 *
 * @param {THREE.WebGPURenderer} renderer - The renderer with Inspector
 */
function setupUI(renderer) {
  const stiffnessUniform = getStiffnessUniform();
  const clothMaterial = getClothMaterial();

  // Create main settings panel
  const gui = renderer.inspector.createParameters("Settings");

  // Add simulation controls
  gui.add(stiffnessUniform, "value", 0.1, 0.5, 0.01).name("stiffness");
  gui.add(params, "wireframe");
  gui.add(params, "sphere");

  // Create material controls folder
  const materialFolder = gui.addFolder("material");

  materialFolder.addColor(API, "color").onChange(function (color) {
    clothMaterial.color.setHex(color);
  });

  materialFolder.add(clothMaterial, "roughness", 0.0, 1, 0.01);
  materialFolder.add(clothMaterial, "metalness", 0.0, 1, 0.01);
  materialFolder.add(clothMaterial, "emissiveIntensity", 0.0, 1, 0.01);
}

/**
 * Main render loop
 *
 * This function is called every frame and performs the following:
 * 1. Updates visibility based on UI parameters
 * 2. Calculates time delta (capped to avoid large jumps)
 * 3. Runs simulation steps at fixed time intervals
 * 4. Updates sphere position
 * 5. Executes compute shaders for physics
 * 6. Renders the scene
 *
 * The simulation uses fixed time steps (360 steps per second) to ensure
 * consistent physics regardless of frame rate.
 *
 * @async
 */
async function render() {
  const renderer = getRenderer();
  const scene = getScene();
  const camera = getCamera();
  const sphere = getSphere();
  const clothMesh = getClothMesh();
  const vertexWireframe = getVertexWireframeObject();
  const springWireframe = getSpringWireframeObject();
  const sphereUniform = getSphereUniform();
  const windUniform = getWindUniform();
  const spherePositionUniform = getSpherePositionUniform();

  // Update object visibility based on UI parameters
  sphere.visible = params.sphere;
  sphereUniform.value = params.sphere ? 1 : 0;
  clothMesh.visible = !params.wireframe;
  vertexWireframe.visible = params.wireframe;
  springWireframe.visible = params.wireframe;

  // Calculate time delta, capped to avoid large jumps (e.g., when window is out of focus)
  const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

  // Fixed time step for consistent physics across all systems
  const timePerStep = 1 / STEPS_PER_SECOND;

  // Accumulate time
  timeSinceLastStep += deltaTime;

  // Run simulation steps at fixed intervals
  while (timeSinceLastStep >= timePerStep) {
    // Advance simulation time
    timestamp += timePerStep;
    timeSinceLastStep -= timePerStep;

    // Update sphere position for collision
    updateSphere(timestamp, spherePositionUniform);

    // Execute compute shaders for physics simulation
    // First calculate spring forces, then apply them to vertices
    renderer.compute(computeSpringForces);
    renderer.compute(computeVertexForces);
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Start the application
init();
