import { createElement } from 'react'

import { Inicio } from '@pages/Inicio'
import { Albums } from '@pages/Albums'
import { Instrumentos } from '@pages/Instrumentos'
import { Marcos } from '@pages/Marcos'
import { Buscador } from '@pages/Buscador'
import { Productos } from '@pages/ProductoInstrumentos'

const withElement = (Component, config) => ({ ...config, element: createElement(Component) })

export const routesConfig = [
  withElement(Inicio, { id: 'inicio', index: true }),
  withElement(Albums, { id: 'albums', path: 'albums' }),
  withElement(Instrumentos, { id: 'instrumentos', path: 'instrumentos' }),
  withElement(Marcos, { id: 'marcos', path: 'marcos' }),
  withElement(Buscador, { id: 'buscar', path: 'buscar' }),
  withElement(Productos, { id: 'producto-instrumentos', path: 'productos' }),
]
