
require('dotenv').config();
const express = require('express');
const http = require('http');
const uuidV4 = require('uuid/v4');

const WebSocket = require('ws');
const Joi = require('joi');
const redisCommands = require('./redis/redis-commands');
const redisEvents = require('./redis/redis-events');
const _ = require('lodash');

const app = express();
const server = http.Server(app);
const wss = new WebSocket.Server({ server });

// serve index.html
app.use(express.static('public'));

const sockets = {};

const defaultTenant = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  token: process.env.TWITTER_TOKEN,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  tokenSecret: process.env.TWITTER_TOKEN_SECRET,
};

const tenantSchema = Joi.object().keys({
    consumerKey: Joi.string().min(3).max(30).required(),
    token: Joi.string().length(50).required(),
    consumerSecret: Joi.string().length(50).required(),
    tokenSecret: Joi.string().min(30).max(60).required()
});

const subscribeSchema = Joi.object().keys({
  tenant: tenantSchema.allow(null),
  keywords: Joi.array().items(Joi.string()).required()
});

const subscribe = (ws, message) => {
  sockets[ws].tenant = message.tenant || sockets[ws].tenant;
  redisCommands.trackKeywords(sockets[ws].tenant, sockets[ws].userId, message.keywords);
  redisEvents.subscribe(redisCommands.getId(sockets[ws].tenant), sockets[ws].userId, (tenantId, userId, analyzedTweets) => {
    ws.send(JSON.stringify(analyzedTweets));
  });
};

const unsubscribe = (ws) => {
  const userId = sockets[ws].userId;
  const tenantId = redisCommands.getId(sockets[ws].tenant);
  redisEvents.unsubscribe(tenantId, userId);
  redisCommands.removeUser(tenantId, userId)
               .then(ok => ok && delete sockets[ws]);
};

wss.on('connection', (ws) => {

  sockets[ws] = {
    tenant: defaultTenant,
    userId: uuidV4(),
    keywords: []
  };

  ws.on('message', (message) => {
    const validation = Joi.validate(message, subscribeSchema);
    if (validation.error) {
      console.error(validation.error);
      ws.send(JSON.stringify(validation));
    } else {
      subscribe(ws, JSON.parse(message));
    }
  });

  ws.on('close', () => {
    unsubscribe(ws);
  });

});

setInterval(() => {
  new Set(
    Object.values(sockets)
    .map(value => value.tenant)
    .map(tenant => redisCommands.getId(tenant))
  ).forEach(tenantId => redisCommands.refreshTenantExpiration(tenantId));
}, process.env.KEEP_ALIVE_INTERVAL);

// lets go
server.listen(3000, () => {
  console.log('listening on *:3000');
});
