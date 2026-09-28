/**
 * 内存版 wx-server-sdk 模拟层：拦截 require('wx-server-sdk')，
 * 用 JS 对象数组模拟云数据库，支持云函数用到的全部 API 子集。
 */
const Module = require('module');

const tables = {
  childProfiles: [],
  plans: [],
  records: [],
  progress: [],
};
let seq = 0;

const matches = (doc, cond) =>
  Object.entries(cond).every(([k, v]) => {
    if (v && v.__regexp) {
      return new RegExp(v.__regexp).test(String(doc[k] ?? ''));
    }
    return JSON.stringify(doc[k]) === JSON.stringify(v);
  });

class Query {
  constructor(col, cond) {
    this.col = col;
    this.cond = cond;
    this._limit = Infinity;
    this._order = null;
  }
  limit(n) { this._limit = n; return this; }
  orderBy(field, dir) { this._order = { field, dir }; return this; }
  count() {
    return { total: this._run().length };
  }
  get() {
    let rows = this._run().slice(0, this._limit);
    if (this._order) {
      const { field, dir } = this._order;
      rows = rows.slice().sort((a, b) =>
        dir === 'desc'
          ? String(b[field]).localeCompare(String(a[field]))
          : String(a[field]).localeCompare(String(b[field])),
      );
    }
    return { data: rows.map((r) => ({ ...r })) };
  }
  _run() {
    return tables[this.col.name].filter((d) => matches(d, this.cond));
  }
  remove() {
    const arr = tables[this.col.name];
    const victims = this._run();
    for (const d of victims) {
      const i = arr.findIndex((x) => x._id === d._id);
      if (i >= 0) arr.splice(i, 1);
    }
    return { stats: { removed: victims.length } };
  }
}

class Doc {
  constructor(col, id) { this.col = col; this.id = id; }
  _find() { return tables[this.col.name].find((d) => d._id === this.id); }
  get() {
    const doc = this._find();
    return { data: doc ? { ...doc } : null };
  }
  update({ data }) {
    const doc = this._find();
    if (!doc) return { stats: { updated: 0 } };
    for (const [k, v] of Object.entries(data)) {
      const parts = k.split('.');
      let cur = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = v;
    }
    return { stats: { updated: 1 } };
  }
  remove() {
    const arr = tables[this.col.name];
    const i = arr.findIndex((d) => d._id === this.id);
    if (i >= 0) arr.splice(i, 1);
    return { stats: { removed: i >= 0 ? 1 : 0 } };
  }
}

class Collection {
  constructor(name) { this.name = name; }
  where(cond) { return new Query(this, cond); }
  doc(id) { return new Doc(this, id); }
  add({ data }) {
    const _id = `auto_${++seq}`;
    tables[this.name].push({ ...data, _id });
    return { _id };
  }
}

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init() {},
  getWXContext() { return { OPENID: 'test_openid_1' }; },
  database() {
    return {
      collection: (name) => {
        if (!tables[name]) tables[name] = [];
        return new Collection(name);
      },
      RegExp: ({ regexp }) => ({ __regexp: regexp }),
      command: {},
    };
  },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockSdk;
  return origLoad.apply(this, arguments);
};

module.exports = { tables, resetTables: () => { for (const k of Object.keys(tables)) tables[k] = []; seq = 0; } };
