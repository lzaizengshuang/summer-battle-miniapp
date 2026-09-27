const cloud = require('wx-server-sdk');
const { success, fail } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const collections = [
      { name: 'childProfiles', indexes: [
        { name: '_openid_isDefault', keys: { _openid: 1, isDefault: 1 } },
        { name: '_openid_createdAt', keys: { _openid: 1, createdAt: 1 } }
      ]},
      { name: 'plans', indexes: [
        { name: '_openid_childId', keys: { _openid: 1, childId: 1 } },
        { name: 'childId_startDate', keys: { childId: 1, startDate: -1 } }
      ]},
      { name: 'records', indexes: [
        { name: '_openid_childId_planId_date', keys: { _openid: 1, childId: 1, planId: 1, date: 1 }, unique: true }
      ]},
      { name: 'progress', indexes: [
        { name: '_openid_childId_planId', keys: { _openid: 1, childId: 1, planId: 1 }, unique: true }
      ]}
    ];

    const results = [];
    for (const col of collections) {
      try {
        await db.createCollection(col.name);
        results.push({ collection: col.name, action: 'created' });
      } catch (e) {
        if (e.errCode === -501000 || e.errMsg && e.errMsg.includes('already exists')) {
          results.push({ collection: col.name, action: 'existed' });
        } else {
          results.push({ collection: col.name, action: 'error', message: e.message });
        }
      }
      for (const idx of col.indexes) {
        try {
          await db.collection(col.name).createIndex({
            name: idx.name,
            keys: idx.keys,
            unique: idx.unique || false
          });
          results.push({ collection: col.name, index: idx.name, action: 'created' });
        } catch (e) {
          if (e.errCode === -501000 || e.errMsg && (e.errMsg.includes('already exists') || e.errMsg.includes('duplicate'))) {
            results.push({ collection: col.name, index: idx.name, action: 'existed' });
          } else {
            results.push({ collection: col.name, index: idx.name, action: 'error', message: e.message });
          }
        }
      }
    }

    return success({ results });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
