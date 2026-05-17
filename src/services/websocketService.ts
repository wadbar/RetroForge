import { io, Socket } from "socket.io-client";

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect() {
    if (this.socket) return;
    
    // Auto-connect to the same host that serves the frontend
    this.socket = io({
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log(`[Tier 1 Client] WebSocket Connected: ${this.socket?.id}`);
    });

    this.socket.on("disconnect", () => {
      console.log("[Tier 1 Client] WebSocket Disconnected.");
    });

    // Delegate generic events
    this.socket.onAny((event, ...args) => {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(cb => cb(...args));
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn(`[Tier 1 Client] Socket not connected, could not emit ${event}`);
      return;
    }
    this.socket.emit(event, data);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const wsService = new WebSocketService();
