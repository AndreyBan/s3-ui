import type { S3Api } from '../../shared/types'

declare global {
  interface Window {
    s3Api: S3Api
  }
}

export {}
