// Provide a safe fallback if WebsimSocket is not available in this environment
const WebsimSocketClass = (typeof WebsimSocket !== 'undefined')
  ? WebsimSocket
  : (typeof window !== 'undefined' && window.parent && window.parent.WebsimSocket)
    ? window.parent.WebsimSocket
    : null;

// Lightweight local stub so the app doesn't crash if the real socket isn't present
class LocalSocketStub {
    constructor() {
        this.clientId = `local-${Math.random().toString(36).slice(2)}`;
        this.presence = {};
        this.roomState = {};
        this.peers = {};
        this._presenceSubs = [];
        this._roomSubs = [];
        this.onmessage = () => {};
    }

    async initialize() {
        // Immediately register this client as a "peer"
        this.peers[this.clientId] = {
            username: 'local-user',
            avatarUrl: ''
        };
        this.presence[this.clientId] = {};
        this._emitPresence();
    }

    updatePresence(presence) {
        this.presence[this.clientId] = {
            ...(this.presence[this.clientId] || {}),
            ...presence
        };
        this._emitPresence();
    }

    updateRoomState(roomState) {
        this.roomState = { ...this.roomState, ...roomState };
        this._emitRoomState();
    }

    requestPresenceUpdate() {
        // No-op in stub
    }

    subscribePresence(cb) {
        this._presenceSubs.push(cb);
        cb(this.presence);
        return () => {
            this._presenceSubs = this._presenceSubs.filter(fn => fn !== cb);
        };
    }

    subscribeRoomState(cb) {
        this._roomSubs.push(cb);
        cb(this.roomState);
        return () => {
            this._roomSubs = this._roomSubs.filter(fn => fn !== cb);
        };
    }

    subscribePresenceUpdateRequests() {
        // No-op in stub
        return () => {};
    }

    send() {
        // No-op in stub
    }

    _emitPresence() {
        this._presenceSubs.forEach(fn => fn(this.presence));
    }

    _emitRoomState() {
        this._roomSubs.forEach(fn => fn(this.roomState));
    }
}

export class NetworkManager {
    constructor(isBot = false) {
        // Use real WebsimSocket when available, otherwise fall back to stub
        const Socket = WebsimSocketClass || LocalSocketStub;

        this.room = new Socket();
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
            const data = event.data || event; // Stub may call directly with data
            this._packetCounter++;
            
            if (data.type === 'ping') {
                // Respond to ping if we are the target
                if (data.targetId === this.room.clientId) {
                    this.room.send({ type: 'pong', senderId: this.room.clientId, timestamp: data.timestamp });
                }
            } else if (data.type === 'pong') {
                // Pong handling placeholder
            }
        };

        console.log(
            WebsimSocketClass
                ? "Network Initialized with WebsimSocket. ID:"
                : "Network Initialized with LocalSocketStub (no realtime backend). ID:",
            this.room.clientId
        );
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