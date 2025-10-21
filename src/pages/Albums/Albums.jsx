import { useEffect, useMemo, useRef, useState } from 'react'

import './Albums.css'

import { albums } from '@data/albums'
import { obtenerAsset } from '@data/obtenerAsset'
import { BottonComprar } from '@components/common/BottonComprar/BottonComprar'
import { ProductCard } from '@components/common/ProductCard/ProductCard'
import { AlbumsFilters } from '@components/AlbumsFilters/AlbumsFilters'

const categorias = [
  { id: 'Vinilo', nombre: 'Vinilos', imagen: obtenerAsset('img/logo/LogoVinilo.png') },
  { id: 'Cassette', nombre: 'Cassette', imagen: obtenerAsset('img/logo/logoCassette.png') },
  { id: 'CD', nombre: 'CD', imagen: obtenerAsset('img/logo/logoCD.png') },
]

function formatearPrecio(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function Albums() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [edicionSeleccionada, setEdicionSeleccionada] = useState(null)
  const [filtroEspecial, setFiltroEspecial] = useState(null)
  const [ordenPrecio, setOrdenPrecio] = useState(null)
  const [menuEdicionVisible, setMenuEdicionVisible] = useState(false)
  const [menuPrecioVisible, setMenuPrecioVisible] = useState(false)

  const refEdicion = useRef(null)
  const refPrecio = useRef(null)

  useEffect(() => {
    function cerrarMenus(evento) {
      if (refEdicion.current && !refEdicion.current.contains(evento.target)) {
        setMenuEdicionVisible(false)
      }
      if (refPrecio.current && !refPrecio.current.contains(evento.target)) {
        setMenuPrecioVisible(false)
      }
    }

    document.addEventListener('mousedown', cerrarMenus)
    return () => document.removeEventListener('mousedown', cerrarMenus)
  }, [])

  const listaFiltrada = useMemo(() => {
    let resultado = [...albums]

    if (categoriaSeleccionada) {
      resultado = resultado.filter((item) => item.categoria === categoriaSeleccionada)
    }

    if (edicionSeleccionada) {
      resultado = resultado.filter((item) => item.edicion === edicionSeleccionada)
    }

    if (filtroEspecial === 'Promocion') {
      resultado = resultado.filter((item) => item.promocion)
    } else if (filtroEspecial === 'Preventa') {
      resultado = resultado.filter((item) => item.preventa)
    }

    if (ordenPrecio === 'asc') {
      resultado.sort((a, b) => a.precio - b.precio)
    } else if (ordenPrecio === 'desc') {
      resultado.sort((a, b) => b.precio - a.precio)
    }

    return resultado
  }, [categoriaSeleccionada, edicionSeleccionada, filtroEspecial, ordenPrecio])

  function alternarCategoria(id) {
    setCategoriaSeleccionada((actual) => (actual === id ? null : id))
  }

  function alternarFiltroEspecial(id) {
    setFiltroEspecial((actual) => (actual === id ? null : id))
  }

  function seleccionarEdicion(valor) {
    setEdicionSeleccionada((actual) => (actual === valor ? null : valor))
    setMenuEdicionVisible(false)
  }

  function seleccionarPrecio(valor) {
    setOrdenPrecio((actual) => (actual === valor ? null : valor))
    setMenuPrecioVisible(false)
  }

  return (
    <div className="paginaAlbums">
      <section className="productos">
        <div className="titulo">
          <h1>Productos</h1>
        </div>
        <div className="contenedorProductos">
          {categorias.map((categoria) => {
            const activa = categoriaSeleccionada === categoria.id
            return (
              <button
                type="button"
                key={categoria.id}
                className={`producto${activa ? ' activo' : ''}`}
                onClick={() => alternarCategoria(categoria.id)}
              >
                <img src={categoria.imagen} alt={categoria.nombre} />
                <p>{categoria.nombre}</p>
              </button>
            )
          })}
        </div>
      </section>

      <AlbumsFilters
        refEdicion={refEdicion}
        refPrecio={refPrecio}
        edicionSeleccionada={edicionSeleccionada}
        ordenPrecio={ordenPrecio}
        filtroEspecial={filtroEspecial}
        menuEdicionVisible={menuEdicionVisible}
        menuPrecioVisible={menuPrecioVisible}
        onToggleEdicionMenu={() => setMenuEdicionVisible((visible) => !visible)}
        onTogglePrecioMenu={() => setMenuPrecioVisible((visible) => !visible)}
        onSeleccionarEdicion={seleccionarEdicion}
        onSeleccionarPrecio={seleccionarPrecio}
        onAlternarFiltroEspecial={alternarFiltroEspecial}
      />

      <div className="titulo">
        <h2>Álbums</h2>
      </div>

      <section className="albums">
        <div className="productGrid">
          {listaFiltrada.map((album) => (
            <ProductCard
              key={`${album.artista}-${album.album}`}
              imageSrc={album.imagen}
              imageAlt={album.album}
            >
              <h3>{album.artista}</h3>
              <p>
                <strong>Álbum:</strong> {album.album}
              </p>
              <p>
                <strong>Formato:</strong> {album.formato}
              </p>
              <span className="precio">{formatearPrecio(album.precio)}</span>
              <BottonComprar />
            </ProductCard>
          ))}
        </div>
      </section>
    </div>
  )
}
