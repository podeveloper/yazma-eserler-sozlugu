import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth' // Bunu ekleyin

// Sayfalar
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Terms from '../views/Terms.vue'
import Admin from '../views/Admin.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/terms',
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
    },
    {
      path: '/register',
      name: 'register',
      component: Register,
    },
    {
      path: '/terms',
      name: 'terms',
      component: Terms,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: Admin,
      meta: { requiresAuth: true },
    },
  ],
})

// 🟢 Firebase'in oturum durumunu beklemesini sağlayan yardımcı fonksiyon
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      auth,
      (user) => {
        removeListener()
        resolve(user)
      },
      reject,
    )
  })
}

// 🔒 Güncellenmiş Auth Kontrolü
router.beforeEach(async (to, from, next) => {
  // auth.currentUser yerine, promise yapısını kullanıyoruz
  const user = await getCurrentUser()

  if (to.meta.requiresAuth && !user) {
    next('/login')
  } else {
    next()
  }
})

export default router
