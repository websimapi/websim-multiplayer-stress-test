export class UIManager {
    constructor(network, mode) {
        this.network = network;
        this.dashboard = document.getElementById('dashboard');
        this.botFarm = document.getElementById('bot-farm');
        this.mode = mode;

        this.stats = {
            role: document.getElementById('stat-role'),
            peers: document.getElementById('stat-peers'),
            ppsIn: document.getElementById('stat-pps-in'),
            ppsOut: document.getElementById('stat-pps-out'),
            bots: document.getElementById('stat-bots'),
        };

        this.botIframes = [];

        this.init();
    }

    init() {
        this.dashboard.style.display = 'block';
        this.stats.role.innerText = this.mode.toUpperCase();

        if (this.mode === 'host') {
            this.setupHostControls();
        } else {
            document.getElementById('host-controls').style.display = 'none';
        }

        // Update loop
        setInterval(() => this.updateStats(), 500);
    }

    setupHostControls() {
        document.getElementById('btn-add-1').onclick = () => this.spawnBots(1);
        document.getElementById('btn-add-10').onclick = () => this.spawnBots(10);
        document.getElementById('btn-add-50').onclick = () => this.spawnBots(50);
        document.getElementById('btn-kill-all').onclick = () => this.killAllBots();
    }

    enableHostMode() {
        if (this.mode === 'host') return;
        this.mode = 'host';
        this.stats.role.innerText = 'HOST';
        document.getElementById('host-controls').style.display = 'block';
        this.setupHostControls();
    }

    spawnBots(count) {
        // Construct the URL without params to rely on postMessage switching
        const url = window.location.href.split('?')[0];

        for (let i = 0; i < count; i++) {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            
            iframe.onload = () => {
                // Force into Bot Mode via postMessage
                iframe.contentWindow.postMessage({ type: 'SET_MODE', mode: 'bot' }, '*');
                
                // Send a walk path
                this.sendBotPath(iframe);
            };

            this.botFarm.appendChild(iframe);
            this.botIframes.push(iframe);
        }
    }

    sendBotPath(iframe) {
        const path = [];
        const count = 5 + Math.floor(Math.random() * 5);
        for(let i=0; i<count; i++) {
            path.push({
                x: (Math.random() - 0.5) * 80,
                z: (Math.random() - 0.5) * 80
            });
        }
        iframe.contentWindow.postMessage({ type: 'WALK_PATH', path }, '*');
    }

    killAllBots() {
        this.botFarm.innerHTML = '';
        this.botIframes = [];
    }

    updateStats() {
        const peerCount = Object.keys(this.network.getPeers()).length;
        this.stats.peers.innerText = peerCount;
        this.stats.ppsIn.innerText = this.network.metrics.ppsIn;
        this.stats.ppsOut.innerText = this.network.metrics.ppsOut;
        this.stats.bots.innerText = this.botIframes.length;
    }
}