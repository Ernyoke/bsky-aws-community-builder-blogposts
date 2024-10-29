import { bskyAccount, bskyService } from "./config.js";
import type {
    AtpAgentLoginOpts,
    AtpAgentOpts,
    AppBskyFeedPost,
} from "@atproto/api";
import atproto from "@atproto/api";
import { Article } from "./article.js";
const { BskyAgent } = atproto;

type BotOptions = {
    service: string | URL;
    dryRun: boolean;
};

export default class Bot {
    #agent;

    static defaultOptions: BotOptions = {
        service: bskyService,
        dryRun: false,
    } as const;

    constructor(service: AtpAgentOpts["service"]) {
        this.#agent = new BskyAgent({ service });
    }

    login(loginOpts: AtpAgentLoginOpts) {
        return this.#agent.login(loginOpts);
    }

    async post(article: Article) {
        const coverImage = await fetch(article.cover);
        const blob = await coverImage.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const { data } = await this.#agent.uploadBlob(new Uint8Array(arrayBuffer), { encoding: blob.type });

        const text = 'New post was published by';
        const textWithName = `${text} ${article.author.name}`;

        const record = {
            '$type': 'app.bsky.feed.post',
            createdAt: article.publishedDate,
            text: textWithName,
            facets: [
                {
                    index: {
                        byteStart: text.length,
                        byteEnd: text.length + 1 + article.author.name.length
                    },
                    features: [{
                        $type: 'app.bsky.richtext.facet#link',
                        uri: `https://dev.to/${article.author.userName}`
                    }]
                }
            ],
            embed: {
                "$type": 'app.bsky.embed.external',
                external: {
                    uri: article.url,
                    title: article.title,
                    description: article.description,
                    thumb: data.blob
                }
            }
        } as AppBskyFeedPost.Record;

        return await this.#agent.post(record);
    }

    static async run(
        article: Article,
        botOptions?: Partial<BotOptions>
    ) {
        const { service, dryRun } = botOptions
            ? Object.assign({}, this.defaultOptions, botOptions)
            : this.defaultOptions;
        const bot = new Bot(service);
        await bot.login(bskyAccount);
        if (!dryRun) {
            await bot.post(article);
        }
    }

    async uploadBlob(blob: any) {
        const { data } = await this.#agent.uploadBlob(blob)
        return data;
    }
}
