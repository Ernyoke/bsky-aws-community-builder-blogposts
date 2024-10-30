import { BatchWriteItemCommand, DynamoDBClient, PutRequest, QueryCommand, QueryCommandInput, WriteRequest } from "@aws-sdk/client-dynamodb";
import { Article } from "./article.js";
import { marshall } from "@aws-sdk/util-dynamodb";
import _ from "lodash";

const tableName = "bsky-aws-community-builder-blogposts";

export default class DynamoClient {
    private client: DynamoDBClient;

    constructor() {
        this.client = new DynamoDBClient({});
    }

    async checkIfArticleExists(article: Article) {
        const input = {
            "ExpressionAttributeValues": {
                ":id": {
                    "N": article.id.toString()
                }
            },
            "KeyConditionExpression": "ArticleId = :id",
            "TableName": tableName
        } as QueryCommandInput;
    
        const command = new QueryCommand(input);
        const response = await this.client.send(command);
    
        return response.Items && response.Items.length > 0;
    }
    
    async saveArticles(articles: Article[]) {
        // Calculate the expireAt time (90 days from now) in epoch second format
        const expireAt = Math.floor((new Date().getTime() + 90 * 24 * 60 * 60 * 1000) / 1000);

        const chunks = _.chunk(articles, 25);
    
        const results = await Promise.allSettled(chunks.map(chunk => this.saveArticleBatch(chunk, expireAt)));

        for (let i = 0; i < results.length; i++) {
            if (results[i].status === "rejected") {
                console.error(`Failed to save batch: ${JSON.stringify(chunks[i])}`);
            }
        }
    }

    async saveArticleBatch(articles: Article[], expireAt: number) {
        const putRequests = articles.map(article => {
            const item = marshall({
                ArticleId: article.id,
                Title: article.title,
                AuthorId: article.author.userId,
                AuthorUserName: article.author.userName,
                AuthorName: article.author.name,
                PublishedDateTime: new Date(article.publishedDate).getTime() / 1000,
                TimeToExist: expireAt
            });
            return {
                "PutRequest": {
                    "Item": item,
                } as PutRequest
            };
        });
    
        const command = new BatchWriteItemCommand({
            "RequestItems": {
                "bsky-aws-community-builder-blogposts": putRequests
            }
        });
    
        return await this.client.send(command);
    }
}