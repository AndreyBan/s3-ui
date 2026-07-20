<script setup lang="ts">
const profiles = useProfilesStore()
const files = useFilesStore()
const toast = useToast()
const open = ref(false)

async function choose(id: string) {
  open.value = false
  if (id === profiles.activeId) return
  try {
    await profiles.setActive(id)
    await files.navigate('')
    toast.success('Профиль переключён')
  } catch (e: any) {
    toast.error(e?.message ?? 'Не удалось переключить профиль')
  }
}

function onBlur() {
  // небольшая задержка, чтобы клик по пункту успел сработать
  setTimeout(() => (open.value = false), 150)
}
</script>

<template>
  <div class="relative">
    <button class="btn-ghost min-w-48 justify-between" @click="open = !open" @blur="onBlur">
      <span class="flex items-center gap-2 truncate">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full"
          :style="{ background: profiles.active?.color || '#6366f1' }"
        />
        <span class="truncate">{{ profiles.active?.name ?? 'Нет профиля' }}</span>
      </span>
      <span class="text-xs opacity-60">▾</span>
    </button>

    <div
      v-if="open"
      class="card absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden p-1"
    >
      <button
        v-for="p in profiles.profiles"
        :key="p.id"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        :class="{ 'bg-slate-100 dark:bg-slate-800': p.id === profiles.activeId }"
        @mousedown.prevent="choose(p.id)"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: p.color || '#6366f1' }" />
        <span class="flex-1 truncate">{{ p.name }}</span>
        <span v-if="p.id === profiles.activeId" class="text-xs text-indigo-500">активен</span>
      </button>
      <div v-if="!profiles.hasProfiles" class="px-3 py-2 text-sm text-slate-500">
        Профилей нет
      </div>
      <NuxtLink
        to="/profiles"
        class="mt-1 block border-t border-slate-200 px-3 py-2 text-sm text-indigo-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
        @mousedown.prevent="() => { open = false; navigateTo('/profiles') }"
      >
        ⚙ Управление профилями
      </NuxtLink>
    </div>
  </div>
</template>
