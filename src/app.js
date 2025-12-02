import { NetworkManager } from './network.js';
import { World } from './world.js';
import { BotClient } from './bot.js';
import { UIManager } from './ui.js';

// Configuration
const CONFIG = {
    updateRate: 100, // Send updates every 100ms (10Hz)
};

class App {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.mode = this.params.get('mode') || 'peer'; // 'peer', 'bot', 'host' (host is just a peer with controls)
        this.isBot = this.mode === 'bot';

        // Setup external controls early to capture postMessages during load
        this.setupExternalControls();

        // If we are a bot, we connect to the room specified in params, or default
        this.network = new NetworkManager(this.isBot);

        this.init();
    }

    async init() {
        // Initialize connection
        await this.network.connect();

        document.getElementById('loading').style.display = 'none';

        this.applyMode();
    }

    applyMode() {
        // Cleanup existing instances
        if (this.world) {
            this.world.stop();
            this.world = null;
        }
        if (this.bot) {
            this.bot.stop();
            this.bot = null;
        }

        this.isBot = (this.mode === 'bot');
        this.network.isBot = this.isBot;

        if (this.isBot) {
            // --- BOT MODE ---
            console.log("Starting in Headless Bot Mode");
            if (this.ui) document.getElementById('dashboard').style.display = 'none';
            this.bot = new BotClient(this.network);
            this.bot.start();
        } else {
            // --- RENDER MODE (Host/Peer) ---
            console.log(`Starting in ${this.mode.toUpperCase()} Mode`);

            if (this.ui) {
                document.getElementById('dashboard').style.display = 'block';
                if (this.mode === 'host') this.ui.enableHostMode();
            } else {
                // Setup UI
                this.ui = new UIManager(this.network, this.mode);
            }

            // Setup World (Three.js)
            this.world = new World(document.getElementById('game-container'), this.network);
            this.world.start();

            // Broadcast Host status if started as host
            if (this.mode === 'host') {
                this.network.sendUpdate({ h: true });
            }

            // Key listener for claiming host
            if (!this._hostKeyListening) {
                window.addEventListener('keydown', (e) => {
                    if (e.key === '`' || e.key === '~') {
                        this.tryClaimHost();
                    }
                });
                this._hostKeyListening = true;
            }
        }
    }

    tryClaimHost() {
        if (this.mode === 'host' || this.isBot) return;

        const peers = this.network.getPeers();
        const myId = this.network.getMyId();
        
        // Check if any other peer is host (exclude self)
        const existingHost = Object.entries(peers).some(([id, data]) => id !== myId && data.h === true);

        if (!existingHost) {
            console.log("Switching to Host Mode");
            this.mode = 'host';
            this.ui.enableHostMode();
            this.network.sendUpdate({ h: true });
        } else {
            console.warn("Host already exists in room");
        }
    }

    setupExternalControls() {
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data.type === 'SET_MODE') {
                if (this.mode !== data.mode) {
                    console.log('Mode switch requested:', data.mode);
                    this.mode = data.mode;
                    // Apply if initialized
                    if (this.network && this.network.room && this.network.room.clientId) {
                        this.applyMode();
                    }
                }
            }
        });
    }
}

// Start application
window.app = new App();