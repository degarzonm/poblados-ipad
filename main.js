// Importa los módulos necesarios de Three.js
import * as THREE from "three";
import { randInt } from "three/src/math/MathUtils.js";

// Crear la escena
const scene = new THREE.Scene();
const VEL_FACTOR = 0.1; // Factor de velocidad para los proyectiles
const gravity_force = 0.001;
// Crear la cámara en vista desde arriba
const main_camera = new THREE.PerspectiveCamera(
  15, // Campo de visión
  window.innerWidth / window.innerHeight, // Relación de aspecto
  0.1, // Plano de recorte cercano
  100 // Plano de recorte lejano
);

// Posicionar la cámara en el eje Y, mirando hacia el origen
main_camera.position.set(0, 100, 0);
main_camera.lookAt(0, 0, 0);

// === Añadir el botón de modo ===
// Crear el botón
const modeButton = document.createElement("button");
modeButton.innerText = "Modo: Proyectiles";
modeButton.style.position = "absolute";
modeButton.style.top = "55px";
modeButton.style.right = "10px";
modeButton.style.padding = "10px";
modeButton.style.zIndex = "1";
document.body.appendChild(modeButton);

// Variable para el modo actual: 'projectile' o 'drag'
let currentMode = "projectile";

// Manejar el clic del botón para alternar modos
modeButton.addEventListener("click", () => {
  if (currentMode === "projectile") {
    currentMode = "drag";
    modeButton.innerText = "Modo: Mapa";
  } else {
    currentMode = "projectile";
    modeButton.innerText = "Modo: Proyectiles";
  }
});

// Variables para manejar el arrastre del mapa
let isDraggingMap = false;
let previousTouchPositions = [];

// Función para mover la cámara basado en el arrastre
function moveCamera(deltaX, deltaY) {
  // Ajustar la posición de la cámara
  main_camera.position.x -= deltaX * 40; // Aumentar el factor para mayor movimiento
  main_camera.position.z += deltaY * 40; // Aumentar el factor para mayor movimiento
  main_camera.lookAt(main_camera.position.x, 0, main_camera.position.z);
  calculateBoundaries(); // Recalcular los límites después de mover la cámara
}

// === Crear el elemento 'titulo' para debug ===
// Crear el elemento
const titulo = document.createElement("div");
titulo.id = "titulo";
titulo.style.position = "absolute";
titulo.style.top = "10px";
titulo.style.left = "10px";
titulo.style.color = "white";
titulo.style.zIndex = "1";
titulo.innerText = "Posición: 0.0000, 0.0000";
document.body.appendChild(titulo);

// Crear el renderizador
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Crear la geometría del cuadrado (usaremos PlaneGeometry para 2D)
const central_square_geometry = new THREE.PlaneGeometry(1, 1);

// Crear el material Phong
const central_square_material = new THREE.MeshPhongMaterial({
  color: 0x44aa88,
});

// Crear el mesh (cuadrado)
const central_square = new THREE.Mesh(
  central_square_geometry,
  central_square_material
);
central_square.rotation.x = -Math.PI / 2; // Rotar para que esté "plano" en el suelo
scene.add(central_square);

// Crear una luz direccional que apunta al cuadrado
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 20, 20); // Posicionar la luz sobre la cámara
scene.add(directionalLight);

// Añadir una luz ambiental para suavizar las sombras
const ambientLight = new THREE.AmbientLight(0xf0f0f0); // Luz suave blanca
scene.add(ambientLight);

// Definir variables para los límites dinámicos del canvas
let window_boundary_x, window_boundary_z;

// 
function calculateBoundaries() {
  const vFOV = THREE.MathUtils.degToRad(main_camera.fov); // Convertir FOV a radianes
  const height = 2 * main_camera.position.y * Math.tan(vFOV / 2); // Altura visible
  const width = height * (window.innerWidth / window.innerHeight); // Ancho visible

  window_boundary_x = width / 2;
  window_boundary_z = height / 2;
}
// Calcular los límites inicialmente
calculateBoundaries();

// Manejar el redimensionamiento de la ventana
window.addEventListener(
  "resize",
  () => {
    // Actualizar la relación de aspecto de la cámara
    main_camera.aspect = window.innerWidth / window.innerHeight;
    main_camera.updateProjectionMatrix();

    // Actualizar el tamaño del renderizador
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Recalcular los límites
    calculateBoundaries();
  },
  false
);

