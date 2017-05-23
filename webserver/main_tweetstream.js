require('dotenv').config();
const redisEvents = require('./redis_events');
const redisCommands = require('./redis_commands');
const lambda = require('../lambda/main');
const ts = require('./tweetstream');

const streams = {};

const analyzeTweets = (keyword, tweets) => new Promise(
  (resolve) => {
    lambda({ tweets }, null, (res) => {
      res.keyword = keyword;
      resolve(res);            
    });
  });

const publishAnalyzedTweets = (tenant, analyzedTweets) => {
  const tenantId = redisCommands.getId(tenant);
  const keyword = analyzedTweets.keyword;
  redisCommands.getUserIdsByKeyword(tenantId, keyword)
    .then(userIds => userIds.forEach(userId => {
        redisCommands.publishAnalyzedTweets(tenantId, userId, analyzedTweets);
    }));
};

const handlePossibleKeywordChange = (tenantId) => {    
  const stream = streams[tenantId];
  if (stream) {
    redisCommands.getKeywordsByTenant(tenantId)
      .then(keywords => ts.setKeywords(stream, keywords));
  }
};

redisEvents.onNewTenant((tenantId) => {
  redisCommands.getTenant(tenantId)
    .then(tenant => {        
      const stream = ts.startStream(tenant);
      streams[redisCommands.getId(tenant)] = stream;
      ts.onTweets(stream, (keyword, tweets) => {
        analyzeTweets(keyword, tweets)
          .then(analyzedTweets => publishAnalyzedTweets(tenant, analyzedTweets));
      });
    });
});

redisEvents.onTenantRemoved((tenantId) => {  
  const stream = streams[tenantId];
  if (stream) {
    delete streams[tenantId];
    ts.stopStream(stream);    
  }
});

redisEvents.onKeywordAdded((tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.onKeywordRemoved((tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.onUserAdded((tenantId) => handlePossibleKeywordChange(tenantId));
redisEvents.onUserRemoved((tenantId) => handlePossibleKeywordChange(tenantId));

redisCommands.battleForFreeTenants();

setInterval(() => {
  Object.values(streams)    
    .map(value => redisCommands.getId(value.tenant))
    .forEach(tenantId => redisCommands.refreshTenantBattle(tenantId));
}, process.env.KEEP_ALIVE_INTERVAL);