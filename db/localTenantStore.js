const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'local-tenants.json');

// Ligas demo/seed: siempre primero en listados (portal, dashboard, etc.)
const PINNED_SLUGS = ['eliminatoria-santa-ana', 'copa-dominguera', 'jocotitlan'];

function tenantSortRank(tenant) {
  const idx = PINNED_SLUGS.indexOf(tenant.subdominio_o_slug);
  return idx === -1 ? PINNED_SLUGS.length : idx;
}

function sortTenants(tenants) {
  return [...tenants].sort((a, b) => {
    const rankDiff = tenantSortRank(a) - tenantSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    const aa = new Date(a.fecha_registro).getTime();
    const bb = new Date(b.fecha_registro).getTime();
    return bb - aa;
  });
}

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ tenants: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw || '{"tenants":[]}');
  return Array.isArray(parsed.tenants) ? parsed : { tenants: [] };
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function getTenantBySlug(slug) {
  const store = readStore();
  return store.tenants.find((t) => t.subdominio_o_slug === slug) || null;
}

async function getTenantById(id) {
  const store = readStore();
  return store.tenants.find((t) => t.id === id) || null;
}

async function insertTenant(tenant) {
  const store = readStore();
  store.tenants.push(tenant);
  writeStore(store);
  return tenant;
}

async function listTenants() {
  const store = readStore();
  return sortTenants(store.tenants);
}

async function updateTenant(id, updates) {
  const store = readStore();
  const idx = store.tenants.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  store.tenants[idx] = { ...store.tenants[idx], ...updates };
  writeStore(store);
  return store.tenants[idx];
}

module.exports = {
  getTenantBySlug,
  getTenantById,
  insertTenant,
  listTenants,
  updateTenant,
  sortTenants,
  PINNED_SLUGS
};
