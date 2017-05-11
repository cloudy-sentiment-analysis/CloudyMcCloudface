const tenant = require('./tenant');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const redisClient = redis.createClient();
redisClient.config('set', 'notify-keyspace-events', 'KEA');

const getSampleTenant = () => {
    const t = {
        consumerKey: 'my-consumerKey',
        token: 'my-token',
        consumerSecret: 'my-consumerSecret',
        tokenSecret: 'my-tokenSecret'        
    };
    return t;
}

afterEach((done) => {
    tenant.onNewTenant(null);    
    tenant.onKeywordRemoved(null);
    tenant.onKeywordAdded(null);
    redisClient.flushdb(done);        
});

test('battle for tenant', (done) => {
    expect.assertions(1);
    tenant.onNewTenant((t) => {                        
        expect(t).toBe('my-tenant-value');                
        done();
    });    
    redisClient.setAsync('tenant:my-tenant-key', 'my-tenant-value');
});

test('create tenant', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    tenant.createTenant(t)
        .then(res => {            
            expect(res).toBe(true);            
            done();
        });
});

test('add user', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    const u = 'me-as-user';
    tenant.addUser(t, u)
        .then(res => {
            expect(res).toBe(true);
            done();
        });
});

test('remove user', async () => {
    expect.assertions(2);
    const t = getSampleTenant();
    const u = 'me-as-user';
    const res1 = await tenant.addUser(t, u);
    expect(res1).toBe(true);
    const res2 = await tenant.removeUser(t, u);
    expect(res2).toBe(true);        
});

test('add keyword', async () => {
    expect.assertions(2);
    const t = getSampleTenant();
    const u = 'me-as-user';
    const res1 = await tenant.addUser(t, u);    
    expect(res1).toBe(true);
    const res2 = await tenant.addKeyword(t, u, 'my-keyword')
    expect(res2).toBe(true);    
});

test('remove keyword', async () => {
    expect.assertions(3);
    const t = getSampleTenant();
    const u = 'me-as-user';
    const res1 = await tenant.addUser(t, u);    
    expect(res1).toBe(true);
    const res2 = await tenant.addKeyword(t, u, 'my-keyword')
    expect(res2).toBe(true); 
    const res3 = await tenant.removeKeyword(t, u, 'my-keyword');
    expect(res3).toBe(true);
});

test('add keyword callback', async (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    const u = 'me-as-user';    
    const res1 = await tenant.createTenant(t);
    tenant.onKeywordAdded((theTenant, keywords) => {
        expect(keywords).toEqual(['my-keyword']);
        done();
    });
    await tenant.addKeyword(t, u, 'my-keyword');    
});

test('remove keyword callback', async (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    const u = 'me-as-user';    
    const res1 = await tenant.createTenant(t);
    tenant.onKeywordRemoved((theTenant, keywords) => {
        expect(keywords).toEqual([]);
        done();
    });
    await tenant.addKeyword(t, u, 'my-keyword');
    await tenant.removeKeyword(t, u, 'my-keyword');
});