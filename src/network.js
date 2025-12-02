export class NetworkManager {
    constructor(isBot = false) {
        this.room = new WebsimSocket();
        this.isBot = isBot;
        this.peers = {};
        this.metrics = {
            ppsIn: 0,
            ppsOut: 0,
            lastPing: 0
        };
        
        // Packet counting
        this._packetCounter = 0;
        setInterval(() => {
            this.metrics.ppsIn = this._packetCounter;
            this._packetCounter = 0;
        }, 1000);
    }

    async connect() {
        await this.room.initialize();
        
        // Subscribe to peer changes
        this.room.subscribePresence((presence) => {
            this.peers = presence;
            this._packetCounter++; // Treat presence updates as packets
        });

        // Handle custom events (like pings or game actions)
        this.room.onmessage = (event) => {
            const data = event.data;
            this._packetCounter++;
            
            if (data.type === 'ping') {
                // Respond to ping if we are the target
                if (data.targetId === this.room.clientId) {
                    this.room.send({ type: 'pong', senderId: this.room.clientId, timestamp: data.timestamp });
                }
            } else if (data.type === 'pong') {
                if (data.senderId === this.room.clientId) { // Wait, logic: I sent ping, I get pong
                    // Actually pong logic usually is handling response
                }
            }
        };

        console.log("Network Initialized. ID:", this.room.clientId);
    }

    // Broadcast my player state
    sendUpdate(state) {
        // State: { x, y, z, r (rotation), s (state/anim) }
        // We use short keys to minimize bandwidth
        this.room.updatePresence(state);
        this.metrics.ppsOut++;
    }

    getPeers() {
        return this.peers;
    }

    getMyId() {
        return this.room.clientId;
    }
}