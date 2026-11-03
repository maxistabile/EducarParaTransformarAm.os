import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Home from './Home'
import Login from './Login'
import AdminPanel from './AdminPanel'
import StudentPortal from './StudentPortal'
import NoticiaDetalle from './NoticiaDetalle'

// Parte 3 · PWA: se carga aparte para no agrandar el bundle de la web
const AppRoutes = lazy(() => import('./app/AppRoutes'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/noticias/:id' element={<NoticiaDetalle />} />
        <Route path='/login' element={<Login />} />
        <Route path='/admin' element={<AdminPanel />} />
        <Route path='/portal' element={<StudentPortal />} />
        <Route
          path='/app/*'
          element={
            <Suspense fallback={null}>
              <AppRoutes />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
