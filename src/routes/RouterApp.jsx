import { useCallback, useMemo, useState } from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'

import { MainLayout } from '../layout/MainLayout/MainLayout'
import { ModalLogin } from '@components/modals/ModalLogin'
import { ModalRegistro } from '@components/modals/ModalRegistro'
import { ModalTarjeta } from '@components/modals/ModalTarjeta'
import { ModalRegistroConfirmado } from '@components/modals/ModalRegistroConfirmado'
import { routesConfig } from './routesConfig'

export function RouterApp() {
  const [loginAbierto, setLoginAbierto] = useState(false)
  const [registroAbierto, setRegistroAbierto] = useState(false)
  const [tarjetaAbierta, setTarjetaAbierta] = useState(false)
  const [confirmacionRegistroAbierta, setConfirmacionRegistroAbierta] = useState(false)

  const cerrarModales = useCallback(() => {
    setLoginAbierto(false)
    setRegistroAbierto(false)
    setTarjetaAbierta(false)
    setConfirmacionRegistroAbierta(false)
  }, [])

  const abrirLogin = useCallback(() => {
    setLoginAbierto(true)
    setRegistroAbierto(false)
    setTarjetaAbierta(false)
    setConfirmacionRegistroAbierta(false)
  }, [])

  const abrirRegistro = useCallback(() => {
    setRegistroAbierto(true)
    setLoginAbierto(false)
    setTarjetaAbierta(false)
    setConfirmacionRegistroAbierta(false)
  }, [])

  const cerrarConfirmacionRegistro = useCallback(() => {
    setConfirmacionRegistroAbierta(false)
  }, [])

  const mostrarTarjeta = useCallback(() => {
    setConfirmacionRegistroAbierta(false)
    setRegistroAbierto(false)
    setLoginAbierto(false)
    setTarjetaAbierta(true)
  }, [])

  const finalizarRegistroConTarjeta = useCallback(() => {
    setTarjetaAbierta(false)
    setConfirmacionRegistroAbierta(true)
  }, [])

  const router = useMemo(() => {
    const LayoutWrapper = () => (
      <MainLayout onOpenLogin={abrirLogin}>
        <Outlet />
      </MainLayout>
    )

    return createBrowserRouter([
      {
        element: <LayoutWrapper />,
        children: routesConfig,
      },
    ])
  }, [abrirLogin])

  return (
    <>
      <RouterProvider router={router} />

      <ModalLogin abierto={loginAbierto} onCerrar={cerrarModales} onIrRegistro={abrirRegistro} />
      <ModalRegistro
        abierto={registroAbierto}
        onCerrar={cerrarModales}
        onIrLogin={abrirLogin}
        onRegistroExitoso={mostrarTarjeta}
      />
      <ModalRegistroConfirmado
        abierto={confirmacionRegistroAbierta}
        onCerrar={cerrarConfirmacionRegistro}
        onVerPerfil={cerrarConfirmacionRegistro}
      />
      <ModalTarjeta abierto={tarjetaAbierta} onCerrar={cerrarModales} onRegistroCompletado={finalizarRegistroConTarjeta} />
    </>
  )
}
