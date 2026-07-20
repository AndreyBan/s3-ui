<script setup lang="ts">
import type { S3ProfileMeta } from '../../shared/types'

const profiles = useProfilesStore()
const toast = useToast()
const { confirm } = useConfirm()

const showForm = ref(false)
const editTarget = ref<S3ProfileMeta | null>(null)

onMounted(() => {
  if (!profiles.loaded) profiles.load()
})

function openCreate() {
  editTarget.value = null
  showForm.value = true
}
function openEdit(p: S3ProfileMeta) {
  editTarget.value = p
  showForm.value = true
}
function onSaved() {
  showForm.value = false
  editTarget.value = null
}

async function remove(p: S3ProfileMeta) {
  const ok = await confirm({
    title: 'Удалить профиль?',
    message: `«${p.name}» будет удалён. Данные в хранилище не затрагиваются.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  await profiles.remove(p.id)
  toast.success('Профиль удалён')
}

async function setActive(p: S3ProfileMeta) {
  await profiles.setActive(p.id)
  toast.success('Профиль активирован')
}

async function clearAll() {
  const ok = await confirm({
    title: 'Удалить все профили?',
    message: 'Все сохранённые креды будут стёрты с этого устройства.',
    confirmLabel: 'Удалить всё',
    danger: true,
  })
  if (!ok) return
  await profiles.clearAll()
  toast.success('Все профили удалены')
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-3xl flex-col p-6">
    <header class="mb-6 flex items-center gap-3">
      <NuxtLink to="/" class="btn-ghost">← Назад</NuxtLink>
      <h1 class="text-xl font-bold">Профили подключения</h1>
      <div class="flex-1" />
      <button v-if="!showForm" class="btn-primary" @click="openCreate">+ Новый профиль</button>
    </header>

    <!-- Форма -->
    <div v-if="showForm" class="card mb-6 p-6">
      <h2 class="mb-4 text-lg font-semibold">
        {{ editTarget ? 'Редактирование профиля' : 'Новый профиль' }}
      </h2>
      <ProfileForm :edit="editTarget" @saved="onSaved" @cancel="showForm = false" />
    </div>

    <!-- Список -->
    <div v-else class="flex-1 space-y-3 overflow-auto">
      <div
        v-for="p in profiles.profiles"
        :key="p.id"
        class="card flex items-center gap-3 p-4"
      >
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: p.color || '#6366f1' }" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate font-medium">{{ p.name }}</span>
            <span
              v-if="p.id === profiles.activeId"
              class="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
            >активен</span>
          </div>
          <p class="truncate text-xs text-slate-500">
            {{ p.bucket }} · {{ p.region }}<span v-if="p.endpoint"> · {{ p.endpoint }}</span>
          </p>
        </div>
        <button v-if="p.id !== profiles.activeId" class="btn-ghost" @click="setActive(p)">Активировать</button>
        <button class="btn-ghost !px-2" title="Редактировать" @click="openEdit(p)">✎</button>
        <button class="btn-ghost !px-2" title="Удалить" @click="remove(p)">🗑</button>
      </div>

      <div v-if="profiles.loaded && !profiles.hasProfiles" class="card p-10 text-center text-slate-400">
        Профилей пока нет. Создайте первый.
      </div>

      <div v-if="profiles.hasProfiles" class="pt-4">
        <button class="text-sm text-rose-500 hover:underline" @click="clearAll">
          Удалить все профили
        </button>
      </div>
    </div>

    <p class="mt-4 text-xs text-slate-400">
      🔒 Секреты хранятся локально на этом устройстве и шифруются системным хранилищем ключей ОС
      (libsecret/Keychain/DPAPI). Ничего не отправляется на сторонние серверы.
    </p>
  </div>
</template>
