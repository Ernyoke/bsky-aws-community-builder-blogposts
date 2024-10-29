import { z } from "zod";
import type { AtpAgentLoginOpts } from "@atproto/api";
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';

const envSchema = z.object({
    handle: z.string().nonempty(),
    password: z.string().nonempty(),
    service: z.string().nonempty().default("https://bsky.social"),
});

const parsed = envSchema.parse(JSON.parse(await getSecret('bsky_awscmblogposts_secrets') ?? '{}'));

export const bskyAccount: AtpAgentLoginOpts = {
    identifier: parsed.handle,
    password: parsed.password,
};

export const bskyService = parsed.service;
