const { buildSchema } = require('graphql'); // function which allows to build new schema

// exports new graphql schema object
// in type Query you define your queries and their type
// String! - means if hello() don't return a string it will return an error
// input - special key word - for the Data that is used as an input.
module.exports = buildSchema(`
    input UserInputData {
        email: String!
        name: String!
        password: String!
    }

    input PostInputData {
        title: String!
        imageUrl: String!
        content: String!
    }

    type Post {
        _id: ID!
        title: String!
        content: String!
        imageUrl: String!
        creator: User!
        createdAt: String!
        updatedAt: String!
    }

    type User {
        _id: ID!
        name: String!
        email: String!
        password: String
        status: String!
        posts: [Post!]!
    }

    type AuthData {
        token: String!
        userId: String!
    }

    type PostsData {
        posts: [Post!]!
        totalPosts: Int!
    }

    type RootQuery {
        login(email: String!, password: String!): AuthData!
        posts(page: Int): PostsData!
        post(id: ID!): Post!
        user: User!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createPost(postInput: PostInputData): Post!
        updatePost(id: ID!, postInput: PostInputData): Post!
        deletePost(id: ID!): Boolean
        updateStatus(status: String): User!
    }

    schema {
        mutation: RootMutation
        query: RootQuery
    }
`);