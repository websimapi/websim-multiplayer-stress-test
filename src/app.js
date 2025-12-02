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

        // If we are a bot, we connect to the room specified in params, or default
        this.network = new NetworkManager(this.isBot);

        this.init();
    }

    async init() {
        // Initialize connection
        await this.network.connect();

        document.getElementById('loading').style.display = 'none';

        if (this.isBot) {
            // --- BOT MODE ---
            console.log("Starting in Headless Bot Mode");
            this.bot = new BotClient(this.network);
            this.bot.start();
        } else {
            // --- RENDER MODE (Host/Peer) ---
            console.log(`Starting in ${this.mode.toUpperCase()} Mode`);

            // Setup UI
            this.ui = new UIManager(this.network, this.mode);

            // Setup World (Three.js)
            this.world = new World(document.getElementById('game-container'), this.network);
            this.world.start();

            // Broadcast Host status if started as host
            if (this.mode === 'host') {
                this.network.sendUpdate({ h: true });
            }

            // Setup Input / PostMessage handling
            this.setupExternalControls();

            // Key listener for claiming host
            window.addEventListener('keydown', (e) => {
                if (e.key === '`' || e.key === '~') {
                    this.tryClaimHost();
                }
            });
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
                // Logic to switch modes dynamically if needed
                console.log('Mode switch requested', data.mode);
            }
        });
    }
}

// Start application
window.app = new App();