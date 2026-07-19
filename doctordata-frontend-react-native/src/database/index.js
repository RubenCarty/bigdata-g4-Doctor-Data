import { open } from '@op-engineering/op-sqlite'
import { SCHEMA_STATEMENTS } from './schema'

const DB_NAME = 'doctordata.db'
const ENCRYPTION_KEY = process.env.EXPO_PUBLIC_DB_ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('EXPO_PUBLIC_DB_ENCRYPTION_KEY no está definida en el .env')
}

let _db = null

/**
 * Devuelve la instancia singleton de la base de datos SQLCipher.
 * La primera llamada abre la DB y ejecuta el schema (CREATE IF NOT EXISTS).
 */
export function getDatabase() {
  if (!_db) {
    _db = open({
      name: DB_NAME,
      encryptionKey: ENCRYPTION_KEY,
    })
    initSchema(_db)
  }
  return _db
}

export function closeDatabase() {
  if (_db) {
    _db.close()
    _db = null
  }
}

/**
 * Ejecuta todos los CREATE TABLE / CREATE INDEX del schema.
 * Idempotente gracias a IF NOT EXISTS.
 */
function initSchema(db) {
  for (const statement of SCHEMA_STATEMENTS) {
    db.execute(statement)
  }
}
