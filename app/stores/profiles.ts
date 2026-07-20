import { defineStore } from 'pinia'
import type { S3ProfileInput, S3ProfileMeta } from '../../shared/types'
import { api, hasBridge, unwrap } from '../composables/useApi'

export const useProfilesStore = defineStore('profiles', {
  state: () => ({
    profiles: [] as S3ProfileMeta[],
    activeId: null as string | null,
    loaded: false,
  }),
  getters: {
    active: (s): S3ProfileMeta | null => s.profiles.find((p) => p.id === s.activeId) ?? null,
    hasProfiles: (s): boolean => s.profiles.length > 0,
  },
  actions: {
    async load() {
      if (!hasBridge()) {
        this.loaded = true
        return
      }
      this.profiles = await unwrap(api().listProfiles())
      this.activeId = await unwrap(api().getActiveProfileId())
      this.loaded = true
    },
    async save(input: S3ProfileInput, id?: string) {
      await unwrap(api().saveProfile(input, id))
      await this.load()
    },
    async remove(id: string) {
      await unwrap(api().deleteProfile(id))
      await this.load()
    },
    async setActive(id: string) {
      await unwrap(api().setActiveProfile(id))
      this.activeId = id
    },
    async clearAll() {
      await unwrap(api().clearAllProfiles())
      await this.load()
    },
    async test(input: S3ProfileInput) {
      await unwrap(api().testConnection(input))
    },
  },
})
