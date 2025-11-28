/**
 * @fileoverview Compute shaders for Verlet cloth simulation with thickness
 * @module compute/shaders
 *
 * This module defines the GPU compute shaders that perform the physics
 * calculations for the volume-preserving thick cloth simulation.
 * 
 * Two main shaders are used (optimized to stay within WebGPU buffer limits):
 * 1. computeSpringForces - Calculates all spring forces (in-plane + Z-springs)
 * 2. computeVertexForces - Accumulates forces and updates vertex positions
 */

import {
  Fn,
  If,
  Return,
  instanceIndex,
  uint,
  Loop,
  float,
  select,
} from "three/tsl";
import {
  vertexPositionBuffer,
  vertexForceBuffer,
  vertexParamsBuffer,
  vertexBrokenBuffer,
  springVertexIdBuffer,
  springRestLengthBuffer,
  springStiffnessBuffer,
  springTypeBuffer,
  springForceBuffer,
  springListBuffer,
} from "../verlet/buffers.js";
import { getVertexCount, getSpringCount } from "../verlet/geometry.js";
import { SPRING_BREAK_THRESHOLD, SPRING_BREAK_ENABLED } from "../config/constants.js";

/**
 * Uniform controlling dampening/friction in the simulation
 * @type {Object|null}
 */
export let dampeningUniform = null;

/**
 * Uniform storing the sphere's current position
 * @type {Object|null}
 */
export let spherePositionUniform = null;

/**
 * Uniform controlling spring stiffness
 * @type {Object|null}
 */
export let stiffnessUniform = null;

/**
 * Uniform controlling sphere collision force multiplier
 * @type {Object|null}
 */
export let sphereUniform = null;

/**
 * Uniform controlling wind force intensity
 * @type {Object|null}
 */
export let windUniform = null;

/**
 * Uniform controlling Z-spring stiffness multiplier
 * @type {Object|null}
 */
export let zSpringStiffnessUniform = null;

/**
 * Uniform controlling in-plane spring stiffness multiplier
 * @type {Object|null}
 */
export let inPlaneStiffnessUniform = null;

/**
 * Compute shader for calculating spring forces
 * @type {Object|null}
 */
export let computeSpringForces = null;

/**
 * Compute shader for calculating vertex forces and positions
 * @type {Object|null}
 */
export let computeVertexForces = null;

/**
 * Sets the uniform values for the compute shaders
 *
 * @param {Object} uniforms - Object containing uniform values
 * @param {Object} uniforms.dampening - Dampening uniform
 * @param {Object} uniforms.spherePosition - Sphere position uniform
 * @param {Object} uniforms.stiffness - Stiffness uniform
 * @param {Object} uniforms.sphere - Sphere collision uniform
 * @param {Object} uniforms.wind - Wind force uniform
 * @param {Object} uniforms.zSpringStiffness - Z-spring stiffness multiplier
 * @param {Object} uniforms.inPlaneStiffness - In-plane spring stiffness multiplier
 */
export function setUniforms(uniforms) {
  dampeningUniform = uniforms.dampening;
  spherePositionUniform = uniforms.spherePosition;
  stiffnessUniform = uniforms.stiffness;
  sphereUniform = uniforms.sphere;
  windUniform = uniforms.wind;
  zSpringStiffnessUniform = uniforms.zSpringStiffness;
  inPlaneStiffnessUniform = uniforms.inPlaneStiffness;
}

/**
 * Sets up the compute shaders for the Verlet simulation
 *
 * Creates two compute shaders that run on the GPU:
 *
 * 1. computeSpringForces:
 *    - Runs once per spring (both in-plane and Z-springs combined)
 *    - Each spring has its own stiffness value stored in springStiffnessBuffer
 *    - Calculates force using Hooke's law: F = k * (distance - restLength)
 *
 * 2. computeVertexForces:
 *    - Accumulates all spring forces, gravity, and collision
 *    - Updates vertex positions using Verlet integration
 *
 * @param {number} sphereRadius - Radius of the collision sphere
 * @throws {Error} If shaders cannot be compiled
 */
