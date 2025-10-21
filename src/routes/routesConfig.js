import { Inicio } from '@pages/Inicio'
import { Albums } from '@pages/Albums'
import { Instrumentos } from '@pages/Instrumentos'
import { Marcos } from '@pages/Marcos'
import { Buscador } from '@pages/Buscador'

export const routesConfig = [
  { id: 'inicio', index: true, element: <Inicio /> },
  { id: 'albums', path: 'albums', element: <Albums /> },
  { id: 'instrumentos', path: 'instrumentos', element: <Instrumentos /> },
  { id: 'marcos', path: 'marcos', element: <Marcos /> },
  { id: 'buscar', path: 'buscar', element: <Buscador /> },
]
