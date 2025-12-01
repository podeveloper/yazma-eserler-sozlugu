<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { db, auth } from '../firebase'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { useToast } from 'vue-toastification'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// 🔹 Google Sheet CSV Linki
const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSlFgY0IfnIu_eJSWAQwI1qj3_BATTGqsO_MGdaLD-KVc-3dQUkfWqKjYtdLqRAvcGQ1vVJKTgP4Gr/pub?gid=0&single=true&output=csv'

const toast = useToast()
const terms = ref([])
const search = ref('')
const showModal = ref(false)
const sortOption = ref('az')
const isAdmin = ref(false)
const fileInput = ref(null)
const isImporting = ref(false)
const isDeletingAll = ref(false)

// 🔍 FİLTRE DEĞİŞKENLERİ
const filterContributor = ref('')
const filterBookAuthor = ref('')
const filterBookTitle = ref('')
const filterType = ref('')

// Düzenleme State
const editingId = ref(null)
const editWord = ref('')
const editDefinition = ref('')
const editBookAuthor = ref('')
const editBookTitle = ref('')
const editType = ref('')
const editPage = ref('')

// Yeni Terim State
const newWord = ref('')
const newDefinition = ref('')
const newBookAuthor = ref('')
const newBookTitle = ref('')
const newType = ref('')
const newPage = ref('')

// Tooltip
const visibleInfo = ref(null)
let infoTimer = null

const handleOpenModal = () => {
  showModal.value = true
}

onMounted(async () => {
  const q = query(collection(db, 'terms'), orderBy('createdAt', 'desc'))
  onSnapshot(q, (snapshot) => {
    terms.value = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    applySort()
  })

  const user = auth.currentUser
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        isAdmin.value = true
      }
    } catch (e) {
      console.error(e)
    }
  }
  window.addEventListener('openModal', handleOpenModal)
})

onUnmounted(() => {
  window.removeEventListener('openModal', handleOpenModal)
})

// 🛠 YARDIMCI: Metin Normalizasyonu
function normalizeText(text) {
  if (!text) return ''
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// 🛠 YARDIMCI: Levenshtein
function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null))
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const indicator = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + indicator,
      )
    }
  }
  return matrix[b.length][a.length]
}

// 🔄 Sıralama
function applySort() {
  if (sortOption.value === 'newest')
    terms.value.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
  else if (sortOption.value === 'oldest')
    terms.value.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds)
  else if (sortOption.value === 'az')
    terms.value.sort((a, b) => a.word.localeCompare(b.word, 'tr', { sensitivity: 'base' }))
  else if (sortOption.value === 'za')
    terms.value.sort((a, b) => b.word.localeCompare(a.word, 'tr', { sensitivity: 'base' }))
}

// 🔍 FİLTRELEME
const filtered = computed(() => {
  let result = terms.value
  if (filterContributor.value) result = result.filter((t) => t.author === filterContributor.value)
  if (filterBookAuthor.value) result = result.filter((t) => t.bookAuthor === filterBookAuthor.value)
  if (filterBookTitle.value) result = result.filter((t) => t.bookTitle === filterBookTitle.value)
  if (filterType.value) result = result.filter((t) => t.type === filterType.value)

  const s = normalizeText(search.value)
  if (!s) return result

  return result.filter((t) => {
    const w = normalizeText(t.word)
    const d = normalizeText(t.definition)
    if (w.includes(s) || d.includes(s)) return true
    if (s.length > 3 && Math.abs(w.length - s.length) < 3) {
      if (levenshtein(s, w) <= 2) return true
    }
    return false
  })
})

const uniqueContributors = computed(() =>
  [...new Set(terms.value.map((t) => t.author).filter(Boolean))].sort(),
)
const uniqueBookAuthors = computed(() =>
  [...new Set(terms.value.map((t) => t.bookAuthor).filter(Boolean))].sort(),
)
const uniqueBookTitles = computed(() =>
  [...new Set(terms.value.map((t) => t.bookTitle).filter(Boolean))].sort(),
)
const uniqueTypes = computed(() =>
  [...new Set(terms.value.map((t) => t.type).filter(Boolean))].sort(),
)

