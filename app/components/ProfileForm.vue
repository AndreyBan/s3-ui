<script setup lang="ts">
import type { S3ProfileInput, S3ProfileMeta } from '../../shared/types'

const props = defineProps<{ edit?: S3ProfileMeta | null }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const profiles = useProfilesStore()
const toast = useToast()

const isEdit = computed(() => !!props.edit)

const form = reactive<S3ProfileInput>({
  name: props.edit?.name ?? '',
  endpoint: props.edit?.endpoint ?? 'https://storage.yandexcloud.net',
  region: props.edit?.region ?? 'ru-central1',
  accessKeyId: '',
  secretAccessKey: '',
  bucket: props.edit?.bucket ?? '',
  forcePathStyle: props.edit?.forcePathStyle ?? false,
  color: props.edit?.color ?? '#6366f1',
})

const testing = ref(false)
const saving = ref(false)
const showSecret = ref(false)

const valid = computed(
  () =>
    form.name.trim() &&
    form.region.trim() &&
    form.bucket.trim() &&
    // при создании креды обязательны; при редактировании можно оставить пустыми
    (isEdit.value || (form.accessKeyId.trim() && form.secretAccessKey.trim())),
)

async function test() {
  testing.value = true
  try {
    await profiles.test({ ...form })
    toast.success('Соединение успешно ✓')
  } catch (e: any) {
    toast.error(e?.message ?? 'Не удалось подключиться')
  } finally {
    testing.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await profiles.save({ ...form }, props.edit?.id)
    toast.success(isEdit.value ? 'Профиль обновлён' : 'Профиль создан')
    emit('saved')
  } catch (e: any) {
    toast.error(e?.message ?? 'Ошибка сохранения')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <div class="grid grid-cols-2 gap-4">
      <label class="col-span-2 block">
        <span class="mb-1 block text-xs font-medium text-slate-500">Название профиля *</span>
        <input v-model="form.name" class="input" placeholder="Мой MinIO" />
      </label>

      <label class="col-span-2 block">
        <span class="mb-1 block text-xs font-medium text-slate-500">Endpoint</span>
        <input v-model="form.endpoint" class="input" placeholder="https://storage.yandexcloud.net" />
        <span class="mt-1 block text-xs text-slate-400">Пусто для AWS S3. Укажите для MinIO / R2 / Yandex.</span>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">Region *</span>
        <input v-model="form.region" class="input" placeholder="us-east-1" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">Bucket *</span>
        <input v-model="form.bucket" class="input" placeholder="my-bucket" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">
          Access Key ID {{ isEdit ? '(пусто = не менять)' : '*' }}
        </span>
        <input v-model="form.accessKeyId" class="input" autocomplete="off" :placeholder="isEdit ? '••••••••' : ''" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">
          Secret Access Key {{ isEdit ? '(пусто = не менять)' : '*' }}
        </span>
        <div class="relative">
          <input
            v-model="form.secretAccessKey"
            :type="showSecret ? 'text' : 'password'"
            class="input pr-10"
            autocomplete="off"
            :placeholder="isEdit ? '••••••••' : ''"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            @click="showSecret = !showSecret"
          >
            {{ showSecret ? '🙈' : '👁' }}
          </button>
        </div>
      </label>

      <label class="flex items-center gap-2">
        <input v-model="form.forcePathStyle" type="checkbox" />
        <span class="text-sm">Path-style URL <span class="text-slate-400">(нужно для MinIO)</span></span>
      </label>

      <label class="flex items-center gap-2">
        <span class="text-sm">Цвет метки</span>
        <input v-model="form.color" type="color" class="h-8 w-12 rounded border-0 bg-transparent" />
      </label>
    </div>

    <div class="flex items-center gap-2 pt-2">
      <button type="button" class="btn-ghost" :disabled="testing" @click="test">
        {{ testing ? 'Проверка…' : '🔌 Тест соединения' }}
      </button>
      <div class="flex-1" />
      <button type="button" class="btn-ghost" @click="emit('cancel')">Отмена</button>
      <button type="submit" class="btn-primary" :disabled="!valid || saving">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>
  </form>
</template>
