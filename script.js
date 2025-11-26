import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CONFIG = {
    colors: {
        module: 0x0088ff,   // Blue
        class: 0xff0055,    // Red/Pink
        function: 0x00ffcc, // Cyan
        variable: 0xffff00, // Yellow
        helper: 0xaa00ff,   // Purple
        edge: 0x222222,
        particle: 0xffffff
    },
    bloom: {
        threshold: 0.1,    
        strength: 0.6,     
        radius: 0.2       
    },
    cameraSpeed: 0.05
};

let state = {
    nodes: [],
    edges: [],
    focusedNodeIndex: -1,
    particles: [],
    freeRoam: false
};

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.003);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: false }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    CONFIG.bloom.strength, 
    CONFIG.bloom.radius, 
    CONFIG.bloom.threshold
);
const outputPass = new OutputPass();
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

const ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(0, 20, 20);
scene.add(pointLight);

function createNeonGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffcc';
    ctx.beginPath();
    for(let i=0; i<=512; i+=64) {
        ctx.moveTo(i, 0); ctx.lineTo(i, 512);
        ctx.moveTo(0, i); ctx.lineTo(512, i);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    for(let i=0; i<5; i++) {
        const x = Math.floor(Math.random() * 8) * 64;
        const y = Math.floor(Math.random() * 8) * 64;
        ctx.fillRect(x + 10, y + 10, 44, 44);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const neonTexture = createNeonGridTexture();
const baseGeometryMaterial = new THREE.MeshStandardMaterial({ 
    map: neonTexture,
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.8,
});

function parseCode(code) {
    const lines = code.split('\n');
    const detectedNodes = [];
    
    detectedNodes.push({ 
        id: 0, 
        type: 'module', 
        name: 'Main', 
        line: 0, 
        snippet: 'Entry Point',
        payload: 'System Init',
        dependencies: [] 
    });

    const patterns = [
        { type: 'class', regex: /class\s+(\w+)/ },
        { type: 'function', regex: /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*\(|(\w+)\s*:\s*function)/ },
        { type: 'variable', regex: /(?:const|let|var)\s+(\w+)\s*=/ }
    ];

    lines.forEach((lineText, index) => {
        patterns.forEach(p => {
            const match = lineText.match(p.regex);
            if (match) {
                const name = match.filter(m => m !== undefined)[1];
                if (name) {
                    
                    let inferredPayload = "Void / Signal";
                    
                    if (p.type === 'variable') {
                        const parts = lineText.split('=');
                        if (parts.length > 1) {
                            const rhs = parts[1].trim().replace(';', '');
                            
                            if (!isNaN(parseFloat(rhs))) {
                                inferredPayload = `Number (${rhs})`;
                            } else if (rhs.startsWith('"') || rhs.startsWith("'") || rhs.startsWith("`")) {
                                let cleanStr = rhs.substring(0, 15);
                                if (rhs.length > 15) cleanStr += "...";
                                inferredPayload = `String (${cleanStr})`;
                            } else if (rhs === 'true' || rhs === 'false') {
                                inferredPayload = `Boolean (${rhs})`;
                            } else if (rhs.startsWith('new ')) {
                                inferredPayload = `Instance (${rhs.replace('new ', '')})`;
                            } else if (rhs.startsWith('[')) {
                                inferredPayload = `Array`;
                            } else if (rhs.startsWith('{')) {
                                inferredPayload = `Object`;
                            } else {
                                inferredPayload = `Reference`;
                            }
                        }
                    } else if (p.type === 'function') {
                        inferredPayload = "Action / Logic";
                    } else if (p.type === 'class') {
                        inferredPayload = "Class Structure";
                    }

                    detectedNodes.push({
                        id: detectedNodes.length,
                        type: p.type,
                        name: name,
                        line: index + 1,
                        snippet: lineText.trim(),
                        payload: inferredPayload,
                        dependencies: [0]
                    });
                }
            }
        });
    });

    for(let i=2; i<detectedNodes.length; i++) {
        if(Math.random() > 0.6) detectedNodes[i].dependencies.push(i-1);
    }

    return detectedNodes;
}

function generateGraph(code) {
    state.nodes.forEach(n => scene.remove(n.mesh));
    state.edges.forEach(e => scene.remove(e.line));
    state.particles.forEach(p => scene.remove(p.mesh));
    state.nodes = []; state.edges = []; state.particles = [];
    document.getElementById('node-list').innerHTML = '';

    const data = parseCode(code);
    let angle = 0;
    let currentY = 0;

    const geometries = {
        module: new THREE.TorusGeometry(3, 0.5, 16, 50),
        class: new THREE.CylinderGeometry(1, 1, 3, 6),
        function: new THREE.BoxGeometry(2, 2, 2),
        variable: new THREE.SphereGeometry(0.8, 16, 16)
    };

    data.forEach((nodeData, index) => {
        const geometry = geometries[nodeData.type] || geometries.variable;
        const color = CONFIG.colors[nodeData.type];
        const material = baseGeometryMaterial.clone();
        material.color.setHex(color);
        material.emissive.setHex(color);
        material.emissiveIntensity = 0.8;
        
        const mesh = new THREE.Mesh(geometry, material);
        if (index === 0) {
            mesh.position.set(0, 0, 0);
        } else {
            const r = 6 + (index * 0.4);
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            currentY -= 2;
            mesh.position.set(x, currentY, z);
            angle += 1.0;
        }
        mesh.userData = { ...nodeData, originalScale: mesh.scale.clone(), isExpanded: false };
        scene.add(mesh);
        state.nodes.push({ mesh, ...nodeData });

        const li = document.createElement('div');
        li.className = 'node-item';
        li.innerHTML = `${nodeData.name} <span style="color:${'#'+color.toString(16)}">${nodeData.type}</span>`;
        li.onclick = () => focusNode(index);
        document.getElementById('node-list').appendChild(li);
    });

    state.nodes.forEach((node, i) => {
        node.dependencies.forEach(depIndex => {
            if(state.nodes[depIndex]) {
                const start = state.nodes[depIndex].mesh.position;
                const end = node.mesh.position;
                const points = [start, end];
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.2 });
                const line = new THREE.Line(geo, mat);
                scene.add(line);
                state.edges.push({ line });
                state.particles.push({
                    t: Math.random(),
                    speed: 0.005 + Math.random() * 0.01,
                    start: start,
                    end: end,
                    mesh: createParticleMesh()
                });
            }
        });
    });

    focusNode(0);
}

