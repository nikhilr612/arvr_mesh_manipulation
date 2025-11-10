/**
 * @fileoverview Compute shaders for Verlet cloth simulation
 * @module compute/shaders
 *
 * This module defines the GPU compute shaders that perform the physics
 * calculations for the Verlet cloth simulation. Two main shaders are used:
 * 1. computeSpringForces - Calculates forces for each spring
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
  triNoise3D,
  time,
} from "three/tsl";
import {
  vertexPositionBuffer,
  vertexForceBuffer,
  vertexParamsBuffer,
  springVertexIdBuffer,
  springRestLengthBuffer,
  springForceBuffer,
  springListBuffer,
} from "../verlet/buffers.js";
import { getVertexCount, getSpringCount } from "../verlet/geometry.js";

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
 */
export function setUniforms(uniforms) {
  dampeningUniform = uniforms.dampening;
  spherePositionUniform = uniforms.spherePosition;
  stiffnessUniform = uniforms.stiffness;
  sphereUniform = uniforms.sphere;
  windUniform = uniforms.wind;
}

/**
 * Sets up the compute shaders for the Verlet simulation
 *
 * Creates two compute shaders that run on the GPU:
 *
 * 1. computeSpringForces:
 *    - Runs once per spring
 *    - Calculates the force for each spring based on its current length
 *      versus its rest length
 *    - Applies Hooke's law: F = k * (distance - restLength)
 *    - Stores the force in springForceBuffer
 *
 * 2. computeVertexForces:
 *    - Runs once per vertex
 *    - Accumulates all forces acting on the vertex:
 *      * Spring forces from connected springs
 *      * Gravity force
 *      * Wind force (using 3D noise for variation)
 *      * Sphere collision force
 *    - Applies dampening to simulate friction
 *    - Updates vertex position based on accumulated forces
 *    - Skips fixed vertices (anchor points)
 *
 * @param {number} sphereRadius - Radius of the collision sphere
 * @throws {Error} If shaders cannot be compiled
 */
export function setupComputeShaders(sphereRadius) {
  const vertexCount = getVertexCount();
  const springCount = getSpringCount();

  // ========================================================================
  // 1. Spring Forces Compute Shader
  // ========================================================================
  // This shader computes a force for each spring, depending on the distance
  // between the two vertices connected by that spring and the targeted rest length
  computeSpringForces = Fn(() => {
    // Compute shaders are executed in groups of 64, so instanceIndex might
    // be bigger than the amount of springs. In that case, return early.
    If(instanceIndex.greaterThanEqual(uint(springCount)), () => {
      Return();
    });

    // Get the two vertex IDs connected by this spring
    const vertexIds = springVertexIdBuffer.element(instanceIndex);
    // Get the target rest length for this spring
    const restLength = springRestLengthBuffer.element(instanceIndex);

    // Get current positions of both vertices
    const vertex0Position = vertexPositionBuffer.element(vertexIds.x);
    const vertex1Position = vertexPositionBuffer.element(vertexIds.y);

    // Calculate the vector between vertices and its length
    const delta = vertex1Position.sub(vertex0Position).toVar();
    const dist = delta.length().max(0.000001).toVar(); // Avoid division by zero

    // Apply Hooke's law: F = k * (x - x0) * direction
    // The force is proportional to the difference between current and rest length
    // Multiply by 0.5 because the force will be applied to both vertices
    const force = dist
      .sub(restLength)
      .mul(stiffnessUniform)
      .mul(delta)
      .mul(0.5)
      .div(dist);

    // Store the computed force
    springForceBuffer.element(instanceIndex).assign(force);
  })()
    .compute(springCount)
    .setName("Spring Forces");

  // ========================================================================
  // 2. Vertex Forces Compute Shader
  // ========================================================================
  // This shader accumulates the force for each vertex.
  // First it iterates over all springs connected to this vertex and accumulates their forces.
  // Then it adds gravitational force, wind force, and sphere collision.
  // Finally, it updates the vertex position.
  computeVertexForces = Fn(() => {
    // Compute shaders are executed in groups of 64, so instanceIndex might
    // be bigger than the amount of vertices. In that case, return early.
    If(instanceIndex.greaterThanEqual(uint(vertexCount)), () => {
      Return();
    });

    // Get vertex parameters (isFixed, springCount, springPointer)
    const params = vertexParamsBuffer.element(instanceIndex).toVar();
    const isFixed = params.x;
    const springCount = params.y;
    const springPointer = params.z;

    // Skip force calculation if the vertex is immovable (anchor point)
    If(isFixed, () => {
      Return();
    });

    // Get current position and force for this vertex
    const position = vertexPositionBuffer
      .element(instanceIndex)
      .toVar("vertexPosition");
    const force = vertexForceBuffer.element(instanceIndex).toVar("vertexForce");

    // Apply dampening to simulate friction/air resistance
    force.mulAssign(dampeningUniform);

    // Iterate over all springs connected to this vertex
    const ptrStart = springPointer.toVar("ptrStart");
    const ptrEnd = ptrStart.add(springCount).toVar("ptrEnd");

    Loop(
      { start: ptrStart, end: ptrEnd, type: "uint", condition: "<" },
      ({ i }) => {
        // Get the spring ID from the spring list
        const springId = springListBuffer.element(i).toVar("springId");
        // Get the force calculated for this spring
        const springForce = springForceBuffer.element(springId);
        // Get the vertex IDs connected by this spring
        const springVertexIds = springVertexIdBuffer.element(springId);

        // Determine if we need to apply the force positively or negatively
        // If this vertex is the first vertex of the spring, apply force as-is
        // If it's the second vertex, apply force in opposite direction
        const factor = select(
          springVertexIds.x.equal(instanceIndex),
          1.0,
          -1.0,
        );

        // Accumulate spring force
        force.addAssign(springForce.mul(factor));
      },
    );

    // Add gravity force (downward acceleration) - reduced since cloth is under tension
    force.y.subAssign(0.00001);

    // Wind force removed - sphere interaction is the primary force

    // Handle collision with sphere
    // Calculate the position after applying current force
    const deltaSphere = position.add(force).sub(spherePositionUniform);
    const dist = deltaSphere.length();

    // If the vertex would penetrate the sphere, apply a repelling force
    // The force is proportional to the penetration depth
    const sphereForce = float(sphereRadius)
      .sub(dist)
      .max(0) // Only apply force if penetrating
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
