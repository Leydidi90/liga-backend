const supabase = require('../supabaseClient');
const fileStore = require('./localLeagueDataStore');

const useLocalDevMode = String(process.env.LOCAL_DEV_MODE || 'false').toLowerCase() === 'true';

const TYPE_TO_TABLE = {
  equipos: 'equipo',
  partidos: 'partido',
  torneos: 'torneo',
  arbitros: 'arbitro',
  canchas: 'cancha',
  representantes: 'representante',
  inscripciones: 'inscripcion',
  multas: 'multa'
};

function tableFor(type) {
  const table = TYPE_TO_TABLE[type];
  if (!table) throw new Error(`Tipo de datos desconocido: ${type}`);
  return table;
}

async function list(type, tenant_id) {
  if (useLocalDevMode) return fileStore.list(type, tenant_id);
  const { data, error } = await supabase
    .from(tableFor(type))
    .select('*')
    .eq('tenant_id', tenant_id);
  if (error) throw error;
  return data || [];
}

async function getById(type, id, tenant_id) {
  if (useLocalDevMode) return fileStore.getById(type, id, tenant_id);
  const { data, error } = await supabase
    .from(tableFor(type))
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant_id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insert(type, item) {
  if (useLocalDevMode) return fileStore.insert(type, item);
  const { data, error } = await supabase
    .from(tableFor(type))
    .insert([item])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(type, id, tenant_id, patch) {
  if (useLocalDevMode) return fileStore.update(type, id, tenant_id, patch);
  const { data, error } = await supabase
    .from(tableFor(type))
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenant_id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function remove(type, id, tenant_id) {
  if (useLocalDevMode) return fileStore.remove(type, id, tenant_id);
  const { error, count } = await supabase
    .from(tableFor(type))
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('tenant_id', tenant_id);
  if (error) throw error;
  return (count || 0) > 0;
}

async function replaceAll(type, tenant_id, items) {
  if (useLocalDevMode) return fileStore.replaceAll(type, tenant_id, items);
  const table = tableFor(type);
  const { error: deleteError } = await supabase.from(table).delete().eq('tenant_id', tenant_id);
  if (deleteError) throw deleteError;
  if (!items.length) return;
  const batchSize = 200;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

module.exports = {
  list,
  getById,
  insert,
  update,
  remove,
  replaceAll,
  isLocalMode: () => useLocalDevMode
};
