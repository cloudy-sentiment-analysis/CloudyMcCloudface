const Boom = require('boom');
const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');
const credentialsValidator = require('../credentials-validator');

const THREE_SECONDS = 3000;
const ONE_MINUTE = 60000;

exports.register = function (server, options, next) {

  /**
   * Route to create a new record. Example payload:
   * {
     tenant: {...},
     keywords: ['fbc', 'bvb'],
     begin: 1497089444598,
     end: 1497089467765
   }
   */
  server.route({
    method: 'POST',
    path: '/records',
    handler: function (request, reply) {
      const payload = request.payload;

      credentialsValidator.areCredentialsValid(request.payload.tenant)
        .then(ok => {
          if (!ok) {
            return reply(Boom.badData({
              type: 'error',
              message: 'Invalid Tenant Credentials!'
            }));
          }
          const currentTime = new Date().getTime();
          if (!payload.begin && !payload.end) {
            // no time set, then record now for 1 minute
            payload.begin = currentTime + THREE_SECONDS;
            payload.end = payload.begin + ONE_MINUTE;
          }
          else if (!(payload.begin && payload.end)) {
            return reply(Boom.badData('When 1 time parameter is set, the other time parameter must be set too'));
          }
          else if (payload.begin < currentTime) {
            return reply(Boom.badData('begin must be in the future.'));
          }
          else if (payload.end < payload.begin) {
            return reply(Boom.badData('end must be after begin.'));
          }
          else if (!payload.keywords || payload.keywords.length < 1) {
              return reply(Boom.badData('No keywords are set.'));
          }
          dynamoRecords.insertRecord(payload).then(record => {
            redisCommands.scheduleRecording(record.id, record.begin, record.end);
            return reply(record);
          });
        });
    }
  });

  /**
   * Route to get all records for a specific tenantId
   */
  server.route({
    method: 'GET',
    path: '/tenants/{tenantId}/records',
    handler: function (request, reply) {
      return reply(dynamoRecords.getRecordsByTenant(request.params.tenantId));
    }
  });

  /**
   * Route to get the analyzed tweets for one record
   */
  server.route({
    method: 'GET',
    path: '/records/{recordId}/tweets',
    handler: function (request, reply) {
      dynamoRecords.getRecord(request.params.recordId)
        .then(record => {
          if (!record) {
            return Boom.notFound('Record not found.');
          }
          const tenantId = redisCommands.getId(record.tenant);
          return dynamoTweets.queryTweets(tenantId, record.id);
        })
        .then(recordData => {
          if (!recordData[0]) {
            return Boom.notFound('No data for record found.');
          }
          return recordData[0];
        })
        .then(reply);
    }
  });

  next();
};

exports.register.attributes = {
  name: 'recorder',
  version: '1.0.0'
};

// creating records table if not exist
dynamoRecords.createTable();

