<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { useToast } from 'vue-toastification'

const users = ref([])
const toast = useToast()
const loading = ref(true)

// Tüm kullanıcıları getir
async function fetchUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'))
    users.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (e) {
    toast.error('Kullanıcılar yüklenemedi: ' + e.message)
  } finally {
    loading.value = false
  }
}

// Rol değiştirme fonksiyonu
async function toggleRole(user) {
  const newRole = user.role === 'admin' ? 'user' : 'admin'

  try {
    // Firestore'u güncelle
    await updateDoc(doc(db, 'users', user.id), { role: newRole })

    // UI'ı güncelle (tekrar istek atmaya gerek yok)
    user.role = newRole

    if (newRole === 'admin') {
      toast.success(`${user.email} artık YÖNETİCİ 👑`)
    } else {
      toast.info(`${user.email} artık standart kullanıcı.`)
    }
  } catch (e) {
    toast.error('Yetki değiştirilemedi: ' + e.message)
  }
}

// Tarih formatlama (createdAt varsa)
function formatDate(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp.seconds * 1000).toLocaleDateString('tr-TR')
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">👥 Kullanıcı Yönetim Paneli</h1>
      <router-link to="/" class="text-blue-600 hover:underline">← Sözlüğe Dön</router-link>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-500">Kullanıcılar yükleniyor...</div>

    <div v-else class="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
      <table class="min-w-full leading-normal">
        <thead>
          <tr>
            <th
              class="px-5 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              Email
            </th>
            <th
              class="px-5 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              Kayıt Tarihi
            </th>
            <th
              class="px-5 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              Rol
            </th>
            <th
              class="px-5 py-3 border-b-2 border-gray-200 bg-gray-50 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50 transition">
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
              <div class="flex items-center">
                <div class="ml-3">
                  <p class="text-gray-900 whitespace-no-wrap font-medium">{{ user.email }}</p>
                  <p class="text-gray-400 text-xs">{{ user.id }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
              <p class="text-gray-900 whitespace-no-wrap">{{ formatDate(user.createdAt) }}</p>
            </td>
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
              <span
                class="relative inline-block px-3 py-1 font-semibold leading-tight rounded-full text-xs"
                :class="
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-900'
                    : 'bg-gray-100 text-gray-600'
                "
              >
                {{ user.role === 'admin' ? 'Yönetici' : 'Kullanıcı' }}
              </span>
            </td>
            <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
              <button
                @click="toggleRole(user)"
                class="px-3 py-1 rounded border text-xs font-medium transition active:scale-95"
                :class="
                  user.role === 'admin'
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                "
              >
                {{ user.role === 'admin' ? 'Yetkiyi Al' : 'Yönetici Yap' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
