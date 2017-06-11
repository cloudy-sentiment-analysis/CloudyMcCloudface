require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
    endpoint: process.env.DYNAMO_DB_ENDPOINT,
    region: process.env.DYNAMO_DB_REGION
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const createTable = (tenantId) => {
    const params = {
        TableName: tenantId,
        AttributeDefinitions: [
            {AttributeName: 'recordId', AttributeType: 'S'},
            {AttributeName: 'keyword', AttributeType: 'S'},
        ],
        KeySchema: [
            {AttributeName: 'recordId', KeyType: 'HASH'},  //Partition key
            {AttributeName: 'keyword', KeyType: 'RANGE'},  //Range key
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    dynamodb.createTable(params, function (err, data) {
        if (data) {
            console.log('Created table. Table description JSON:', JSON.stringify(data, null, 2));
        } else if (err && err.code !== 'ResourceInUseException') {
            console.error('Could not create table. Error JSON:', JSON.stringify(err, null, 2));
            process.exit(1);
        }
    });
};

const insertAnalyzedTweets = (tenantId, recordId, tweets) => {
    console.log('Inserting analyzed tweets...');

    // add timestamp to analyzed tweets
    tweets.analyzedTweets.forEach(tweet => tweet.timestamp = tweets.timestamp);

    const params = {
        TableName: tenantId,
        Key: {
            recordId,
            keyword: tweets.keyword
        },
        UpdateExpression: 'set analyzedTweets = list_append(if_not_exists(analyzedTweets, :empty_list), :tweets)',
        ExpressionAttributeValues: {
            ':tweets': tweets.analyzedTweets,
            ':empty_list': []
        },
        ReturnValues: 'UPDATED_NEW'
    };

    docClient.update(params, function (err) {
        if (err) {
            console.error('Unable to insert analyzed tweets. Error JSON:', JSON.stringify(err, null, 2));
        } else {
            console.log('Insert succeeded.');
        }
    });
};

const queryTweets = (tenantId, recordId) => new Promise((resolve, reject) => {
    const params = {
        TableName: tenantId,
        KeyConditionExpression: 'recordId = :recId',
        ExpressionAttributeValues: {
            ':recId': recordId
        }
    };

    docClient.query(params, (err, data) => {
        if (err) {
            console.error(`Unable to query table: ${JSON.stringify(err, null, 2)}`);
            reject(err);
        } else {
            resolve(data.Items);
        }
    });
});

module.exports = {
    createTable,
    insertAnalyzedTweets,
    queryTweets
};