// CRUD
function startEdit(term) {
  editingId.value = term.id
  editWord.value = term.word
  editDefinition.value = term.definition
  editBookAuthor.value = term.bookAuthor || ''
  editBookTitle.value = term.bookTitle || ''
  editType.value = term.type || ''
  editPage.value = term.page || ''
}

async function saveEdit(termId, uploader) {
  const user = auth.currentUser
  if (!user || (!isAdmin.value && user.email !== uploader)) return toast.warning('Yetkiniz yok.')
  await updateDoc(doc(db, 'terms', termId), {
    word: editWord.value.trim(),
    definition: editDefinition.value.trim(),
    bookAuthor: editBookAuthor.value.trim(),
    bookTitle: editBookTitle.value.trim(),
    type: editType.value.trim(),
    page: editPage.value.trim(),
  })
  editingId.value = null
  toast.success('Güncellendi')
}

async function deleteTerm(termId, uploader) {
  const user = auth.currentUser
  if (!user || (!isAdmin.value && user.email !== uploader)) return toast.warning('Yetkiniz yok.')
  if (!confirm('Silinsin mi?')) return
  await deleteDoc(doc(db, 'terms', termId))
  toast.success('Silindi')
}

async function addTerm() {
  const user = auth.currentUser
  if (!user) return toast.error('Giriş yapın')
  if (!newWord.value || !newDefinition.value) return toast.warning('Kelime ve Tanım zorunlu.')

  await addDoc(collection(db, 'terms'), {
    word: newWord.value.trim(),
    definition: newDefinition.value.trim(),
    bookAuthor: newBookAuthor.value.trim(),
    bookTitle: newBookTitle.value.trim(),
    type: newType.value.trim(),
    page: newPage.value.trim(),
    author: user.email,
    createdAt: serverTimestamp(),
  })
  toast.success('Eklendi')
  showModal.value = false
  newWord.value = ''
  newDefinition.value = ''
  newBookAuthor.value = ''
  newBookTitle.value = ''
  newType.value = ''
  newPage.value = ''
}

