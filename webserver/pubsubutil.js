

/*
structure of tenants-array:
[
    { // tenant1

        consumerKey: ...,
        consumerToken: ...,
        ..., // oauth / twitter credentials
        users: [
            {
                id: 0,
                keywords: ['a', 'b', 'c']
            },
            {
                id: 1,
                keywords: ['x', 'y', 'z']
            }
        ]
    },
    { // tenant2
        ...
    }
]
*/

const tenants = [];

const clear = () => {
    tenants.length = 0;
};

const getId = (tenant) => {
    return tenant.consumerKey;
};


const addTenant = (tenant) => {
    const tenantId = getId(tenant);
    let t = tenants.find(t => getId(t) === tenantId);
    if (!t) {
        t = tenant;
        t.users = [];
        tenants.push(t);
    }    
    return t;
};

const addUser = (tenantId, userId) => {    
    let u = getUser(tenantId, userId);
    if (!u) {
        u = {id: userId};
        u.keywords = new Set();        
        const t = getTenant(tenantId);
        if (t) {
            t.users.push(u);
        }        
    }
    return u;
};

const getUser = (tenantId, userId) => {
    const t = getTenant(tenantId);
    if (t) {
        return t.users.find(u => u.id === userId);        
    }
    return undefined;
}

const addKeyword = (tenant, userId, keyword) => {
    const tenantId = getId(tenant);
    const t = addTenant(tenant);
    const u = addUser(tenantId, userId);    
    u.keywords.add(keyword);    
};

const getKeywordsByUser = (tenantId, userId) => {
    const u = getUser(tenantId, userId);    
    if (u) {
        return u.keywords;        
    }
    return new Set();    
}

const getKeywordsByTenant = (tenantId) => {
    const t = getTenant(tenantId);
    const keywords = new Set();    
    if (t && t.users) {
        t.users.map(u => u.keywords).forEach(keywordSet => {
            keywordSet.forEach(keyword => keywords.add(keyword));
        });        
    }
    return keywords;
}

const removeKeyword = (tenantId, userId, keyword) => {    
    const u = getUser(tenantId, userId);
    if (u) {
        u.keywords.delete(keyword);
    }
};

const removeUser = (tenantId, userId) => {
    const t = getTenant(tenantId);
    if (t && t.users) {
        const u = t.users.find(u => u.id === userId);
        if (u) {
            const index = t.users.indexOf(u);
            t.users.splice(index, 1);
        }
    }
};

const hasUsers = (tenantId) => {    
    const t = getTenant(tenantId);
    if (t && t.users) {
        return t.users.length > 0;
    }
    return false;
}

const removeTenant = (tenantId) => {    
    const t = getTenant(tenantId);
    if (t) {
        const index = tenants.indexOf(t);
        tenants.splice(index, 1);
    }
};

const getTenantIds = () => {
    return tenants.map(t => getId(t));
};

const getUserIds = (tenantId) => {
    const t = getTenant(tenantId);
    if (t) {
        return t.users.map(u => u.id);
    }
    return [];
};


const getTenant = (tenantId) => {
    return tenants.find(t => getId(t) === tenantId);
};


const pubsubutil = {
    clear,
    getId,
    addKeyword,
    getKeywordsByUser,
    getKeywordsByTenant,    
    removeKeyword,
    removeUser,
    hasUsers,
    removeTenant,
    getTenantIds,
    getUserIds,
    addTenant,
    getTenant,
    addUser,
    getUser
};

module.exports = pubsubutil;