// Función para convertir coordenadas de pantalla a coordenadas de Three.js
function getTouchPosition(touch) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
  return new THREE.Vector2(x, y);
}

// Crear un rayo para detectar intersecciones
const raycaster = new THREE.Raycaster();

// Array para almacenar los proyectiles
const projectiles = [];

// Configurar el contexto de audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Función para reproducir un sonido simple
function playSound(frequency, duration) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime); // Frecuencia del tono
  gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Volumen bajo

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

// Variables para manejar el cambio de color de fondo
let backgroundColor = new THREE.Color(0x000000); // Inicialmente negro
let colorTransitionStart = null;
const colorTransitionDuration = 1000; // 1 segundo

// Map para almacenar toques activos
const activeTouches = new Map();

// Material para las líneas de arrastre
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

// Función para crear una línea de arrastre
function createDragLine(start, end) {
  const points = [];
  points.push(start);
  points.push(end);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, lineMaterial);
  scene.add(line);
  return line;
}

// Función para actualizar una línea de arrastre
function updateDragLine(line, start, end) {
  const points = [];
  points.push(start);
  points.push(end);
  line.geometry.setFromPoints(points);
}

// Función para manejar el evento de touchstart
function onTouchStart(event) {
  event.preventDefault(); // Previene comportamientos predeterminados

  if (currentMode === "drag") {
    if (event.touches.length === 2) {
      isDraggingMap = true;
      previousTouchPositions = [
        getTouchPosition(event.touches[0]),
        getTouchPosition(event.touches[1]),
      ];
      return;
    }
    return;
  }

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    const touchPos = getTouchPosition(touch);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(touchPos, main_camera);

    // Detectar intersecciones con el cuadrado
    const intersects = ray.intersectObject(central_square);

    if (intersects.length > 0) {
      // Ha detectado colisión con el cuadrado
      // Cambiar el color del cuadrado aleatoriamente
      central_square.material.color.setHex(Math.random() * 0xffffff);
      // Reproducir sonido de cambio de color
      playSound(440, 0.1); // A4 note, 0.1 segundos
    } else {
      // No ha detectado colisión, iniciar arrastre para proyectil
      // Obtener el punto de intersección con el plano (y=0)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      ray.ray.intersectPlane(plane, intersectPoint);

      // Crear una línea de arrastre inicial
      const line = createDragLine(intersectPoint, intersectPoint);

      // Guardar el estado del toque
      activeTouches.set(touch.identifier, {
        startPos: intersectPoint.clone(),
        currentPos: intersectPoint.clone(),
        line: line,
      });
    }
  }
}

// Función para manejar el evento de touchmove
function onTouchMove(event) {
  event.preventDefault(); // Previene comportamientos predeterminados
  if (currentMode === "drag") {
    if (isDraggingMap && event.touches.length === 2) {
      const newTouchPositions = [
        getTouchPosition(event.touches[0]),
        getTouchPosition(event.touches[1]),
      ];
      // Actualizar el elemento 'titulo' con las nuevas posiciones
      titulo.innerText = `Posición: ${newTouchPositions[0].x.toFixed(
        4
      )}, ${newTouchPositions[0].y.toFixed(4)}`;

      const deltaX =
        (newTouchPositions[0].x + newTouchPositions[1].x) / 2 -
        (previousTouchPositions[0].x + previousTouchPositions[1].x) / 2;
      const deltaY =
        (newTouchPositions[0].y + newTouchPositions[1].y) / 2 -
        (previousTouchPositions[0].y + previousTouchPositions[1].y) / 2;

      moveCamera(deltaX, deltaY);

      previousTouchPositions = newTouchPositions;
      return;
    }
    return;
  }

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    const touchState = activeTouches.get(touch.identifier);
    if (touchState) {
      const touchPos = getTouchPosition(touch);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(touchPos, main_camera);

      // Obtener el punto de intersección con el plano (y=0)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPoint = new THREE.Vector3();
      ray.ray.intersectPlane(plane, intersectPoint);

      // Actualizar la posición actual y la línea de arrastre
      touchState.currentPos.copy(intersectPoint);
      updateDragLine(
        touchState.line,
        touchState.startPos,
        touchState.currentPos
      );
    }
  }
}

