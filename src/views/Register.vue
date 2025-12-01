<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore' // Yeni eklenenler
import { auth, db } from '../firebase' // db'yi import etmeyi unutma
import { useToast } from 'vue-toastification'

const email = ref('')
const password = ref('')
const router = useRouter()
const toast = useToast()

async function register() {
  try {
    // 1. Firebase Authentication ile kullanıcı oluştur
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // 2. Firestore 'users' koleksiyonuna kullanıcıyı 'user' rolüyle kaydet
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      role: 'user', // Varsayılan olarak standart kullanıcı
      createdAt: serverTimestamp(),
    })

    toast.success('Kayıt başarılı! 🎉 Giriş yapıldı.')

    // Kayıt olunca Firebase otomatik giriş yaptığı için ana sayfaya yönlendiriyoruz
    router.push('/')
  } catch (e) {
    toast.error(e.message)
  }
}
</script>

<template>
  <div class="flex flex-col justify-center items-center min-h-[80vh]">
    <div class="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm border border-gray-100">
      <h1 class="text-xl font-bold text-center mb-4">Kayıt Ol</h1>

      <form @submit.prevent="register" class="space-y-3">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          class="border p-2 w-full rounded"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Şifre (en az 6 karakter)"
          class="border p-2 w-full rounded"
          required
        />
        <button
          type="submit"
          class="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700 transition"
        >
          Kayıt Ol
        </button>
      </form>

      <p class="text-sm text-center mt-4">
        Zaten hesabın var mı?
        <router-link to="/login" class="text-blue-600 underline">Giriş yap</router-link>
      </p>
    </div>
  </div>
</template>
