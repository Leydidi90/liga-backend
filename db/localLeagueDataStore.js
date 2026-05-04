const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'local-league-data.json');

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ equipos: [], partidos: [], torneos: [], arbitros: [], representantes: [], inscripciones: [] }, null, 2),
      'utf8'
    );
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return {
    equipos: Array.isArray(parsed.equipos) ? parsed.equipos : [],
    partidos: Array.isArray(parsed.partidos) ? parsed.partidos : [],
    torneos: Array.isArray(parsed.torneos) ? parsed.torneos : [],
    arbitros: Array.isArray(parsed.arbitros) ? parsed.arbitros : [],
    representantes: Array.isArray(parsed.representantes) ? parsed.representantes : [],
    inscripciones: Array.isArray(parsed.inscripciones) ? parsed.inscripciones : []
  };
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function list(type, tenant_id) {
  const store = readStore();
  return store[type].filter((item) => item.tenant_id === tenant_id);
}

function insert(type, item) {
  const store = readStore();
  store[type].push(item);
  writeStore(store);
  return item;
}

function update(type, id, tenant_id, patch) {
  const store = readStore();
  const idx = store[type].findIndex((item) => item.id === id && item.tenant_id === tenant_id);
  if (idx === -1) return null;
  store[type][idx] = { ...store[type][idx], ...patch };
  writeStore(store);
  return store[type][idx];
}

function remove(type, id, tenant_id) {
  const store = readStore();
  const idx = store[type].findIndex((item) => item.id === id && item.tenant_id === tenant_id);
  if (idx === -1) return false;
  store[type].splice(idx, 1);
  writeStore(store);
  return true;
}

function replaceAll(type, tenant_id, items) {
  const store = readStore();
  store[type] = store[type].filter((item) => item.tenant_id !== tenant_id).concat(items);
  writeStore(store);
}

function getById(type, id, tenant_id) {
  const store = readStore();
  return store[type].find((item) => item.id === id && item.tenant_id === tenant_id) || null;
}

module.exports = {
  list,
  insert,
  update,
  remove,
  replaceAll,
  getById
};
