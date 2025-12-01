<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore' // ✅ Firestore araçları eklendi
import { auth, db } from '../firebase' // ✅ db eklendi
import { useToast } from 'vue-toastification'

const email = ref('')
const password = ref('')
const router = useRouter()
const toast = useToast()

async function login() {
  try {
    // 1. Giriş işlemini yap
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // 2. 🛠 ESKİ KULLANICI KONTROLÜ (Backfill)
    // Giriş yapan kullanıcının Firestore'da kaydı var mı diye bak
    const userDocRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userDocRef)

    // Eğer Firestore'da kaydı yoksa (Sistem güncellenmeden önce kayıt olmuşsa)
    // Hemen veritabanında kaydını oluştur.
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: user.email,
        role: 'user', // Varsayılan yetki
        createdAt: serverTimestamp(),
      })
      console.log('Eski kullanıcı veri tabanına eklendi.')
    }

    toast.success('Giriş başarılı 🎉')
    router.push('/terms')
  } catch (e) {
    toast.error(e.message)
  }
}
</script>

<template>
  <div class="flex flex-col justify-center items-center min-h-[80vh]">
    <div class="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm border border-gray-100">
      <h1 class="text-xl font-bold text-center mb-4">Giriş Yap</h1>

      <form @submit.prevent="login" class="space-y-3">
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
          placeholder="Şifre"
          class="border p-2 w-full rounded"
          required
        />
        <button
          type="submit"
          class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700 transition"
        >
          Giriş Yap
        </button>
      </form>

      <p class="text-sm text-center mt-4">
        Hesabın yok mu?
        <router-link to="/register" class="text-blue-600 underline">Kayıt ol</router-link>
      </p>
    </div>
  </div>
</template>
