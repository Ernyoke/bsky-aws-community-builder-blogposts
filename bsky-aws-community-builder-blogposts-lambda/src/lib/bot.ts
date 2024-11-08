import {bskyAccount, config} from "./config.js";
import type {AppBskyFeedPost, AtpAgentLoginOpts,} from "@atproto/api";
import atproto from "@atproto/api";
import {Article} from "./article.js";
import {Logger} from "@aws-lambda-powertools/logger";

const {BskyAgent} = atproto;

type BotOptions = {
    service: string | URL;
    dryRun: boolean;
};

const defaultOptions: BotOptions = {
    service: config.bskyService,
    dryRun: config.bskyDryRun,
}

export default class Bot {
    #agent;

    constructor(private logger: Logger, options: BotOptions = defaultOptions) {
        const {service} = options;
        this.#agent = new BskyAgent({service});
    }

    login(loginOpts: AtpAgentLoginOpts = bskyAccount) {
        return this.#agent.login(loginOpts);
    }

    async post(article: Article, dryRun: boolean = defaultOptions.dryRun) {
        if (dryRun) {
            this.logger.info(`Article with title ${article.title} not posted! Reason: dry run.`);
            return;
        }

        const encoder = new TextEncoder();

        const coverImage = await fetch(article.cover);
        const blob = await coverImage.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const {data} = await this.#agent.uploadBlob(new Uint8Array(arrayBuffer), {encoding: blob.type});

        const introText = '✍️ New blog post by ';
        const introWithAuthor = `${introText}${article.author.name}\n\n`;

        let offset = encoder.encode(introText).byteLength;
        const authorNameLength = encoder.encode(article.author.name).byteLength;

        const textFaces = [{
            index: {
                byteStart: offset,
                byteEnd: offset + authorNameLength
            },
            features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: `https://dev.to/${article.author.userName}`
            }]
        }];

        offset += (authorNameLength + encoder.encode('\n\n').byteLength);

        const titleRow = `${article.title}\n\n`;
        offset += encoder.encode(titleRow).byteLength;

        const tagsFacets = [];
        const hashTags: string[] = [];
        let textLineWithTags = '';
        for (const tag of article.tags) {
            const hashTag = `#${tag}`;
            const hashTagLength = encoder.encode(hashTag).byteLength;
            tagsFacets.push(
                {
                    index: {
                        byteStart: offset,
                        byteEnd: offset + hashTagLength
                    },
                    features: [{
                        $type: 'app.bsky.richtext.facet#tag',
                        tag: tag
                    }]
                }
            );
            offset += (hashTagLength + 1);
            hashTags.push(hashTag);
        }
        textLineWithTags += `${hashTags.join(' ')}`;

        const fullText = `${introWithAuthor}${titleRow}${textLineWithTags}`;

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
