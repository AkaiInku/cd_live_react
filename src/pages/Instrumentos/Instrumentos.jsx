import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import './Instrumentos.css'

import { instrumentos } from '@data/instrumentos'
import { obtenerAsset } from '@data/obtenerAsset'
import { BottonComprar } from '@components/common/BottonComprar/BottonComprar'
import { ProductCard } from '@components/common/ProductCard/ProductCard'

const categorias = [
  { id: 'cuerda', nombre: 'Cuerda', imagen: obtenerAsset('img/instrumentos/LogoCuerda.png') },
  { id: 'viento', nombre: 'Viento', imagen: obtenerAsset('img/instrumentos/LogoViento.png') },
  { id: 'percusion', nombre: 'Percusión', imagen: obtenerAsset('img/instrumentos/LogoPercusion.png') },
  { id: 'electricos', nombre: 'Electrónicos', imagen: obtenerAsset('img/instrumentos/LogoElectricos.png') },
]

function formatearPrecio(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function Instrumentos() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)

  const listaFiltrada = useMemo(() => {
    if (!categoriaSeleccionada) {
      return instrumentos
    }
    return instrumentos.filter((item) => {
      if (Array.isArray(item.categoria)) {
        return item.categoria.includes(categoriaSeleccionada)
      }
      return item.categoria === categoriaSeleccionada
    })
  }, [categoriaSeleccionada])

  return (
    <div className="paginaInstrumentos">
      <section className="productos">
        <div className="titulo">
          <h1>Instrumentos</h1>
        </div>
        <div className="contenedorProductos">
          {categorias.map((categoria) => {
            const activa = categoriaSeleccionada === categoria.id
            return (
              <button
                type="button"
                key={categoria.id}
                className={`producto${activa ? ' activo' : ''}`}
                onClick={() => setCategoriaSeleccionada(activa ? null : categoria.id)}
              >
                <img src={categoria.imagen} alt={categoria.nombre} />
                <p>{categoria.nombre}</p>
              </button>
            )
          })}
        </div>
      </section>

      <div className="titulo">
        <h2>Productos</h2>
      </div>

      <section className="Instrumentos">
        <div className="productGrid">
          {listaFiltrada.map((instrumento) => (
            <Link
              key={`${instrumento.nombre}-${instrumento.descripcion}`}
              to="/productos"
              state={instrumento}
              className="productLink"
            >
              <ProductCard
                imageSrc={instrumento.imagen}
                imageAlt={instrumento.nombre}
              >
                <h3>{instrumento.nombre}</h3>
                <p>{instrumento.descripcion}</p>
                <span className="precio">{formatearPrecio(instrumento.precio)}</span>
                <BottonComprar />
              </ProductCard>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
