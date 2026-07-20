import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { S3Profile, S3ProfileInput, S3ProfileMeta } from '../shared/types'

// Формат хранения на диске: секреты каждого профиля зашифрованы через OS-хранилище
// (libsecret/Keychain/DPAPI). Если шифрование недоступно (например, нет keyring в системе),
// откатываемся на base64 c явной пометкой, чтобы UI мог предупредить пользователя.

interface StoredSecret {
  enc: boolean // true == зашифровано через safeStorage, false == просто base64
  value: string
}

interface StoredProfile extends S3ProfileMeta {
  accessKeyId: StoredSecret
  secretAccessKey: StoredSecret
}

interface StoreShape {
  version: 1
  activeProfileId: string | null
  profiles: StoredProfile[]
}

const EMPTY: StoreShape = { version: 1, activeProfileId: null, profiles: [] }

function storePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'profiles.json')
}

function readStore(): StoreShape {
  const p = storePath()
  if (!existsSync(p)) return { ...EMPTY }
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as StoreShape
    if (parsed?.version !== 1 || !Array.isArray(parsed.profiles)) return { ...EMPTY }
    return parsed
  } catch {
    return { ...EMPTY }
  }
}

function writeStore(data: StoreShape): void {
  writeFileSync(storePath(), JSON.stringify(data, null, 2), { mode: 0o600 })
}

function encryptSecret(value: string): StoredSecret {
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: true, value: safeStorage.encryptString(value).toString('base64') }
  }
  return { enc: false, value: Buffer.from(value, 'utf-8').toString('base64') }
}

function decryptSecret(secret: StoredSecret): string {
  if (secret.enc) {
    return safeStorage.decryptString(Buffer.from(secret.value, 'base64'))
  }
  return Buffer.from(secret.value, 'base64').toString('utf-8')
}

function toMeta(p: StoredProfile): S3ProfileMeta {
  return {
    id: p.id,
    name: p.name,
    endpoint: p.endpoint,
    region: p.region,
    bucket: p.bucket,
    forcePathStyle: p.forcePathStyle,
    color: p.color,
  }
}

/** Признак доступности OS-шифрования — для предупреждения в UI. */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** Список профилей без секретов. */
export function listProfiles(): S3ProfileMeta[] {
  return readStore().profiles.map(toMeta)
}

export function getActiveProfileId(): string | null {
  return readStore().activeProfileId
}

export function setActiveProfile(id: string): void {
  const store = readStore()
  if (!store.profiles.some((p) => p.id === id)) {
    throw new Error('Профиль не найден')
  }
  store.activeProfileId = id
  writeStore(store)
}

/** Полный профиль с расшифрованными секретами — только для использования внутри main. */
export function getFullProfile(id: string): S3Profile | null {
  const p = readStore().profiles.find((x) => x.id === id)
  if (!p) return null
  return {
    ...toMeta(p),
    accessKeyId: decryptSecret(p.accessKeyId),
    secretAccessKey: decryptSecret(p.secretAccessKey),
  }
}

export function getActiveProfile(): S3Profile | null {
  const id = getActiveProfileId()
  return id ? getFullProfile(id) : null
}

/** Создать (id не передан) или обновить (id передан) профиль. Возвращает мету. */
export function saveProfile(input: S3ProfileInput, id?: string): S3ProfileMeta {
  const store = readStore()
  const existing = id ? store.profiles.find((p) => p.id === id) : undefined

  // При редактировании пустое поле секрета означает «оставить прежнее значение».
  const accessKeyId = input.accessKeyId
    ? encryptSecret(input.accessKeyId)
    : existing?.accessKeyId ?? encryptSecret('')
  const secretAccessKey = input.secretAccessKey
    ? encryptSecret(input.secretAccessKey)
    : existing?.secretAccessKey ?? encryptSecret('')

  const stored: StoredProfile = {
    id: id ?? randomUUID(),
    name: input.name,
    endpoint: input.endpoint?.trim() || undefined,
    region: input.region,
    bucket: input.bucket,
    forcePathStyle: input.forcePathStyle,
    color: input.color,
    accessKeyId,
    secretAccessKey,
  }

  const idx = store.profiles.findIndex((p) => p.id === stored.id)
  if (idx >= 0) store.profiles[idx] = stored
  else store.profiles.push(stored)

  // Первый созданный профиль автоматически становится активным.
  if (!store.activeProfileId) store.activeProfileId = stored.id

  writeStore(store)
  return toMeta(stored)
}

export function deleteProfile(id: string): void {
  const store = readStore()
  store.profiles = store.profiles.filter((p) => p.id !== id)
  if (store.activeProfileId === id) {
    store.activeProfileId = store.profiles[0]?.id ?? null
  }
  writeStore(store)
}

export function clearAllProfiles(): void {
  writeStore({ ...EMPTY })
}