async function exportToExcel() {
  if (!terms.value.length) return toast.warning('Veri yok.')
  const data = terms.value.map((t) => ({
    Kelime: t.word,
    Açıklama: t.definition,
    Kaynak: t.bookTitle || '',
    Sayfa: t.page || '',
    Tür: t.type || '',
    Yazar: t.bookAuthor || '',
    Ekleyen: t.author,
    Tarih: t.createdAt ? new Date(t.createdAt.toDate()).toLocaleDateString('tr-TR') : '-',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Terimler')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'terimler_v3.xlsx')
}

async function fetchFromGoogleSheet() {
  if (
    !confirm(
      'Google Sheet ile senkronize edilecek.\nSütunlar: Kelime, Açıklama, Kaynak, Sayfa, Tür, Yazar, Ekleyen',
    )
  )
    return
  isImporting.value = true
  const user = auth.currentUser
  try {
    const existingTermsMap = new Map()
    const snapshot = await getDocs(collection(db, 'terms'))
    snapshot.forEach((doc) => {
      const d = doc.data()
      if (d.word) existingTermsMap.set(normalizeText(d.word), doc.id)
    })
    const response = await fetch(GOOGLE_SHEET_CSV_URL)
    const csvText = await response.text()
    const workbook = XLSX.read(csvText, { type: 'string' })
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    let updated = 0,
      added = 0
    for (const row of jsonData) {
      const rawWord = row['Kelime']
      const definition = row['Açıklama']
      if (!rawWord || !definition) continue
      const termData = {
        definition: String(definition).trim(),
        bookTitle: row['Kaynak'] ? String(row['Kaynak']).trim() : '',
        page: row['Sayfa'] ? String(row['Sayfa']).trim() : '',
        type: row['Tür'] ? String(row['Tür']).trim() : '',
        bookAuthor: row['Yazar'] ? String(row['Yazar']).trim() : '',
      }
      const uploader = row['Ekleyen'] || user.email
      const wordKey = normalizeText(String(rawWord))

      if (existingTermsMap.has(wordKey)) {
        await updateDoc(doc(db, 'terms', existingTermsMap.get(wordKey)), termData)
        updated++
      } else {
        await addDoc(collection(db, 'terms'), {
          word: String(rawWord).trim(),
          ...termData,
          author: uploader,
          createdAt: serverTimestamp(),
        })
        added++
      }
    }
    toast.success(`Eşleşme Tamam!\n➕ ${added} Yeni\n✏️ ${updated} Güncel`)
  } catch (e) {
    console.error(e)
    toast.error(e.message)
  } finally {
    isImporting.value = false
  }
}

async function deleteAllTerms() {
  if (!isAdmin.value || !confirm('HER ŞEY SİLİNECEK!')) return
  isDeletingAll.value = true
  try {
    const qs = await getDocs(collection(db, 'terms'))
    const batch = writeBatch(db)
    qs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    toast.success('Temizlendi')
  } catch (e) {
    toast.error(e.message)
  } finally {
    isDeletingAll.value = false
  }
}

function triggerFileInput() {
  fileInput.value.click()
}
async function handleFileUpload(event) {
  toast.info('Sheet Sync kullanınız.')
}
function toggleInfo(id) {
  if (visibleInfo.value === id) {
    visibleInfo.value = null
    clearTimeout(infoTimer)
  } else {
    visibleInfo.value = id
    clearTimeout(infoTimer)
    infoTimer = setTimeout(() => (visibleInfo.value = null), 4000)
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6 min-h-screen">
    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5">
      <div class="flex flex-wrap justify-between items-center gap-3">
        <div class="flex items-center gap-2">
          <button @click="exportToExcel" class="btn-secondary">📊 Excel</button>
          <div v-if="isAdmin" class="flex gap-2">
            <button @click="fetchFromGoogleSheet" :disabled="isImporting" class="btn-primary-soft">
              {{ isImporting ? '⏳ İşleniyor...' : '☁️ Sheet Sync' }}
            </button>
            <button @click="deleteAllTerms" :disabled="isDeletingAll" class="btn-danger-soft">
              🗑️
            </button>
          </div>
        </div>
        <div class="w-full md:w-48">
          <select v-model="sortOption" @change="applySort" class="form-select">
            <option value="az">🔤 A–Z</option>
            <option value="za">🔡 Z–A</option>
            <option value="newest">📅 En Yeni</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div class="md:col-span-1">
          <input v-model="search" placeholder="🔍 Ara..." class="form-input" />
        </div>
        <div>
          <select v-model="filterContributor" class="form-select text-xs">
            <option value="">👤 Ekleyen: Tümü</option>
            <option v-for="c in uniqueContributors" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <select v-model="filterBookAuthor" class="form-select text-xs">
            <option value="">✍️ Yazar: Tümü</option>
            <option v-for="a in uniqueBookAuthors" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div>
          <select v-model="filterBookTitle" class="form-select text-xs">
            <option value="">📖 Kaynak: Tümü</option>
            <option v-for="t in uniqueBookTitles" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div>
          <select v-model="filterType" class="form-select text-xs">
            <option value="">🏷️ Tür: Tümü</option>
            <option v-for="t in uniqueTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>
    </div>

    <ul class="space-y-4">
      <li
        v-for="term in filtered"
        :key="term.id"
        class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition group"
      >
        <div v-if="editingId === term.id" class="space-y-3 animate-fadeIn">
          <input v-model="editWord" class="form-input font-bold" placeholder="Kelime" />
          <textarea v-model="editDefinition" class="form-input h-24" placeholder="Tanım"></textarea>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input v-model="editBookTitle" class="form-input" placeholder="Kaynak (Eser)" />
            <input v-model="editType" class="form-input" placeholder="Tür" />
            <input v-model="editBookAuthor" class="form-input" placeholder="Yazar" />
            <input v-model="editPage" class="form-input" placeholder="Sayfa" />
          </div>

          <div class="flex justify-end gap-2">
            <button @click="editingId = null" class="btn-secondary">İptal</button>
            <button @click="saveEdit(term.id, term.author)" class="btn-primary">Kaydet</button>
          </div>
        </div>

        <div v-else>
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-xl font-bold text-gray-800">{{ term.word }}</h2>
              <p class="text-gray-600 mt-2 whitespace-pre-line leading-relaxed">
                {{ term.definition }}
              </p>
            </div>

            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                v-if="isAdmin || auth.currentUser?.email === term.author"
                @click="startEdit(term)"
                class="action-btn text-blue-500 bg-blue-50"
              >
                🖊️
              </button>
              <button
                v-if="isAdmin || auth.currentUser?.email === term.author"
                @click="deleteTerm(term.id, term.author)"
                class="action-btn text-red-500 bg-red-50"
              >
                🗑️
              </button>
            </div>
          </div>

          <div
            class="mt-4 pt-3 border-t border-gray-50 flex flex-wrap justify-between items-center text-xs text-gray-500"
          >
            <div class="flex items-center flex-wrap gap-2">
              <span
                v-if="term.bookAuthor"
                class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100"
              >
                ✍️ {{ term.bookAuthor }}
              </span>

              <span
                v-if="term.bookTitle"
                class="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 italic"
              >
                📖 {{ term.bookTitle }}
              </span>

              <span
                v-if="term.type"
                class="uppercase font-bold tracking-wider text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100"
              >
                {{ term.type }}
              </span>

              <span v-if="term.page" class="text-gray-400">s.{{ term.page }}</span>
            </div>

            <div class="relative">
              <button
                @click="toggleInfo(term.id)"
                class="hover:text-blue-600 transition flex items-center gap-1"
              >
                👤 {{ term.author }}
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="!filtered.length" class="text-center py-10 text-gray-400">Bulunamadı.</div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]"
      @click.self="showModal = false"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-fadeIn mx-4"
      >
        <h2 class="text-xl font-bold text-gray-800">Yeni Ekle</h2>

        <input v-model="newWord" class="form-input font-semibold" placeholder="Kelime *" />
        <textarea v-model="newDefinition" class="form-input h-24" placeholder="Tanım *"></textarea>

        <div class="grid grid-cols-2 gap-3">
          <input v-model="newBookTitle" class="form-input" placeholder="Kaynak (Eser)" />
          <input v-model="newType" class="form-input" placeholder="Tür" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <input v-model="newBookAuthor" class="form-input" placeholder="Yazar" />
          <input v-model="newPage" class="form-input" placeholder="Sayfa No" />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button @click="showModal = false" class="btn-secondary">Vazgeç</button>
          <button @click="addTerm" class="btn-primary">Kaydet</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Utility Sınıfları */
.form-input {
  @apply border border-gray-200 rounded-lg p-3 w-full focus:ring-2 focus:ring-blue-100 outline-none transition text-sm;
}
.form-select {
  @apply border border-gray-200 rounded-lg p-2.5 w-full bg-white focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer;
}
.btn-primary {
  @apply bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm;
}
.btn-primary-soft {
  @apply bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-100 transition;
}
.btn-secondary {
  @apply text-gray-600 bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 transition;
}
.btn-danger-soft {
  @apply bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 transition;
}
.action-btn {
  @apply p-2 rounded-full transition shadow-sm border border-transparent hover:border-gray-100;
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
