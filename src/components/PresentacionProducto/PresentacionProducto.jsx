import './PresentacionProducto.css'
import { BottonComprar } from '@components/common/BottonComprar/BottonComprar'

export function PresentacionProducto({ producto }) {
  if (!producto) {
    return (
      <div className="contenedorPresentacion">
        <article className="tarjetaProducto">
          <p>No hay datos disponibles.</p>
        </article>
      </div>
    )
  }

  const formatearPrecio = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(valor)
  }

  return (
    <div className="contenedorPresentacion">
      {/* Primera tarjeta: Imagen y precio */}
      <article className="tarjetaProducto">
        {producto.imagen && (
          <img 
            src={producto.imagen} 
            alt={producto.nombre} 
            className="imagenProducto" 
          />
        )}
      </article>

      {/* Segunda tarjeta: Nombre y detalle */}
      <article className="tarjetaProducto">
        <h2 className='nombre'>{producto.nombre}</h2>
        <p className="descripcionProducto">
          {producto.detalle}
        </p>
        <div className="precioProducto">
          {formatearPrecio(producto.precio)}
          <div><BottonComprar /></div>
        </div>
      </article>
    </div>
  )
}