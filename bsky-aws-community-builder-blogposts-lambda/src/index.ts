import { Handler } from 'aws-lambda';
import Bot from "./lib/bot.js";
import fetchDevToPostsByOrg from "./lib/devTo.js";

export const handler: Handler = async (event, context) => {
    const articles = await fetchDevToPostsByOrg('aws-builders', 1, 10);
    const result = await Bot.run(articles[0], { dryRun: false });
    return result;
};