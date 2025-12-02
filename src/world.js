import * as THREE from 'three';
import Stats from 'stats.js';
import nipplejs from 'nipplejs';

export class World {
    constructor(container, network) {
        this.container = container;
        this.network = network;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.players = {}; // Map of meshes
        this.myPlayer = null;

        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(this.stats.dom);

        // Input state
        this.inputs = { forward: 0, turn: 0 };

        // Assets
        this.geo = new THREE.CapsuleGeometry(0.5, 1.8, 4, 8);
        this.matRemote = new THREE.MeshStandardMaterial({ color: 0x00ffff });
        this.matLocal = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        this.matBot = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    }

    start() {
        this.isRunning = true;
        this.initThree();
        this.initInput();
        this.animate();

        // Start network update loop
        this.networkInterval = setInterval(() => this.networkLoop(), 50); // 20 updates per second
    }

    stop() {
        this.isRunning = false;
        if (this.networkInterval) clearInterval(this.networkInterval);
        
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }

    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.scene.fog = new THREE.Fog(0x111111, 20, 100);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Floor
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('grid.png', (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(50, 50);

            const planeGeo = new THREE.PlaneGeometry(500, 500);
            const planeMat = new THREE.MeshStandardMaterial({ 
                map: tex,
                roughness: 0.8,
                metalness: 0.2
            });
            const plane = new THREE.Mesh(planeGeo, planeMat);
            plane.rotation.x = -Math.PI / 2;
            plane.receiveShadow = true;
            this.scene.add(plane);
        });

        // My Player
        this.myPlayer = new THREE.Group();
        const mesh = new THREE.Mesh(this.geo, this.matLocal);
        mesh.castShadow = true;
        mesh.position.y = 0.9;
        this.myPlayer.add(mesh);
        this.scene.add(this.myPlayer);

        // Handle Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initInput() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'w' || e.key === 'ArrowUp') this.inputs.forward = 1;
            if (e.key === 's' || e.key === 'ArrowDown') this.inputs.forward = -1;
            if (e.key === 'a' || e.key === 'ArrowLeft') this.inputs.turn = 1;
            if (e.key === 'd' || e.key === 'ArrowRight') this.inputs.turn = -1;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'w' || e.key === 'ArrowUp') this.inputs.forward = 0;
            if (e.key === 's' || e.key === 'ArrowDown') this.inputs.forward = 0;
            if (e.key === 'a' || e.key === 'ArrowLeft') this.inputs.turn = 0;
            if (e.key === 'd' || e.key === 'ArrowRight') this.inputs.turn = 0;
        });

        // Mobile (Nipple.js)
        if ('ontouchstart' in window) {
            const manager = nipplejs.create({
                zone: document.body,
                mode: 'dynamic',
                color: 'cyan'
            });

            manager.on('move', (evt, data) => {
                const forward = data.vector.y;
                const turn = -data.vector.x;
                this.inputs.forward = forward;
                this.inputs.turn = turn;
            });

            manager.on('end', () => {
                this.inputs.forward = 0;
                this.inputs.turn = 0;
            });
        }
    }

    networkLoop() {
        if (!this.myPlayer) return;

        // Broadcast position
        this.network.sendUpdate({
            x: this.myPlayer.position.x,
            y: this.myPlayer.position.y,
            z: this.myPlayer.position.z,
            r: this.myPlayer.rotation.y
        });
    }

    updateRemotePlayers() {
        const peers = this.network.getPeers();
        const myId = this.network.getMyId();

        // 1. Update or Create existing
        for (const [id, data] of Object.entries(peers)) {
            if (id === myId) continue;
            if (!data || data.x === undefined) continue; // Not initialized or invalid

            if (!this.players[id]) {
                // Create
                const isBot = data.b;
                const mesh = new THREE.Mesh(this.geo, isBot ? this.matBot : this.matRemote);
                mesh.castShadow = true;

                // Wrapper group for offsets if needed
                const group = new THREE.Group();
                mesh.position.y = 0.9; // Center pivot
                group.add(mesh);

                this.scene.add(group);
                this.players[id] = group;
            }

            // Interpolate (Simple LERP for this stress test)
            const p = this.players[id];
            p.position.x += (data.x - p.position.x) * 0.2;
            p.position.z += (data.z - p.position.z) * 0.2;

            // Rotation LERP could be better with quaternions, but Euler is fine for simple Y axis
            // Handle angle wrapping manually if needed, but basic lerp:
            p.rotation.y = data.r || 0;
        }

        // 2. Remove disconnected
        for (const id of Object.keys(this.players)) {
            if (!peers[id]) {
                this.scene.remove(this.players[id]);
                delete this.players[id];
            }
        }
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        this.stats.begin();

        // Update Local Player
        if (this.myPlayer) {
            const speed = 10;
            const turnSpeed = 3;
            const dt = 0.016; // Fixed timestep approx

            this.myPlayer.rotation.y += this.inputs.turn * turnSpeed * dt;

            const dx = Math.sin(this.myPlayer.rotation.y) * this.inputs.forward * speed * dt;
            const dz = Math.cos(this.myPlayer.rotation.y) * this.inputs.forward * speed * dt;

            this.myPlayer.position.x += dx;
            this.myPlayer.position.z += dz;

            // Camera follow
            const camOffset = new THREE.Vector3(0, 10, 10);
            camOffset.applyAxisAngle(new THREE.Vector3(0,1,0), this.myPlayer.rotation.y);

            this.camera.position.x += (this.myPlayer.position.x + camOffset.x - this.camera.position.x) * 0.1;
            this.camera.position.z += (this.myPlayer.position.z + camOffset.z - this.camera.position.z) * 0.1;
            this.camera.lookAt(this.myPlayer.position);
        }

        // Update Remote Players
        this.updateRemotePlayers();

        this.renderer.render(this.scene, this.camera);
        this.stats.end();
    }
}