export function setupComputeShaders(sphereRadius) {
  const vertexCount = getVertexCount();
  const springCount = getSpringCount();

  // ========================================================================
  // 1. Spring Forces Compute Shader (handles all springs: in-plane + Z-springs)
  // ========================================================================
  computeSpringForces = Fn(() => {
    If(instanceIndex.greaterThanEqual(uint(springCount)), () => {
      Return();
    });

    const vertexIds = springVertexIdBuffer.element(instanceIndex);
    const restLength = springRestLengthBuffer.element(instanceIndex);
    const baseStiffness = springStiffnessBuffer.element(instanceIndex).toVar();
    const springType = springTypeBuffer.element(instanceIndex); // 0 = in-plane, 1 = Z-spring

    // Apply stiffness multiplier based on spring type
    // springType == 1 means Z-spring, use zSpringStiffnessUniform
    // springType == 0 means in-plane spring, use inPlaneStiffnessUniform
    const stiffnessMultiplier = select(
      springType.equal(uint(1)),
      zSpringStiffnessUniform,
      inPlaneStiffnessUniform
    );
    const stiffness = baseStiffness.mul(stiffnessMultiplier).toVar();

    const vertex0Position = vertexPositionBuffer.element(vertexIds.x);
    const vertex1Position = vertexPositionBuffer.element(vertexIds.y);

    const delta = vertex1Position.sub(vertex0Position).toVar();
    const dist = delta.length().max(0.000001).toVar();

    // Check if spring should break (applies to ALL springs: in-plane and Z-springs)
    // Spring breaks when stretched beyond SPRING_BREAK_THRESHOLD times its rest length
    // Breaking is only enabled if SPRING_BREAK_ENABLED is true
    const stretchRatio = dist.div(restLength);
    If(stretchRatio.greaterThan(float(SPRING_BREAK_ENABLED ? SPRING_BREAK_THRESHOLD : 999999)), () => {
      // Mark spring as permanently broken by setting stiffness to 0
      springStiffnessBuffer.element(instanceIndex).assign(0.0);
      stiffness.assign(0.0);
      
      // Mark both connected vertices as having broken springs
      // This is used by the cloth shader to hide torn areas
      vertexBrokenBuffer.element(vertexIds.x).assign(uint(1));
      vertexBrokenBuffer.element(vertexIds.y).assign(uint(1));
    });

    // Hooke's law: F = k * (x - x0) * direction
    // Each spring uses its own stiffness (in-plane vs Z-spring)
    const force = dist
      .sub(restLength)
      .mul(stiffness)
      .mul(delta)
      .mul(0.5)
      .div(dist);

    springForceBuffer.element(instanceIndex).assign(force);
  })()
    .compute(Math.max(springCount, 1))
    .setName("Spring Forces");

  // ========================================================================
  // 2. Vertex Forces Compute Shader
  // ========================================================================
  // Accumulates forces from all springs and updates vertex positions
  computeVertexForces = Fn(() => {
    If(instanceIndex.greaterThanEqual(uint(vertexCount)), () => {
      Return();
    });

    // Get vertex parameters (uvec3: isFixed, springCount, springPointer)
    const params = vertexParamsBuffer.element(instanceIndex).toVar();
    const isFixed = params.x;
    const numSprings = params.y;
    const springPointer = params.z;

    // Skip force calculation if the vertex is immovable
    If(isFixed, () => {
      Return();
    });

    const position = vertexPositionBuffer
      .element(instanceIndex)
      .toVar("vertexPosition");
    const force = vertexForceBuffer.element(instanceIndex).toVar("vertexForce");

    // Apply dampening
    force.mulAssign(dampeningUniform);

    // Accumulate all spring forces (both in-plane and Z-springs)
    const ptrStart = springPointer.toVar("ptrStart");
    const ptrEnd = ptrStart.add(numSprings).toVar("ptrEnd");

    Loop(
      { start: ptrStart, end: ptrEnd, type: "uint", condition: "<" },
      ({ i }) => {
        const springId = springListBuffer.element(i).toVar("springId");
        const springForce = springForceBuffer.element(springId);
        const springVertexIds = springVertexIdBuffer.element(springId);

        const factor = select(
          springVertexIds.x.equal(instanceIndex),
          1.0,
          -1.0,
        );

        force.addAssign(springForce.mul(factor));
      },
    );

    // Add gravity force (reduced since cloth is under tension)
    console.log(vertexCount)
    force.y.subAssign(float(9.81).mul(float(0.024).div(float(vertexCount))));

    // Handle collision with sphere
    const deltaSphere = position.add(force).sub(spherePositionUniform);
    const dist = deltaSphere.length();

    const sphereForce = float(sphereRadius)
      .sub(dist)
      .max(0)
      .mul(deltaSphere)
      .div(dist)
      .mul(sphereUniform);

    force.addAssign(sphereForce);

    // Update the force buffer and apply force to position (Verlet integration)
    vertexForceBuffer.element(instanceIndex).assign(force);
    vertexPositionBuffer.element(instanceIndex).addAssign(force);
  })()
    .compute(vertexCount)
    .setName("Vertex Forces");
}
