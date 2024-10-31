import { Handler } from 'aws-lambda';
import Bot from "./lib/bot.js";
import fetchDevToPostsByOrg from './lib/devTo.js';
import DynamoClient from './lib/dynamoDB.js';
import _ from 'lodash';
import { Article } from './lib/article.js';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();
const db = new DynamoClient(logger);

const postsPerPage = 10;
const maxPagesToFetch = 3;

async function main() {
    const articlesToPost: Article[] = [];

    for (let page = 0; page < maxPagesToFetch; page++) {
        const articles = await fetchDevToPostsByOrg('aws-builders', page + 1, postsPerPage);

        const checkIfExistsInDB = await Promise.allSettled(articles.map(article => db.checkIfArticleExists(article)));
        const checkFailures: { article: Article, error: any | undefined }[] = [];

        const recentlyPublished: Article[] = [];

        for (const [article, checkResult] of _.zip(articles, checkIfExistsInDB)) {
            if (checkResult?.status === "rejected") {
                if (article) {
                    checkFailures.push({
                        article: article, error: checkResult?.reason
                    });
                }
                continue;
            }
            if (!checkResult?.value && article) {
                recentlyPublished.push(article);
            }
        }

        Array.prototype.push.apply(articlesToPost, recentlyPublished);

        if (_.isEmpty(articlesToPost)) {
            // No more articles to post, so we stop running
            break;
        }
    }

    for (const article of articlesToPost) {
        try {
            await Bot.run(article, { dryRun: false });
            logger.info(`Posted article ${article.id} with title "${article.title}"`);
        } catch (ex) {
            logger.error(`Failed to post article ${article.id} with title "${article.title} `, {
                error: ex
            });
        }
    }

    db.saveArticles(articlesToPost);
    logger.info(`${articlesToPost.length} articles were saved into DynamoDB.`);
}

export const handler: Handler = async (event, context) => {
    logger.addContext(context);
    return await main();
};

// await main();