function createParticleMesh() {
    const geo = new THREE.SphereGeometry(0.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
}

const targetCameraPos = new THREE.Vector3(0, 20, 40);
const targetLookAt = new THREE.Vector3(0, 0, 0);

function focusNode(index) {
    if(!state.nodes[index]) return;
    state.focusedNodeIndex = index;
    const node = state.nodes[index].mesh;
    const offset = new THREE.Vector3(6, 6, 12);

    targetLookAt.copy(node.position);
    targetCameraPos.copy(node.position).add(offset);

    node.userData.isExpanded = !node.userData.isExpanded;
}

const btnFreeRoam = document.getElementById('btn-freeroam');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');

btnFreeRoam.addEventListener('click', () => {
    state.freeRoam = !state.freeRoam;
    controls.enabled = state.freeRoam;

    if(state.freeRoam) {
        btnFreeRoam.textContent = "Exit Free Roam";
        leftPanel.classList.add('collapsed');
        rightPanel.classList.add('collapsed');
        controls.target.copy(targetLookAt); 
    } else {
        btnFreeRoam.textContent = "Enable Free Roam";
        leftPanel.classList.remove('collapsed');
        rightPanel.classList.remove('collapsed');
        focusNode(state.focusedNodeIndex !==-1 ? state.focusedNodeIndex : 0);
    }
});

let scrollTimeout;
window.addEventListener('wheel', (e) => {
    if(state.freeRoam) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        let next = state.focusedNodeIndex + (e.deltaY>0?1:-1);
        if(next>=0&&next<state.nodes.length) focusNode(next);
    }, 30);
});


const raycaster =  new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    tooltip.style.left = e.clientX + 15 + 'px';
    tooltip.style.top = e.clientY + 15 + 'px';
});

window.addEventListener('click', (e) => {
    if (e.target.closest('.panel') || e.target.id === 'btn-freeroam') return;
    if(state.freeRoam) return;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children);
    const nodeHit = hits.find(h => h.object.userData.id !== undefined);
    if (nodeHit) {
        const idx = state.nodes.findIndex(n => n.id === nodeHit.object.userData.id);
        focusNode(idx);
    }
});

function animate() {
    requestAnimationFrame(animate);

    if (state.freeRoam) {
        controls.update();
    } else {
        camera.position.lerp(targetCameraPos, CONFIG.cameraSpeed);
        camera.lookAt(targetLookAt);
    }

    state.particles.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) p.t = 0;
        p.mesh.position.lerpVectors(p.start, p.end, p.t);
    });

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children);
    const nodeHit = hits.find(h => h.object.userData.id !== undefined);

    if(nodeHit && !state.freeRoam) {
        document.body.style.cursor = 'pointer';
        tooltip.style.display = 'block';
        
        tooltip.innerHTML = `
            <div class="header">
                <h3>${nodeHit.object.userData.name}</h3>
                <span class="type-badge">${nodeHit.object.userData.type}</span>
            </div>
            <div class="content">
                <div class="payload-row">
                    <span class="payload-label">>> PAYLOAD TRANSMISSION</span>
                    <span class="payload-value">${nodeHit.object.userData.payload}</span>
                </div>
                <code>${nodeHit.object.userData.snippet}</code>
            </div>
        `;
        nodeHit.object.rotation.x += 0.05;
        nodeHit.object.rotation.y += 0.05;
    } else {
        document.body.style.cursor = 'default';
        tooltip.style.display = 'none';
    }

    state.nodes.forEach(n => {
        const mesh = n.mesh;
        const targetScale = mesh.userData.isExpanded ? 1.5 : 1;
        mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        mesh.rotation.z += 0.01;
    });

    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('btn-generate').onclick = () => {
    const code = document.getElementById('code-input').value;
    localStorage.setItem('neonCode', code);
    generateGraph(code);
};

document.getElementById('btn-clear').onclick = () => {
    document.getElementById('code-input').value = '';
    generateGraph('');
};

const saved = localStorage.getItem('neonCode');
const demo = `
class CyberDeck {
constructor() {
this.security = "MAX";
}
}
function hackMainframe() {
const firewall = 9000;
bypass(firewall);
}
function bypass(target) {
let success = true;
}
const ICE_BREAKER = "v2.0";
const IS_ACTIVE = true;
`;
document.getElementById('code-input').value = saved || demo.trim();
generateGraph(document.getElementById('code-input').value);

animate();