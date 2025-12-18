import type { Socket } from "socket.io";

/**
 * Channels are tied to/identified by a client (device), the user and a type.
 * Each channel variation can only exist once.
 */
export interface Channel {
    /**
     * Unique channel ID. Equals the socket id.
     */
    id: string;
    userId: string;
    /**
     * Obtained from te client id cookie.
     */
    clientId: string;
    spaceId?: string;
    socket: Socket;
}

/**
 * `clientId` refers to the unique client id - Usually obtained from a cookie.
 *
 * Channels are tied to a client (device) and the user.
 * */
export class ChannelsManager {
    private channels: Map<string, Channel[]> = new Map();

    /**
     * Removes all sockets.
     */
    clear() {
        this.channels.clear();
    }

    /**
     * Removes all sockets of a user for all clients.
     */
    clearUser(userId: string) {
        this.channels.delete(userId);
    }

    /**
     * Adds a channel to the manager.
     */
    addChannel(channel: Channel) {
        const userSockets = this.channels.get(channel.userId) ?? [];
        userSockets.push(channel);
        this.channels.set(channel.userId, userSockets);
    }

    private tryDisconnectChannel(channel: Channel) {
        if (channel.socket.disconnected) {
            return;
        }
        try {
            channel.socket.disconnect();
        } catch (err) {}
    }

    /**
     * Removes a specific channel of a user.
     *
     * Channels are disconnected.
     */
    removeChannel(userId: string, channelId: string) {
        const userSockets = this.channels.get(userId) ?? [];
        const index = userSockets.findIndex((channel) => channel.id === channelId);
        if (index !== -1) {
            const channel = userSockets[index];
            userSockets.splice(index, 1);
            this.tryDisconnectChannel(channel);
        }
    }

    /**
     * Removes all user channels of a user.
     *
     * Channels are disconnected.
     */
    removeAllChannels(userId: string, clientId: string) {
        if (!this.channels.has(userId)) {
            return;
        }

        const userChannels = this.channels.get(userId) || [];

        this.channels.set(
            userId,
            userChannels.filter((channel) => {
                const remove = channel.clientId === clientId;
                if (remove) {
                    this.tryDisconnectChannel(channel);
                }
                return !remove;
            })
        );
    }

    /**
     * Removes all channels of a user for the given client.
     *
     * Channels are disconnected.
     */
    removeChannels(userId: string, clientId?: string | null) {
        if (!this.channels.has(userId)) {
            return;
        }

        const userChannels = this.channels.get(userId) || [];

        this.channels.set(
            userId,
            userChannels.filter((channel) => {
                const remove = !clientId || channel.clientId === clientId;

                if (remove) {
                    this.tryDisconnectChannel(channel);
                }

                return !remove;
            })
        );
    }

    /**
     * Finds all channels of user for the given client.
     */
    findChannels(userId: string, clientId?: string | null): Channel[] {
        const userChannels = this.channels.get(userId) ?? [];
        return userChannels.filter((channel) => !clientId || channel.clientId === clientId);
    }

    /**
     * Finds a specific channel of a user.
     */
    getChannel(userId: string, channelId: string): Channel | null {
        const userChannels = this.channels.get(userId) ?? [];
        return userChannels.find((channel) => channel.id === channelId) || null;
    }

    /**
     * Finds a channel by client id.
     */
    findChannel(userId: string, clientId: string): Channel | null {
        const [channel] = this.findChannels(userId, clientId);
        return channel ?? null;
    }

    /**
     * Checks if a user has a channel
     */
    hasChannel(userId: string, clientId?: string): boolean {
        return !!this.findChannels(userId, clientId).length;
    }
}
