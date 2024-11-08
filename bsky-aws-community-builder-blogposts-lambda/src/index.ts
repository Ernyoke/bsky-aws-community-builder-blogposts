import {Handler} from 'aws-lambda';
import Bot from "./lib/bot.js";
import fetchDevToPostsByOrg from './lib/devTo.js';
import DynamoClient from './lib/dynamoDB.js';
import _ from 'lodash';
import {Article} from './lib/article.js';
import {Logger} from '@aws-lambda-powertools/logger';

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

        for (const failure of checkFailures) {
            logger.warn(`Failed to detect if article ${failure.article.id} with title ${failure.article.title} exists in the database!`);
        }

        Array.prototype.push.apply(articlesToPost, recentlyPublished);

        if (_.isEmpty(articlesToPost)) {
            // No more articles to post, so we stop running
            break;
        }
    }

    if (articlesToPost.length > 0) {
        const bot = new Bot(logger);
        await bot.login();
        for (const article of articlesToPost) {
            try {
                await bot.post(article);
                logger.info(`Posted article ${article.id} with title "${article.title}"`);
            } catch (ex) {
                logger.error(`Failed to post article ${article.id} with title "${article.title} `, {
                    error: ex
                });
            }
        }

        await db.saveArticles(articlesToPost);
        logger.info(`${articlesToPost.length} articles were saved into DynamoDB.`);
    } else {
        logger.info(`No new articles.`);
    }
}

export const handler: Handler = async (event, context) => {
    logger.addContext(context);
    return await main();
};
