<script setup>
import { ref, onMounted } from 'vue'
import { auth } from './firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = ref(null)

// Kullanıcıyı dinle
onMounted(() => {
  onAuthStateChanged(auth, (u) => (user.value = u))
})

// Çıkış
async function logout() {
  await signOut(auth)
  router.push('/login')
}

// 🟢 Modal açma eventi (global)
function emitOpenModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('openModal'))
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 text-gray-800">
    <!-- Üst Bar -->
    <header
      v-if="user"
      class="sticky top-0 z-20 bg-white border-b shadow-sm flex items-center justify-between px-4 py-3 md:px-6 md:py-4"
    >
      <h1 class="font-semibold text-base md:text-lg truncate tracking-tight">
        📚 Terimler Sözlüğü
      </h1>

      <div class="flex items-center gap-3">
        <span class="hidden sm:inline text-xs md:text-sm text-gray-600 truncate max-w-[180px]">
          {{ user.email }}
        </span>

        <button
          @click="logout"
          class="flex items-center gap-1 bg-red-500 text-white text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-red-600 transition active:scale-[0.97]"
          title="Çıkış Yap"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 md:w-5 md:h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
          <span class="hidden sm:inline">Çıkış</span>
        </button>
      </div>
    </header>

    <!-- İçerik -->
    <main class="flex-1 p-4 md:p-6 relative">
      <router-view />
    </main>

    <!-- 🟢 Floating Add Button -->
    <button
      v-if="user"
      @click="emitOpenModal"
      class="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl w-16 h-16 flex items-center justify-center text-4xl z-[9999]"
      title="Yeni terim ekle"
    >
      ＋
    </button>
  </div>
</template>
