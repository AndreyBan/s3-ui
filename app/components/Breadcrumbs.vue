<script setup lang="ts">
const files = useFilesStore()

async function go(prefix: string) {
  await files.navigate(prefix)
}
</script>

<template>
  <nav class="flex flex-wrap items-center gap-1 text-sm">
    <template v-for="(crumb, i) in files.breadcrumbs" :key="crumb.prefix">
      <button
        class="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800"
        :class="i === files.breadcrumbs.length - 1 ? 'font-semibold' : 'text-slate-500'"
        @click="go(crumb.prefix)"
      >
        {{ crumb.name }}
      </button>
      <span v-if="i < files.breadcrumbs.length - 1" class="text-slate-400">/</span>
    </template>
  </nav>
</template>
