import {Article, Author} from "./article.js";

interface DevToArticle {
    type_of: string;
    id: number;
    title: string;
    description: string;
    readable_publish_date: string;
    url: string;
    tag_list: [string]
    user: DevToAuthor,
    published_timestamp: string,
    social_image: string
}

interface DevToAuthor {
    name: string;
    username: string;
    user_id: number;
}

function mapFromDevToFormat(devToArticle: DevToArticle): Article {
    return new Article(devToArticle.id,
        devToArticle.title,
        devToArticle.description,
        devToArticle.published_timestamp,
        devToArticle.url,
        devToArticle.tag_list,
        devToArticle.social_image,
        new Author(devToArticle.user.name,
            devToArticle.user.username,
            devToArticle.user.user_id)
    );
}

export default async function fetchDevToPostsByOrg(organization: string, page: number, articlesPerPage: number) {
    const url = `https://dev.to/api/organizations/${organization}/articles?page=${page}&per_page=${articlesPerPage}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }

    const articles = await response.json() as [DevToArticle];
    return articles
        .filter(article => article.type_of === "article")
        .map(mapFromDevToFormat);
}
