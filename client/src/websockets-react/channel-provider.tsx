import { createContext, type FC, type ReactNode, useContext, useEffect, useState } from "react";
import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

export interface ChannelContext {
    /**
     * Channel id. Matches the socket id.
     */
    id: string;
    socket: Socket;
    parentContext: ChannelContext | null;
    uri: string;
}

const ChannelContext = createContext<ChannelContext | null>(null);

/**
 * Finds the nearest channel context of the specified type.
 * @param uri The channel uri. May be required when multiple channel providers are used.
 */
export function useChannelContext<O extends boolean = false>(
    uri?: string,
    optional?: O
): O extends true ? ChannelContext | null : ChannelContext {
    const context = useContext(ChannelContext);
    if (!context) {
        if (optional) {
            return null as any;
        }
        throw new Error(`Channel not found`);
    }
    if (uri !== undefined && context.uri !== uri) {
        let parent = context.parentContext;

        while (parent) {
            if (parent.uri === uri) {
                return parent;
            }
            parent = parent.parentContext;
        }

        if (optional) {
            return null as any;
        }

        throw new Error(`Channel not found`);
    }
    return context;
}

interface ChannelProviderProps {
    uri: string;
    children?: ReactNode;
    loading?: ReactNode;
    /**
     * Must be memoized!
     */
    socketOptions?: Partial<ManagerOptions & SocketOptions>;
}

export const ChannelProvider: FC<ChannelProviderProps> = ({ children, socketOptions, loading, uri }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const parentContext = useChannelContext(uri, true);

    useEffect(() => {
        // SEE https://socket.io/docs/v4/namespaces/
        // type must be included in the query
        const socket = io(uri, { ...socketOptions, query: { ...socketOptions?.query } });

        socket.on("connect", () => {
            setSocket(socket);
        });

        socket.on("disconnect", () => {
            setSocket(null);
        });

        return () => {
            socket.disconnect();
        };
    }, [socketOptions, uri]);

    if (!socket?.connected) {
        return loading;
    }

    return (
        <ChannelContext.Provider value={{ uri, id: socket.id!, socket, parentContext }}>
            {children}
        </ChannelContext.Provider>
    );
};
