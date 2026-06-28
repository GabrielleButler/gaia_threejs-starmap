import './style.css'
import * as THREE from 'three'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

console.log("CELESTIAL NAVIGATION MAP")

// --------------------------------------------------
// HUD CONNECTION
// --------------------------------------------------

const starNameElement = document.getElementById('starName')
const starCountElement = document.getElementById('starCount')
const cameraPosElement = document.getElementById('cameraPos')

// --------------------------------------------------
// SCENE CREATION
// --------------------------------------------------

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

// --------------------------------------------------
// CAMERA CREATION
// --------------------------------------------------

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
)

camera.position.set(0, 0, 25)

// --------------------------------------------------
// RENDERER THING
// --------------------------------------------------

const renderer = new THREE.WebGLRenderer({
  antialias: true
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)

document.body.appendChild(renderer.domElement)

// --------------------------------------------------
// BLOOM & BRIGHTNESS
// --------------------------------------------------

const composer = new EffectComposer(renderer)

composer.addPass(
  new RenderPass(scene, camera)
)

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(
    window.innerWidth,
    window.innerHeight
  ),
  2.0,
  0.6,
  0.2
)

composer.addPass(bloomPass)

// --------------------------------------------------
// CONTROL INTEGRATION
// --------------------------------------------------

const keys = {}
const velocity = new THREE.Vector3()

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true
})

window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false
})

// --------------------------------------------------
// STAR DATA STORAGE
// --------------------------------------------------

const SCALE = 5

let starPoints = null
let starPositions = []
let starData = []
let selectionMarkers = []

// --------------------------------------------------
// SELECTION OF STARS
// --------------------------------------------------

const raycaster = new THREE.Raycaster()
raycaster.params.Points.threshold = 0.3

const mouse = new THREE.Vector2()

let selectedStars = []

// --------------------------------------------------
// TRIANGULATION CREATION
// --------------------------------------------------

let triangleMesh = null

// --------------------------------------------------
// COLOR LOGIC
// --------------------------------------------------

function getStarColor(bp_rp) {

  if (bp_rp == null)
    return new THREE.Color(0xffffff)

  if (bp_rp < 0)
    return new THREE.Color(0x9bbcff)

  if (bp_rp < 0.5)
    return new THREE.Color(0xffffff)

  if (bp_rp < 1.0)
    return new THREE.Color(0xfff1a8)

  if (bp_rp < 1.5)
    return new THREE.Color(0xffb066)

  return new THREE.Color(0xff6b6b)
}

// --------------------------------------------------
// TRIANGULATION UPDATE
// --------------------------------------------------

function updateTriangle() {

  if (triangleMesh) {
    scene.remove(triangleMesh)
    triangleMesh.geometry.dispose()
  }

  if (selectedStars.length < 2)
    return

  const verts = []

  function addLine(a, b) {

    const ai = a * 3
    const bi = b * 3

    verts.push(
      starPositions[ai],
      starPositions[ai + 1],
      starPositions[ai + 2]
    )

    verts.push(
      starPositions[bi],
      starPositions[bi + 1],
      starPositions[bi + 2]
    )
  }

  addLine(
    selectedStars[0],
    selectedStars[1]
  )

  if (selectedStars.length === 3) {

    addLine(
      selectedStars[1],
      selectedStars[2]
    )

    addLine(
      selectedStars[2],
      selectedStars[0]
    )
  }

  const geometry =
    new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      verts,
      3
    )
  )

  triangleMesh =
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x00ffff
      })
    )

  scene.add(triangleMesh)

}

// --------------------------------------------------
// CLICK TO SELECT
// --------------------------------------------------

