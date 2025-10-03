const wrap = document.getElementById("canvas-wrap");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.z = 40;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

// Background Stars
function makeBackgroundStars(count = 1200) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 300 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    pos[i * 3 + 2] = Math.cos(phi) * r;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.6,
    opacity: 0.85,
    transparent: true,
    color: 0xffffff,
  });
  scene.add(new THREE.Points(geom, mat));
}
makeBackgroundStars(1500);

// Galaxy Sphere -> Stars
const PARTICLE_COUNT = 6000;
const sphereRadius = 14;

const positions = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);

function randColor() {
  return [Math.random(), Math.random(), Math.random()];
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = sphereRadius * (0.85 + Math.random() * 0.35);

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);

  positions[i * 3] = basePositions[i * 3] = x;
  positions[i * 3 + 1] = basePositions[i * 3 + 1] = y;
  positions[i * 3 + 2] = basePositions[i * 3 + 2] = z;

  const col = randColor();
  colors[i * 3] = col[0];
  colors[i * 3 + 1] = col[1];
  colors[i * 3 + 2] = col[2];

  sizes[i] = 0.15 + Math.random() * 0.5;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexColors: true,
  uniforms: {
    pointTexture: {
      value: new THREE.TextureLoader().load(
        "https://threejs.org/examples/textures/sprites/disc.png"
      ),
    },
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    void main(){
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D pointTexture;
    varying vec3 vColor;
    void main(){
      gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
      if(gl_FragColor.a < 0.1) discard;
    }
  `,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

const velocities = new Float32Array(PARTICLE_COUNT * 3);
let exploded = false;

function startExplosion() {
  if (exploded) return;
  exploded = true;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ix = basePositions[i * 3];
    const iy = basePositions[i * 3 + 1];
    const iz = basePositions[i * 3 + 2];
    const len = Math.sqrt(ix * ix + iy * iy + iz * iz) || 1;
    const nx = ix / len;
    const ny = iy / len;
    const nz = iz / len;
    const speed = 6 + Math.random() * 20;
    velocities[i * 3] = nx * speed;
    velocities[i * 3 + 1] = ny * speed;
    velocities[i * 3 + 2] = nz * speed;
  }
}

function resetGalaxy() {
  exploded = false;
  const posAttr = geometry.getAttribute("position");
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    posAttr.array[i * 3] = basePositions[i * 3];
    posAttr.array[i * 3 + 1] = basePositions[i * 3 + 1];
    posAttr.array[i * 3 + 2] = basePositions[i * 3 + 2];
  }
  posAttr.needsUpdate = true;
}

let mouseX = 0,
  mouseY = 0,
  targetRotX = 0,
  targetRotY = 0;

window.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("wheel", () => startExplosion(), { passive: true });
renderer.domElement.addEventListener("click", () => resetGalaxy());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  targetRotY += (mouseX * 0.6 - targetRotY) * 0.08;
  targetRotX += (mouseY * 0.3 - targetRotX) * 0.08;
  particles.rotation.y = targetRotY;
  particles.rotation.x = targetRotX;

  const posAttr = geometry.getAttribute("position");
  if (exploded) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      posAttr.array[idx] += velocities[idx] * 0.01;
      posAttr.array[idx + 1] += velocities[idx + 1] * 0.01;
      posAttr.array[idx + 2] += velocities[idx + 2] * 0.01;
    }
    posAttr.needsUpdate = true;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
// --- Existing code above as it is ---

function handleScroll() {
  if (window.scrollY > 50 && !exploded) {
    startExplosion();
  } else if (window.scrollY <= 50 && exploded) {
    resetGalaxy();
  }
}

window.addEventListener("scroll", handleScroll, { passive: true });

// --- Rest of animate() etc. remains same ---
// Mobile menu toggle

/* Custom cursor (inner dot + outer ring)
   Adds elements automatically and handles hover states, click, and touch.
   Ayesha — paste this into script.js after your other code (or in its own file).
*/

(function () {
  // don't create custom cursor on touch devices (better for performance & UX)
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  if (isTouch) return; // mobile: keep native cursor

  // create elements
  const dot = document.createElement('div');
  dot.className = 'custom-cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'custom-cursor-ring';

  document.body.appendChild(dot);
  document.body.appendChild(ring);

  // state
  let mx = window.innerWidth / 2, my = window.innerHeight / 2; // mouse target
  let rx = mx, ry = my; // rendered (lerp)
  const lerp = (a, b, n) => (1 - n) * a + n * b;

  // update loop
  function rafLoop() {
    rx = lerp(rx, mx, 0.16);
    ry = lerp(ry, my, 0.16);

    // apply transform
    dot.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;

    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);

  // mouse move
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    // ensure visible if it was hidden
    dot.classList.remove('custom-cursor-hidden');
    ring.classList.remove('custom-cursor-hidden');
  });

  // click feedback
  window.addEventListener('mousedown', () => {
    dot.classList.add('custom-cursor-click');
    ring.style.opacity = 0.9;
  });
  window.addEventListener('mouseup', () => {
    dot.classList.remove('custom-cursor-click');
    ring.style.opacity = 0.95;
  });

  // Hide when leaving window
  window.addEventListener('mouseleave', () => {
    dot.classList.add('custom-cursor-hidden');
    ring.classList.add('custom-cursor-hidden');
  });
  window.addEventListener('mouseenter', () => {
    dot.classList.remove('custom-cursor-hidden');
    ring.classList.remove('custom-cursor-hidden');
  });

  // Hover interactions — expand ring over interactive items
  const hoverSelector = 'a, button, input[type="button"], .hire-btn, .btn, .project-card, [data-cursor]';
  let hoverElements = Array.from(document.querySelectorAll(hoverSelector));

  // if new interactive nodes are added later, watch for them
  const observer = new MutationObserver(() => {
    hoverElements = Array.from(document.querySelectorAll(hoverSelector));
    attachHoverEvents(); // reattach
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function attachHoverEvents() {
    // first remove old handlers to avoid duplicates
    hoverElements.forEach(el => {
      el.onmouseenter = null;
      el.onmouseleave = null;
    });

    hoverElements.forEach(el => {
      el.onmouseenter = () => {
        // add hover class on body so CSS expands ring
        document.documentElement.classList.add('custom-cursor-hover');
        // optional: make inner dot a bit smaller
        dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%) scale(0.9)`;
      };
      el.onmouseleave = () => {
        document.documentElement.classList.remove('custom-cursor-hover');
        dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%) scale(1)`;
      };
    });
  }
  attachHoverEvents();

  // Accessibility: show system cursor when focusing inputs by keyboard
  const inputs = document.querySelectorAll('input, textarea, select, button, a');
  inputs.forEach(el => {
    el.addEventListener('focus', () => {
      dot.classList.add('custom-cursor-hidden');
      ring.classList.add('custom-cursor-hidden');
    });
    el.addEventListener('blur', () => {
      dot.classList.remove('custom-cursor-hidden');
      ring.classList.remove('custom-cursor-hidden');
    });
  });

  // Optional: allow disabling cursor via data attribute on body
  if (document.body.dataset.disableCustomCursor === "true") {
    dot.remove();
    ring.remove();
  }

})();
// Magic underline for navbar
const nav = document.querySelector(".nav");
const navLine = document.querySelector(".nav-line");
const navLinks = document.querySelectorAll(".nav a:not(.hire-btn)");

// Function to move line under hovered link
function moveLine(e) {
  const linkRect = e.target.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();
  navLine.style.width = `${linkRect.width}px`;
  navLine.style.left = `${linkRect.left - navRect.left}px`;
}

// Reset line when mouse leaves
function resetLine() {
  navLine.style.width = 0;
}

navLinks.forEach(link => {
  link.addEventListener("mouseenter", moveLine);
  link.addEventListener("mouseleave", resetLine);
});
// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener("click", () => {
  navMenu.classList.toggle("show");
});
// Slide-up on scroll or load
const slideElements = document.querySelectorAll('.slide-up');

function showSlide() {
  slideElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 50) {
      el.classList.add('show');
    }
  });
}

window.addEventListener('scroll', showSlide);
window.addEventListener('load', showSlide);



// Scroll animation trigger
const scrollElements = document.querySelectorAll(".scroll-left");

const elementInView = (el, dividend = 1.25) => {
  const elementTop = el.getBoundingClientRect().top;
  return (
    elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend
  );
};

const displayScrollElement = (element) => {
  element.classList.add("show");
};

const hideScrollElement = (element) => {
  element.classList.remove("show");
};

const handleScrollAnimation = () => {
  scrollElements.forEach((el) => {
    if (elementInView(el, 1.25)) {
      displayScrollElement(el);
    } else {
      hideScrollElement(el);
    }
  });
};

window.addEventListener("scroll", () => {
  handleScrollAnimation();
});
const cards = document.querySelectorAll(".project-card");

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.animationPlayState = "running";
    }
  });
}, { threshold: 0.2 });

cards.forEach(card => {
  observer.observe(card);
});

document.getElementById("contactForm").addEventListener("submit", function(event){
  event.preventDefault();

  let name = document.getElementById("name").value;
  let email = document.getElementById("email").value;
  let subject = document.getElementById("subject").value;
  let message = document.getElementById("message").value;

  // Apna WhatsApp Number Yahan Dalo (country code ke sath)
  let phoneNumber = "+923298102474"; 

  let whatsappURL = `https://wa.me/${phoneNumber}?text=
  *Name:* ${name}%0a
  *Email:* ${email}%0a
  *Subject:* ${subject}%0a
  *Message:* ${message}`;

  window.open(whatsappURL, "_blank");
});




