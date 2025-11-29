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
  getControls,
} from "./scene/setup.js";
import { setupCloth } from "./simulation/cloth.js";
import {
  getStiffnessUniform,
  getSphereUniform,
  getWindUniform,
  getSpherePositionUniform,
  getZSpringStiffnessUniform,
  getInPlaneStiffnessUniform,
  getSphereRadiusUniform,
  getCylinderHeightUniform,
} from "./utils/uniforms.js";
import { getClothMesh, getClothMaterial } from "./objects/cloth.js";
import { getSphere, updateSphere } from "./objects/sphere.js";
import {
  getVertexWireframeObject,
  getSpringWireframeObject,
} from "./objects/wireframe.js";
import { computeSpringForces, computeVertexForces } from "./compute/shaders.js";
import { resetSimulationBuffers } from "./verlet/buffers.js";
import {
  DEFAULT_PARAMS,
  DEFAULT_COLORS,
  STEPS_PER_SECOND,
  MAX_DELTA_TIME,
  CLOTH_WIDTH,
  CLOTH_NUM_SEGMENTS_X,
  SPHERE_RADIUS,
} from "./config/constants.js";

// Calculate mouse cylinder radius based on quad size
const MOUSE_CYLINDER_RADIUS = (CLOTH_WIDTH / CLOTH_NUM_SEGMENTS_X) * 1.5;
const MOUSE_CYLINDER_MAX_HEIGHT = 0.8;
const MOUSE_DEPTH_SPEED = 0.003; // Slowed down extension

/**
 * FPS tracking variables
 */
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

/**
 * Simulation parameters that can be modified through UI
 * @type {Object}
 */
const params = { ...DEFAULT_PARAMS };

/**
 * Interaction mode: 'ball', 'mouse', or 'tablet'
 * @type {string}
 */
let interactionMode = 'ball';

/**
 * Mouse interaction state
 */
const mouseState = {
  isPressed: false,
  depth: 0,
  position: new THREE.Vector3(0, 10, 0), // Start far above cloth
  targetPosition: new THREE.Vector3(0, 10, 0),
};

/**
 * Pen/tablet interaction state
 */
const penState = {
  isPressed: false,
  pressure: 0, // 0.0 to 1.0
  position: new THREE.Vector3(0, 10, 0),
  targetPosition: new THREE.Vector3(0, 10, 0),
};

/**
 * Mouse cylinder mesh for mouse interaction mode
 * @type {THREE.Mesh|null}
 */
let mouseCylinder = null;

/**
 * Raycaster for mouse picking
 * @type {THREE.Raycaster}
 */
const raycaster = new THREE.Raycaster();

/**
 * Mouse position in normalized device coordinates
 * @type {THREE.Vector2}
 */
const mouseNDC = new THREE.Vector2();

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

  // Create mouse interaction cylinder
  setupMouseCylinder(scene);

  // Setup mouse event listeners
  setupMouseEvents(renderer.domElement);

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
  const zSpringStiffnessUniform = getZSpringStiffnessUniform();
  const inPlaneStiffnessUniform = getInPlaneStiffnessUniform();
  const clothMaterial = getClothMaterial();

  // Create custom top-right control panel
  setupControlPanel();

  // Create simulation settings in Inspector
  const gui = renderer.inspector.createParameters("Settings");

  // Create simulation settings folder
  const simFolder = gui.addFolder("Simulation");
  simFolder.add(stiffnessUniform, "value", 0.1, 0.5, 0.01).name("Stiffness");
  simFolder.add(zSpringStiffnessUniform, "value", 0.0, 3.0, 0.1).name("Z-spring Stiffness");
  simFolder.add(inPlaneStiffnessUniform, "value", 0.0, 3.0, 0.1).name("In-plane Stiffness");

  // Create material controls folder
  const materialFolder = gui.addFolder("Material");

  materialFolder.addColor(API, "color").onChange(function (color) {
    clothMaterial.color.setHex(color);
  });

  materialFolder.add(clothMaterial, "roughness", 0.0, 1, 0.01);
  materialFolder.add(clothMaterial, "metalness", 0.0, 1, 0.01);
  materialFolder.add(clothMaterial, "emissiveIntensity", 0.0, 1, 0.01);
}

/**
 * Resets the entire cloth simulation by rebuilding geometry and buffers
 */