// Función para manejar el evento de touchend
function onTouchEnd(event) {
  event.preventDefault(); // Previene comportamientos predeterminados

  if (currentMode === "drag" && event.touches.length < 2) {
    isDraggingMap = false;
    previousTouchPositions = [];
    return;
  }

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    const touchState = activeTouches.get(touch.identifier);
    if (touchState) {
      const start = touchState.startPos;
      const end = touchState.currentPos;
      const swipe = new THREE.Vector3().subVectors(end, start);
      const swipeLength = swipe.length();

      // Calcular la dirección hacia el toque inicial
      const direction = new THREE.Vector3().subVectors(start, end).normalize();
      const speed = swipeLength * VEL_FACTOR; // Factor de velocidad

      // Determinar el color del proyectil basado en el número de toques simultáneos
      let projectileColor = 0xff0000; // Rojo por defecto
      if (activeTouches.size >= 2) {
        projectileColor = 0x00ff00; // Verde
      }
      if (activeTouches.size >= 3) {
        projectileColor = 0x0000ff; // Azul
      }
      if (activeTouches.size >= 4) {
        projectileColor = 0xffffff; // Blanco
      }

      // Crear un proyectil en la posición final del arrastre
      const projectileGeometry = new THREE.SphereGeometry(0.2, 16, 16);
      const projectileMaterial = new THREE.MeshBasicMaterial({
        color: projectileColor,
      });
      const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
      projectile.position.copy(end); // Posición final del toque
      scene.add(projectile);

      // Reproducir sonido de creación de proyectil
      playSound(randInt(500, 800), 0.03); // Sonido aleatorio, 0.03 segundos

      // Añadir el proyectil y su velocidad al array
      projectiles.push({
        mesh: projectile,
        velocity: direction.multiplyScalar(speed),
      });

      // Remover la línea de arrastre y el estado del toque
      scene.remove(touchState.line);
      activeTouches.delete(touch.identifier);
    }
  }
}

// Añadir los listeners para touchstart, touchmove y touchend
renderer.domElement.addEventListener("touchstart", onTouchStart, false);
renderer.domElement.addEventListener("touchmove", onTouchMove, false);
renderer.domElement.addEventListener("touchend", onTouchEnd, false);

// Función de animación
function animate(timestamp) {
  requestAnimationFrame(animate);

  // Actualizar la posición de cada proyectil
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    // Aplicar gravedad hacia el centro

    const toCenter = new THREE.Vector3()
      .subVectors(new THREE.Vector3(0, 0, 0), proj.mesh.position)
      .normalize();
    proj.velocity.addScaledVector(toCenter, gravity_force);

    // Mover el proyectil
    proj.mesh.position.add(proj.velocity);

    // Rebotar si el proyectil alcanza un borde dinámico, pausado mientras se implementa el arrastre del mapa
    /*if (proj.mesh.position.x > window_boundary_x || proj.mesh.position.x < -window_boundary_x) {
        proj.velocity.x *= -1;
        proj.mesh.position.x = THREE.MathUtils.clamp(proj.mesh.position.x, -window_boundary_x, window_boundary_x);
      }
      if (proj.mesh.position.z > window_boundary_z || proj.mesh.position.z < -window_boundary_z) {
        proj.velocity.z *= -1;
        proj.mesh.position.z = THREE.MathUtils.clamp(proj.mesh.position.z, -window_boundary_z, window_boundary_z);
      }*/

    // Calcular la distancia al centro
    const distance = proj.mesh.position.length();

    if (distance < 1) {
      // Umbral para desaparecer
      // Remover el proyectil de la escena
      scene.remove(proj.mesh);
      projectiles.splice(i, 1);

      // Cambiar el color del cuadrado
      central_square.material.color.setHex(Math.random() * 0xffffff);

      // Reproducir sonido de desaparición de proyectil
      playSound(220, 0.1); // A3 note, 0.1 segundos

      // Cambiar el color de fondo a gris suave
      backgroundColor.setHex(0x555555);
      colorTransitionStart = timestamp;
    }
  }

  // Manejar la transición de color de fondo
  if (colorTransitionStart !== null) {
    const elapsed = timestamp - colorTransitionStart;
    if (elapsed < colorTransitionDuration) {
      // Interpolar entre el color actual y negro
      const t = elapsed / colorTransitionDuration;
      backgroundColor.lerp(new THREE.Color(0x000000), t);
      scene.background = backgroundColor;
    } else {
      // Finalizar la transición
      backgroundColor.set(0x000000);
      scene.background = backgroundColor;
      colorTransitionStart = null;
    }
  }

  // Renderizar la escena
  renderer.render(scene, main_camera);
}

// Iniciar la animación
animate();
