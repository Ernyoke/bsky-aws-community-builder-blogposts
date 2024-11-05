export class Article {
    constructor(public id: number,
                public title: string,
                public description: string,
                public publishedDate: string,
                public url: string,
                public tags: [string],
                public cover: string,
                public author: Author
    ) {
    }
}

export class Author {
    constructor(public name: string,
                public userName: string,
                public userId: number) {
    }
}
