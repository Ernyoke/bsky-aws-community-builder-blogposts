import { bskyAccount, bskyService, bskyDryRun } from "./config.js";
import type {
    AtpAgentLoginOpts,
    AtpAgentOpts,
    AppBskyFeedPost,
} from "@atproto/api";
import atproto from "@atproto/api";
import { Article } from "./article.js";
const { BskyAgent } = atproto;
import { Logger } from "@aws-lambda-powertools/logger";

type BotOptions = {
    service: string | URL;
    dryRun: boolean;
};

const defaultOptions: BotOptions = {
    service: bskyService,
    dryRun: bskyDryRun,
}

export default class Bot {
    #agent;

    constructor(private logger: Logger, options: BotOptions = defaultOptions) {
        const { service } = options;
        this.#agent = new BskyAgent({ service });
    }

    login(loginOpts: AtpAgentLoginOpts = bskyAccount) {
        return this.#agent.login(loginOpts);
    }

    async post(article: Article, dryRun: boolean = defaultOptions.dryRun) {
        if (dryRun) {
            this.logger.info(`Article with title ${article.title} not posted! Reason: dry run.`);
            return;
        }

        const coverImage = await fetch(article.cover);
        const blob = await coverImage.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const { data } = await this.#agent.uploadBlob(new Uint8Array(arrayBuffer), { encoding: blob.type });

        const text = 'New post was published by';
        const textWithName = `${text} ${article.author.name}`;

        let offset = text.length + 1;

        const textFaces = [{
            index: {
                byteStart: offset,
                byteEnd: offset + article.author.name.length
            },
            features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: `https://dev.to/${article.author.userName}`
            }]
        }];

        offset += (article.author.name.length + '\n'.length);

        const tagsFacets = [];
        let textLineWithTags = '';
        for (const tag of article.tags) {
            const hashTag = `#${tag}`;
            tagsFacets.push(
                {
                    index: {
                        byteStart: offset,
                        byteEnd: offset + hashTag.length
                    },
                    features: [{
                        $type: 'app.bsky.richtext.facet#tag',
                        tag: tag
                    }]
                }
            );
            offset += (hashTag.length + 1); // for colon and space after tag
            textLineWithTags += `${hashTag} `;
        };

        const fullText = `${textWithName}\n${textLineWithTags}`;

        const record = {
            '$type': 'app.bsky.feed.post',
            createdAt: article.publishedDate,
            text: fullText,
            facets: [
                ...textFaces, 
                ...tagsFacets
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
}
