import { Handler } from 'aws-lambda';
import Bot from "./lib/bot.js";
import fetchDevToPostsByOrg from "./lib/devTo.js";
import DynamoClient from './lib/dynamoDB.js';
import _ from "lodash";
import { Article } from './lib/article.js';

const db = new DynamoClient();

const postsPerPage = 10;
const maxPagesToFetch = 3;

async function main() {
    const errors = [];
    const articlesToPost: Article[] = [];

    for (let page = 0; page < maxPagesToFetch; page++) {
        const articles = await fetchDevToPostsByOrg('aws-builders', page + 1, postsPerPage);

        const checkIfExistsInDB = await Promise.allSettled(articles.map(article => db.checkIfArticleExists(article)));
    
        const recentlyPublished = _.zip(articles, checkIfExistsInDB).filter(([_, exists]) => {
            if (exists?.status === "rejected") {
                errors.push(exists.reason);
                return true;
            }
            return !(exists?.value);
        }).map(([article, _]) => article);
    
        Array.prototype.push.apply(articlesToPost, recentlyPublished);
    
        if (_.isEmpty(articlesToPost)) {
            // No more articles to post, so we stop running
            break;
        }
    }

    for (const article of articlesToPost) {
        try {
            await Bot.run(article, { dryRun: false });
            console.log(`Posted article ${article.id} with title "${article.title}"`);
        } catch(ex) {
            console.error(`Failed to post article ${article.id} with title "${article.title}"`);
        }
    }

    db.saveArticles(articlesToPost);
    console.log(`${articlesToPost.length} articles were saved into DynamoDB.`);
}

export const handler: Handler = async (event, context) => {
    return await main();
};

// await main();