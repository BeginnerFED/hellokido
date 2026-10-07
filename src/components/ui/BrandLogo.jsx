import React from 'react'
import logo from '../../assets/hellokido-logo.svg'
import logoDark from '../../assets/hellokido-logo-dark.svg'

// HelloKido logosu (hellokido.com'daki özgün çizim). Koyu temada siyah yazıları ("Hello",
// "Oyun Atölyesi") beyaza çevrilmiş kopyası gösterilir; renkli harfler aynıdır.
// Boyut className ile verilir (ör. "h-12 w-auto").
export default function BrandLogo({ className = '' }) {
  return (
    <>
      <img src={logo} alt="Hello Kido" width={912} height={523} className={`${className} dark:hidden`} />
      <img src={logoDark} alt="Hello Kido" width={912} height={523} className={`${className} hidden dark:block`} />
    </>
  )
}
