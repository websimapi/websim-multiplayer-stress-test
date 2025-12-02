export class BotClient {
    constructor(network) {
        this.network = network;
        this.running = false;

        // Bot state
        this.position = { x: (Math.random() - 0.5) * 50, z: (Math.random() - 0.5) * 50 };
        this.target = { x: 0, z: 0 };
        this.speed = 5 + Math.random() * 5; // units per sec
        this.lastUpdate = performance.now();

        this.pickNewTarget();
    }

    pickNewTarget() {
        this.target.x = (Math.random() - 0.5) * 80;
        this.target.z = (Math.random() - 0.5) * 80;
    }

    start() {
        this.running = true;
        // Use setInterval instead of RAF for more consistent background performance in iframes
        this.interval = setInterval(() => this.loop(), 33); 
    }

    stop() {
        this.running = false;
        clearInterval(this.interval);
    }

    loop() {
        if (!this.running) return;

        const now = performance.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        // Move towards target
        const dx = this.target.x - this.position.x;
        const dz = this.target.z - this.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        if (dist < 1) {
            this.pickNewTarget();
        } else {
            // Normalize and move
            const vx = (dx / dist) * this.speed * dt;
            const vz = (dz / dist) * this.speed * dt;
            this.position.x += vx;
            this.position.z += vz;
        }

        // Send Update (Throttle to ~15Hz to simulate realistic server tick)
        // We don't want to flood the socket every single JS frame
        if (Math.random() < 0.25) { 
            this.network.sendUpdate({
                x: this.position.x,
                y: 0, // Flat terrain
                z: this.position.z,
                r: Math.atan2(dx, dz), // Rotation
                b: true // "Bot" flag
            });
        }
    }
}