window.addEventListener(
  'click',
  event => {

    if (!starPoints)
      return

    mouse.x =
      (event.clientX / window.innerWidth) * 2 - 1

    mouse.y =
      -(event.clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(
      mouse,
      camera
    )

    const hits =
      raycaster.intersectObject(
        starPoints
      )

    if (!hits.length)
      return

    const index =
      hits[0].index

    const star =
      starData[index]

    if (
      star &&
      starNameElement
    ) {

      starNameElement.innerHTML =
      `
      Gaia ID: ${star.source_id}<br>
      Mag: ${star.mag?.toFixed(2) ?? "?"}<br>
      X: ${star.x.toFixed(1)}<br>
      Y: ${star.y.toFixed(1)}<br>
      Z: ${star.z.toFixed(1)}
      `
    }

    selectedStars.push(index)

    if (selectedStars.length > 3)
      selectedStars.shift()

    console.log(
      "Selected:",
      selectedStars
    )

    updateTriangle()
    updateSelectionMarkers()
  }
)

function updateSelectionMarkers() {

  selectionMarkers.forEach(marker => {
    scene.remove(marker)
  })

  selectionMarkers = []

  selectedStars.forEach(index => {

    const i = index * 3

    const marker =
      new THREE.Mesh(

        new THREE.SphereGeometry(
          0.25,
          16,
          16
        ),

        new THREE.MeshBasicMaterial({
          color: 0x00ffff
        })
      )

    marker.position.set(
      starPositions[i],
      starPositions[i + 1],
      starPositions[i + 2]
    )

    scene.add(marker)

    selectionMarkers.push(marker)
  })
}

// --------------------------------------------------
// LOAD GAIA DATA
// --------------------------------------------------

fetch('/stars.json')
  .then(r => r.json())
  .then(data => {

    console.log(
      "Loaded stars:",
      data.stars.length
    )

    if (starCountElement) {
      starCountElement.textContent =
        `Stars: ${data.stars.length}`
    }

    const positions = []
    const colors = []

    for (const s of data.stars) {

      starData.push(s)

      const x = s.x * SCALE
      const y = s.y * SCALE
      const z = s.z * SCALE

      positions.push(
        x,
        y,
        z
      )

      starPositions.push(
        x,
        y,
        z
      )

      const c =
        getStarColor(
          s.color_index
        )

      const brightness = 1.6

      colors.push(
        Math.min(1, c.r * brightness),
        Math.min(1, c.g * brightness),
        Math.min(1, c.b * brightness)
      )
    }

    const geometry =
      new THREE.BufferGeometry()

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    )

    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        colors,
        3
      )
    )

    const material =
      new THREE.PointsMaterial({

        size: 0.09,

        sizeAttenuation: true,

        vertexColors: true,

        transparent: true,

        opacity: 1
      })

    starPoints =
      new THREE.Points(
        geometry,
        material
      )

    scene.add(starPoints)

    console.log(
      "STARFIELD READY"
    )
  })
  .catch(err => {
    console.error(err)
  })

// --------------------------------------------------
// ANIMATION
// --------------------------------------------------

function animate() {

  requestAnimationFrame(
    animate
  )

  const accel = 0.08
  const damp = 0.98

  if (keys.w)
    velocity.z -= accel

  if (keys.s)
    velocity.z += accel

  if (keys.a)
    velocity.x -= accel

  if (keys.d)
    velocity.x += accel

  if (keys.q)
    velocity.y += accel

  if (keys.e)
    velocity.y -= accel

  velocity.multiplyScalar(damp)

  camera.position.add(
    velocity
  )
  if (cameraPosElement) {

    cameraPosElement.textContent =
      `Camera:
  ${camera.position.x.toFixed(1)},
  ${camera.position.y.toFixed(1)},
  ${camera.position.z.toFixed(1)}`
  }

  composer.render()
}

animate()

// --------------------------------------------------
// RESIZE
// --------------------------------------------------

window.addEventListener(
  'resize',
  () => {

    camera.aspect =
      window.innerWidth /
      window.innerHeight

    camera.updateProjectionMatrix()

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    )

    composer.setSize(
      window.innerWidth,
      window.innerHeight
    )
  }
)