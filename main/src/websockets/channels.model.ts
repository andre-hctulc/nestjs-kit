import { z } from "zod/v4";

export const ChannelMessageSchema = z.object({
    /**
     * Unique message id
     */
    id: z.string(),
    /**
     * Message id
     */
    response_to: z.string().optional(),
    /**
     * Defaults to `expectResponse` option if not set.
     */
    expect_response: z.boolean().optional(),
    type: z.string(),
    status: z.number().optional(),
    error: z.boolean().optional(),
    body: z.record(z.string(), z.any()),
    /**
     * Generic target for the event.
     */
    target: z.string().optional(),
    /**
     * Generic source for the event.
     */
    source: z.string().optional(),
});
export type ChannelMessage = z.infer<typeof ChannelMessageSchema>;
