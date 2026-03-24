'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Fiat Onramp — "Pay with Card" button for Coal checkout.
 *
 * Uses MoonPay's hosted onramp widget in an iframe. When the user completes
 * the card purchase, MoonPay converts USD → USDC on Base and deposits it
 * into the customer's wallet. Coal then processes the USDC payment normally.
 *
 * This component works independently of Privy — it opens MoonPay directly.
 * When we migrate to Privy, we can swap this for `useFundWallet()` which
 * wraps MoonPay with a better UX.
 *
 * Required env vars:
 *   NEXT_PUBLIC_MOONPAY_API_KEY — MoonPay publishable API key
 *   NEXT_PUBLIC_MOONPAY_ENV     — "sandbox" or "production" (default: sandbox)
 */

interface FiatOnrampProps {
  /** Amount in USD to purchase */
  amount: string
  /** Wallet address to receive the USDC */
  walletAddress: string
  /** Called when onramp completes successfully */
  onSuccess?: () => void
  /** Called when user closes the widget without completing */
  onClose?: () => void
  /** Currency code the customer sees (default: "USD") */
  fiatCurrency?: string
  /** Crypto to purchase (default: "usdc_base" for USDC on Base) */
  cryptoCurrency?: string
}

const MOONPAY_SANDBOX_URL = 'https://buy-sandbox.moonpay.com'
const MOONPAY_PRODUCTION_URL = 'https://buy.moonpay.com'

function getMoonPayUrl({
  amount,
  walletAddress,
  fiatCurrency = 'usd',
  cryptoCurrency = 'usdc_base',
}: {
  amount: string
  walletAddress: string
  fiatCurrency?: string
  cryptoCurrency?: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY
  if (!apiKey) {
    return null
  }

  const isProduction = process.env.NEXT_PUBLIC_MOONPAY_ENV === 'production'
  const baseUrl = isProduction ? MOONPAY_PRODUCTION_URL : MOONPAY_SANDBOX_URL

  const params = new URLSearchParams({
    apiKey,
    currencyCode: cryptoCurrency,
    baseCurrencyCode: fiatCurrency,
    baseCurrencyAmount: amount,
    walletAddress,
    colorCode: '#FF5C16', // Coal brand orange
    theme: 'light',
    language: 'en',
    showWalletAddressForm: 'false', // pre-fill wallet, don't let user change
  })

  return `${baseUrl}?${params.toString()}`
}

export default function FiatOnramp({
  amount,
  walletAddress,
  onSuccess,
  onClose,
  fiatCurrency = 'usd',
  cryptoCurrency = 'usdc_base',
}: FiatOnrampProps) {
  const [showWidget, setShowWidget] = useState(false)
  const [loading, setLoading] = useState(true)

  const moonpayUrl = getMoonPayUrl({
    amount,
    walletAddress,
    fiatCurrency,
    cryptoCurrency,
  })

  const handleOpen = useCallback(() => {
    if (!moonpayUrl) {
      return
    }
    setShowWidget(true)
    setLoading(true)
  }, [moonpayUrl])

  const handleClose = useCallback(() => {
    setShowWidget(false)
    setLoading(true)
    onClose?.()
  }, [onClose])

  const handleIframeLoad = useCallback(() => {
    setLoading(false)
  }, [])

  // Listen for MoonPay postMessage events
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        !event.origin.includes('moonpay.com') &&
        !event.origin.includes('buy-sandbox.moonpay.com')
      ) {
        return
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'onramp_widget_close') {
          handleClose()
        }
        if (data?.type === 'onramp_widget_tx_completed' || data?.status === 'completed') {
          setShowWidget(false)
          onSuccess?.()
        }
      } catch {
        // Not a JSON message, ignore
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleClose, onSuccess])

  if (!moonpayUrl || !walletAddress) {
    return null
  }

  return (
    <>
      {/* Pay with Card Button */}
      <button
        onClick={handleOpen}
        className="w-full h-14 bg-white text-black rounded-full font-bold text-base border-2 border-black/10 hover:border-black/20 hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
          <path d="M6 14H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Pay with Card
      </button>

      {/* MoonPay Widget Modal */}
      <AnimatePresence>
        {showWidget && moonpayUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-[420px] relative"
              style={{ height: '640px' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="font-bold text-sm text-gray-900">Pay with Card</span>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="absolute inset-0 top-[57px] flex items-center justify-center bg-white z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#FF5C16] rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-medium">Loading payment form...</p>
                  </div>
                </div>
              )}

              {/* MoonPay iframe */}
              <iframe
                src={moonpayUrl}
                onLoad={handleIframeLoad}
                allow="accelerometer; autoplay; camera; gyroscope; payment"
                className="w-full border-0"
                style={{ height: 'calc(100% - 57px)' }}
                title="Buy crypto with card"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
