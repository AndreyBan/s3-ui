import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createReadStream, statSync } from 'node:fs'
import { basename } from 'node:path'
import { Readable } from 'node:stream'
import { contentTypeFor } from './mime'
import type {
  ListResult,
  ObjectInfo,
  S3ObjectItem,
  S3PrefixItem,
  S3Profile,
} from '../shared/types'

const DELIMITER = '/'
const PAGE_SIZE = 200

// Кэш клиентов по id профиля, чтобы не пересоздавать на каждый запрос.
const clientCache = new Map<string, { client: S3Client; signature: string }>()

function signatureOf(p: S3Profile): string {
  return [p.endpoint, p.region, p.accessKeyId, p.secretAccessKey, p.forcePathStyle].join('|')
}

export function getClient(profile: S3Profile): S3Client {
  const cached = clientCache.get(profile.id)
  const sig = signatureOf(profile)
  if (cached && cached.signature === sig) return cached.client

  const client = new S3Client({
    region: profile.region || 'us-east-1',
    endpoint: profile.endpoint || undefined,
    forcePathStyle: profile.forcePathStyle,
    credentials: {
      accessKeyId: profile.accessKeyId,
      secretAccessKey: profile.secretAccessKey,
    },
  })
  clientCache.set(profile.id, { client, signature: sig })
  return client
}

export function invalidateClient(profileId: string): void {
  clientCache.delete(profileId)
}

function nameFromKey(key: string): string {
  const trimmed = key.endsWith(DELIMITER) ? key.slice(0, -1) : key
  const idx = trimmed.lastIndexOf(DELIMITER)
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

function mapObject(o: _Object): S3ObjectItem {
  const key = o.Key ?? ''
  return {
    key,
    name: nameFromKey(key),
    size: o.Size ?? 0,
    lastModified: o.LastModified ? o.LastModified.getTime() : null,
    etag: o.ETag?.replace(/"/g, ''),
  }
}

/** Листинг «папки»: один префикс, разбитый по DELIMITER. */
export async function list(
  profile: S3Profile,
  prefix: string,
  continuationToken?: string | null,
): Promise<ListResult> {
  const client = getClient(profile)
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: profile.bucket,
      Prefix: prefix || undefined,
      Delimiter: DELIMITER,
      MaxKeys: PAGE_SIZE,
      ContinuationToken: continuationToken || undefined,
    }),
  )

  const folders: S3PrefixItem[] = (res.CommonPrefixes ?? [])
    .map((cp) => cp.Prefix ?? '')
    .filter(Boolean)
    .map((p) => ({ prefix: p, name: nameFromKey(p) }))

  const files: S3ObjectItem[] = (res.Contents ?? [])
    // Пропускаем сам объект-маркер папки (ключ == текущий префикс).
    .filter((o) => o.Key && o.Key !== prefix)
    .map(mapObject)

  return {
    prefix,
    folders,
    files,
    continuationToken: res.NextContinuationToken ?? null,
    isTruncated: Boolean(res.IsTruncated),
  }
}

/** Собрать ВСЕ ключи под префиксом (для рекурсивного удаления/конвертации). */
export async function listAllKeys(profile: S3Profile, prefix: string): Promise<string[]> {
  const client = getClient(profile)
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: profile.bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )
    for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key)
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

export async function createFolder(profile: S3Profile, prefix: string): Promise<void> {
  const key = prefix.endsWith(DELIMITER) ? prefix : prefix + DELIMITER
  await getClient(profile).send(
    new PutObjectCommand({ Bucket: profile.bucket, Key: key, Body: '' }),
  )
}

/** Удаление списка ключей батчами по 1000 (лимит DeleteObjects). */
export async function deleteObjects(profile: S3Profile, keys: string[]): Promise<number> {
  const client = getClient(profile)
  let deleted = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: profile.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    )
    deleted += batch.length - (res.Errors?.length ?? 0)
    if (res.Errors?.length) {
      throw new Error(`Не удалось удалить ${res.Errors.length} объект(ов): ${res.Errors[0]?.Message ?? ''}`)
    }
  }
  return deleted
}

/** Рекурсивное удаление «папки». */
export async function deletePrefix(profile: S3Profile, prefix: string): Promise<number> {
  const norm = prefix.endsWith(DELIMITER) ? prefix : prefix + DELIMITER
  const keys = await listAllKeys(profile, norm)
  if (keys.length === 0) return 0
  return deleteObjects(profile, keys)
}

export async function copyObject(
  profile: S3Profile,
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await getClient(profile).send(
    new CopyObjectCommand({
      Bucket: profile.bucket,
      CopySource: encodeURI(`${profile.bucket}/${sourceKey}`),
      Key: destKey,
    }),
  )
}

export async function moveObject(
  profile: S3Profile,
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await copyObject(profile, sourceKey, destKey)
  await deleteObjects(profile, [sourceKey])
}

export async function objectInfo(profile: S3Profile, key: string): Promise<ObjectInfo> {
  const res = await getClient(profile).send(
    new HeadObjectCommand({ Bucket: profile.bucket, Key: key }),
  )
  return {
    key,
    size: res.ContentLength ?? 0,
    contentType: res.ContentType,
    etag: res.ETag?.replace(/"/g, ''),
    lastModified: res.LastModified ? res.LastModified.getTime() : null,
    metadata: res.Metadata ?? {},
  }
}

export async function exists(profile: S3Profile, key: string): Promise<boolean> {
  try {
    await getClient(profile).send(new HeadObjectCommand({ Bucket: profile.bucket, Key: key }))
    return true
  } catch (e: any) {
    if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false
    throw e
  }
}

/** Есть ли хоть один объект под префиксом. HeadObject не видит «папки» без маркера. */
export async function prefixExists(profile: S3Profile, prefix: string): Promise<boolean> {
  const res = await getClient(profile).send(
    new ListObjectsV2Command({ Bucket: profile.bucket, Prefix: prefix, MaxKeys: 1 }),
  )
  return (res.KeyCount ?? res.Contents?.length ?? 0) > 0
}

/** Загрузка одного файла с диска в S3 с колбэком прогресса. */
export async function uploadFile(
  profile: S3Profile,
  filePath: string,
  key: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const total = statSync(filePath).size
  const upload = new Upload({
    client: getClient(profile),
    params: {
      Bucket: profile.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentTypeFor(key),
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024, // 8MB — multipart подключается автоматически для больших файлов
  })
  upload.on('httpUploadProgress', (p) => {
    onProgress?.(p.loaded ?? 0, p.total ?? total)
  })
  await upload.done()
}

/** Загрузка объекта из буфера в памяти (drag-and-drop). */
export async function uploadBuffer(
  profile: S3Profile,
  body: Buffer,
  key: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const upload = new Upload({
    client: getClient(profile),
    params: {
      Bucket: profile.bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(key),
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  })
  upload.on('httpUploadProgress', (p) => {
    onProgress?.(p.loaded ?? 0, p.total ?? body.length)
  })
  await upload.done()
}

export { basename }

/** Получить содержимое объекта как Buffer (для скачивания/предпросмотра). */
export async function getObjectBuffer(
  profile: S3Profile,
  key: string,
): Promise<{ buffer: Buffer; contentType?: string }> {
  const res = await getClient(profile).send(
    new GetObjectCommand({ Bucket: profile.bucket, Key: key }),
  )
  const stream = res.Body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return { buffer: Buffer.concat(chunks), contentType: res.ContentType }
}

export async function presignUrl(
  profile: S3Profile,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  return getSignedUrl(
    getClient(profile),
    new GetObjectCommand({ Bucket: profile.bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  )
}
