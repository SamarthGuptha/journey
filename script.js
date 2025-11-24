import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CONFIG = {
    colors: {
        module: 0x0088ff,//blue
        class: 0xff0055,//red-pink
        function: 0x00ffcc,//cyan
        variable: 0xffff00,//yellow
        helper: 0xaa00ff,//purple
        edge: 0x222222,
        particle: 0xffffff
    },
    bloom: {
        threshold: 0.1,
        strength: 0.6,
        radius: 0.2
    },
    cameraSpeed: 0.04
};

let state = {
    nodes: [],
    edges: [],
    focusedNodeIndex: -1,
    particles: [],
    freeRoam: false
};

//scene!!

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.003);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
container.appendChild(renderer.domElement);

//freeroam-ctrls
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
    canvas.width=512;
    canvas.height=512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffcc';
    ctx.beginPath();
    for(let i=0; i<512;i+=64) {
        ctx.moveTo(i, 0); ctx.lineTo(i, 512);
        ctx.moveTo(0, i); ctx.lineTo(512, i);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    for(let i=0; i<5; i++) {
        const x=Math.floor(Math.random()*8)*64;
        const y=Math.floor(Math.random()*8)*64;
        ctx.fillRect(x+10, y+10, 44, 44);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}



