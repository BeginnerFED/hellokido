import React from 'react'

// Çizim sırasında beklenmeyen bir hata olursa React tüm sayfayı kaldırır ve geriye
// bembeyaz bir ekran kalır. Bu sınır, onun yerine kısa bir açıklama ve "yenile" düğmesi
// gösterir. (Dil/tema sağlayıcılarının dışında durduğu için metin sabittir.)
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Beklenmeyen hata:', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4 bg-[#f6f7f9]">
        <div className="w-full max-w-md bg-white border border-[#E2E4E9] rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-[#1d1d1f] mb-3">
            Bir şeyler ters gitti
          </h1>
          <p className="text-sm text-[#6e6e73] leading-relaxed">
            Sayfa görüntülenirken beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full h-10 bg-[#1d1d1f] text-white text-sm font-medium rounded-xl hover:bg-black focus:outline-none transition-colors"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    )
  }
}