function resetClothSimulation() {
  // Reset interaction states
  mouseState.isPressed = false;
  mouseState.depth = 0;
  mouseState.position.set(0, 10, 0);
  penState.isPressed = false;
  penState.pressure = 0;
  penState.position.set(0, 10, 0);
  
  // Re-enable controls if they were disabled
  const controls = getControls();
  if (controls) controls.enabled = true;

  // Rebuild geometry and buffers
  resetSimulationBuffers();
}

/**
 * Creates a custom control panel in the top-right corner
 */
function setupControlPanel() {
  // Create container
  const panel = document.createElement('div');
  panel.id = 'control-panel';
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    padding: 12px 16px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 160px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  // FPS display
  const fpsDisplay = document.createElement('div');
  fpsDisplay.id = 'fps-display';
  fpsDisplay.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    color: #4ade80;
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
  `;
  fpsDisplay.textContent = 'FPS: --';
  panel.appendChild(fpsDisplay);

  // Mode selector
  const modeContainer = document.createElement('div');
  modeContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
  
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Interaction Mode';
  modeLabel.style.cssText = 'font-size: 12px; color: #aaa;';
  modeContainer.appendChild(modeLabel);

  const modeSelect = document.createElement('select');
  modeSelect.style.cssText = `
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    color: white;
    padding: 6px 8px;
    cursor: pointer;
    outline: none;
  `;
  ['ball', 'mouse', 'tablet'].forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    option.style.background = '#333';
    modeSelect.appendChild(option);
  });
  modeSelect.value = interactionMode;
  modeSelect.addEventListener('change', (e) => {
    interactionMode = e.target.value;
    // Reset states when changing modes
    mouseState.isPressed = false;
    mouseState.depth = 0;
    mouseState.position.set(0, 10, 0);
    penState.isPressed = false;
    penState.pressure = 0;
    penState.position.set(0, 10, 0);
  });
  modeContainer.appendChild(modeSelect);
  panel.appendChild(modeContainer);

  // Wireframe toggle
  const wireframeContainer = document.createElement('div');
  wireframeContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const wireframeCheckbox = document.createElement('input');
  wireframeCheckbox.type = 'checkbox';
  wireframeCheckbox.id = 'wireframe-toggle';
  wireframeCheckbox.checked = params.wireframe;
  wireframeCheckbox.style.cssText = 'cursor: pointer; width: 16px; height: 16px;';
  wireframeCheckbox.addEventListener('change', (e) => {
    params.wireframe = e.target.checked;
  });
  
  const wireframeLabel = document.createElement('label');
  wireframeLabel.htmlFor = 'wireframe-toggle';
  wireframeLabel.textContent = 'Wireframe';
  wireframeLabel.style.cssText = 'cursor: pointer;';
  
  wireframeContainer.appendChild(wireframeCheckbox);
  wireframeContainer.appendChild(wireframeLabel);
  panel.appendChild(wireframeContainer);

  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Mesh';
  resetButton.style.cssText = `
    background: #ef4444;
    border: none;
    border-radius: 4px;
    color: white;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: bold;
    transition: background 0.2s;
    margin-top: 4px;
  `;
  resetButton.addEventListener('mouseenter', () => {
    resetButton.style.background = '#dc2626';
  });
  resetButton.addEventListener('mouseleave', () => {
    resetButton.style.background = '#ef4444';
  });
  resetButton.addEventListener('click', resetClothSimulation);
  panel.appendChild(resetButton);

  document.body.appendChild(panel);
}

/**
 * Creates the mouse interaction cylinder
 * 
 * @param {THREE.Scene} scene - The scene to add the cylinder to
 */
function setupMouseCylinder(scene) {
  // Create cylinder pointing downward (along -Y axis)
  const geometry = new THREE.CylinderGeometry(
    MOUSE_CYLINDER_RADIUS,  // radiusTop
    MOUSE_CYLINDER_RADIUS,  // radiusBottom
    1,                       // height (will be scaled)
    16                       // radialSegments
  );
  // Shift geometry so top is at origin (cylinder extends downward)
  geometry.translate(0, -0.5, 0);
  
  const material = new THREE.MeshBasicNodeMaterial({ color: 0xff6b6b });
  mouseCylinder = new THREE.Mesh(geometry, material);
  mouseCylinder.visible = false;
  scene.add(mouseCylinder);
}

/**
 * Sets up mouse event listeners for interaction
 * 
 * @param {HTMLElement} domElement - The renderer's DOM element
 */
function setupMouseEvents(domElement) {
  // Mouse events for mouse mode
  domElement.addEventListener('mousedown', onMouseDown);
  domElement.addEventListener('mouseup', onMouseUp);
  domElement.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('mouseleave', onMouseUp);
  
  // Pointer events for tablet/pen mode (provides pressure data)
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerleave', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);
}

/**
 * Handles mouse down event
 * 
 * @param {MouseEvent} event - The mouse event
 */
function onMouseDown(event) {
  if (interactionMode !== 'mouse' || event.button !== 0) return;
  
  // Disable orbit controls during interaction
  const controls = getControls();
  if (controls) controls.enabled = false;
  
  mouseState.isPressed = true;
  mouseState.depth = 0;
  updateMousePosition(event);
}

/**
 * Handles mouse up event
 */
function onMouseUp() {
  // Re-enable orbit controls
  const controls = getControls();
  if (controls) controls.enabled = true;
  
  mouseState.isPressed = false;
  mouseState.depth = 0;
  mouseState.position.set(0, 10, 0); // Move sphere far away
}

/**
 * Handles mouse move event
 * 
 * @param {MouseEvent} event - The mouse event
 */
function onMouseMove(event) {
  if (interactionMode !== 'mouse') return;
  updateMousePosition(event);
}

/**
 * Handles pointer down event (for tablet/pen)
 * 
 * @param {PointerEvent} event - The pointer event
 */
function onPointerDown(event) {
  if (interactionMode !== 'tablet') return;
  // Only respond to pen input, not mouse/touch in tablet mode
  if (event.pointerType !== 'pen') return;
  
  // Disable orbit controls during interaction
  const controls = getControls();
  if (controls) controls.enabled = false;
  
  penState.isPressed = true;
  penState.pressure = event.pressure;
  updatePenPosition(event);
}

/**
 * Handles pointer up event (for tablet/pen)
 */
function onPointerUp(event) {
  if (event && event.pointerType !== 'pen') return;
  
  // Re-enable orbit controls
  const controls = getControls();
  if (controls) controls.enabled = true;
  
  penState.isPressed = false;
  penState.pressure = 0;
  penState.position.set(0, 10, 0);
}

/**
 * Handles pointer move event (for tablet/pen)
 * 
 * @param {PointerEvent} event - The pointer event
 */
function onPointerMove(event) {
  if (interactionMode !== 'tablet') return;
  if (event.pointerType !== 'pen') return;
  
  if (penState.isPressed) {
    penState.pressure = event.pressure;
    console.log('Pen pressure:', event.pressure);
  }
  updatePenPosition(event);
}

/**
 * Updates pen position and calculates intersection with cloth plane
 * 
 * @param {PointerEvent} event - The pointer event
 */
function updatePenPosition(event) {
  const camera = getCamera();
  const renderer = getRenderer();
  
  // Calculate normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Create a ray from camera through pen position
  raycaster.setFromCamera(mouseNDC, camera);
  
  // Intersect with a horizontal plane at y = 0 (cloth rest position)
  const clothPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  
  if (raycaster.ray.intersectPlane(clothPlane, intersection)) {
    // Clamp to cloth bounds
    const halfWidth = CLOTH_WIDTH / 2;
    intersection.x = Math.max(-halfWidth, Math.min(halfWidth, intersection.x));
    intersection.z = Math.max(-halfWidth, Math.min(halfWidth, intersection.z));
    
    penState.targetPosition.copy(intersection);
  }
}

/**
 * Updates mouse position and calculates intersection with cloth plane
 * 
 * @param {MouseEvent} event - The mouse event
 */
function updateMousePosition(event) {
  const camera = getCamera();
  const renderer = getRenderer();
  
  // Calculate normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Create a ray from camera through mouse position
  raycaster.setFromCamera(mouseNDC, camera);
  
  // Intersect with a horizontal plane at y = 0 (cloth rest position)
  const clothPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  
  if (raycaster.ray.intersectPlane(clothPlane, intersection)) {
    // Clamp to cloth bounds
    const halfWidth = CLOTH_WIDTH / 2;
    intersection.x = Math.max(-halfWidth, Math.min(halfWidth, intersection.x));
    intersection.z = Math.max(-halfWidth, Math.min(halfWidth, intersection.z));
    
    mouseState.targetPosition.copy(intersection);
  }
}

/**
 * Updates the mouse sphere position and depth
 */
function updateMouseCylinder() {
  if (!mouseState.isPressed) return;
  
  // Gradually increase depth while mouse is held (slowed down)
  mouseState.depth = Math.min(mouseState.depth + MOUSE_DEPTH_SPEED, MOUSE_CYLINDER_MAX_HEIGHT);
  
  // Smoothly interpolate XZ position
  mouseState.position.lerp(mouseState.targetPosition, 0.3);
  
  // Cylinder stays at y=0 (top of cloth), extends downward
  mouseState.position.y = 0;
  
  // Update cylinder visual
  if (mouseCylinder) {
    mouseCylinder.position.copy(mouseState.position);
    // Scale the cylinder height based on depth
    mouseCylinder.scale.y = Math.max(mouseState.depth, 0.01);
  }
}

/**
 * Updates the pen cylinder position and depth based on pressure
 */
function updatePenCylinder() {
  if (!penState.isPressed) return;
  
  // Depth is directly controlled by pen pressure
  const targetDepth = penState.pressure * MOUSE_CYLINDER_MAX_HEIGHT;
  
  // Smoothly interpolate XZ position
  penState.position.lerp(penState.targetPosition, 0.3);
  
  // Cylinder stays at y=0 (top of cloth), extends downward
  penState.position.y = 0;
  
  // Update cylinder visual - use mouseCylinder mesh for both modes
  if (mouseCylinder) {
    mouseCylinder.position.copy(penState.position);
    // Scale the cylinder height based on pressure
    mouseCylinder.scale.y = Math.max(targetDepth, 0.01);
  }
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
  const sphereRadiusUniform = getSphereRadiusUniform();
  const cylinderHeightUniform = getCylinderHeightUniform();

  // Update object visibility based on interaction mode
  const useBallMode = interactionMode === 'ball';
  const useMouseMode = interactionMode === 'mouse';
  const useTabletMode = interactionMode === 'tablet';
  
  // Ball sphere visibility
  sphere.visible = useBallMode;
  
  // Mouse/tablet cylinder visibility and collision
  mouseCylinder.visible = (useMouseMode && mouseState.isPressed) || (useTabletMode && penState.isPressed);
  
  // Set collision uniforms based on active interaction
  if (useBallMode) {
    sphereUniform.value = 1;
    sphereRadiusUniform.value = SPHERE_RADIUS;
    cylinderHeightUniform.value = 0; // Sphere mode
  } else if (useMouseMode && mouseState.isPressed) {
    sphereUniform.value = 1;
    sphereRadiusUniform.value = MOUSE_CYLINDER_RADIUS;
    cylinderHeightUniform.value = mouseState.depth; // Cylinder extends downward
    // Position is the TOP of the cylinder (at cloth surface level)
    spherePositionUniform.value.copy(mouseState.position);
    spherePositionUniform.value.y = 0; // Top of cylinder at y=0
  } else if (useTabletMode && penState.isPressed) {
    sphereUniform.value = 1;
    sphereRadiusUniform.value = MOUSE_CYLINDER_RADIUS;
    // Cylinder height based on pen pressure
    const penDepth = penState.pressure * MOUSE_CYLINDER_MAX_HEIGHT;
    cylinderHeightUniform.value = penDepth;
    // Position is the TOP of the cylinder
    spherePositionUniform.value.copy(penState.position);
    spherePositionUniform.value.y = 0;
  } else {
    sphereUniform.value = 0;
    cylinderHeightUniform.value = 0;
  }
  
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

    // Update sphere position for collision based on interaction mode
    if (interactionMode === 'ball') {
      updateSphere(timestamp, spherePositionUniform);
    } else if (interactionMode === 'mouse') {
      updateMouseCylinder();
    } else if (interactionMode === 'tablet') {
      updatePenCylinder();
    }

    // Execute compute shaders for physics simulation
    // First calculate all spring forces, then apply them to vertices
    renderer.compute(computeSpringForces);
    renderer.compute(computeVertexForces);
  }

  // Render the scene
  renderer.render(scene, camera);

  // Update FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    currentFps = frameCount;
    frameCount = 0;
    lastFpsUpdate = now;
    const fpsDisplay = document.getElementById('fps-display');
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS: ${currentFps}`;
    }
  }
}

// Start the application
init();
