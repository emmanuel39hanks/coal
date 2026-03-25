'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type FiatFundingSession = {
  fundingIntentId: string
  url: string
  note?: string | null
  testnetNotice?: string | null
}

interface FiatOnrampProps {
  walletAddress?: string | null
  disabled?: boolean
  onRequireWallet?: () => void
  onCreateFundingIntent: (walletAddress: string) => Promise<FiatFundingSession | null>
  onSuccess?: (payload: { fundingIntentId: string | null }) => void
  onClose?: () => void
}

function isMoonPayOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'buy.moonpay.com' || hostname === 'buy-sandbox.moonpay.com' || hostname.endsWith('.moonpay.com')
  } catch {
    return false
  }
}

export default function FiatOnramp({
  walletAddress,
  disabled = false,
  onRequireWallet,
  onCreateFundingIntent,
  onSuccess,
  onClose,
}: FiatOnrampProps) {
  const [showWidget, setShowWidget] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [pendingWalletConnection, setPendingWalletConnection] = useState(false)
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null)
  const [fundingIntentId, setFundingIntentId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const helperText = useMemo(() => {
    if (note) return note
    if (!walletAddress) return 'Coal will connect or create a wallet first, then MoonPay will fund it with card.'
    return 'MoonPay funds your wallet first. Coal completes the actual payment only after you sign the onchain transfer from that wallet. First-time buyers may see an email verification and profile setup step before the quote appears.'
  }, [note, walletAddress])

  const closeWidget = useCallback(() => {
    setShowWidget(false)
    setLoading(false)
    onClose?.()
  }, [onClose])

  const openForWallet = useCallback(async (resolvedWalletAddress: string) => {
    setNote(null)
    setPreparing(true)
    try {
      const session = await onCreateFundingIntent(resolvedWalletAddress)
      if (!session) {
        setPreparing(false)
        return
      }

      setFundingIntentId(session.fundingIntentId)
      setWidgetUrl(session.url)
      setNote(session.testnetNotice || session.note || null)
      setShowWidget(true)
      setLoading(true)
    } catch (error) {
      console.error('Failed to prepare MoonPay funding session', error)
      setNote('Unable to prepare the card funding flow right now. Please try again in a moment.')
    } finally {
      setPreparing(false)
    }
  }, [onCreateFundingIntent])

  const handleOpen = useCallback(async () => {
    if (disabled || preparing) {
      return
    }

    if (!walletAddress) {
      setPendingWalletConnection(true)
      onRequireWallet?.()
      return
    }

    await openForWallet(walletAddress)
  }, [disabled, onRequireWallet, openForWallet, preparing, walletAddress])

  useEffect(() => {
    if (!pendingWalletConnection || !walletAddress) {
      return
    }

    setPendingWalletConnection(false)
    void openForWallet(walletAddress)
  }, [openForWallet, pendingWalletConnection, walletAddress])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isMoonPayOrigin(event.origin)) {
        return
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'onramp_widget_close') {
          closeWidget()
        }
        if (data?.type === 'onramp_widget_tx_completed' || data?.status === 'completed') {
          setShowWidget(false)
          setLoading(false)
          onSuccess?.({ fundingIntentId })
        }
      } catch {
        // Ignore non-JSON postMessage events from the iframe.
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [closeWidget, fundingIntentId, onSuccess])

  return (
    <>
      <button
        onClick={() => void handleOpen()}
        disabled={disabled || preparing}
        className="w-full h-14 bg-white text-black rounded-full font-bold text-base border-2 border-black/10 hover:border-black/20 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
          <path d="M6 14H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {preparing ? 'Preparing card checkout…' : 'Pay with Card'}
      </button>

      <p className="mt-2 text-center text-[11px] font-medium leading-relaxed text-gray-400">
        {helperText}
      </p>

      <AnimatePresence>
        {showWidget && widgetUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeWidget()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-white shadow-2xl"
              style={{ height: 'min(780px, calc(100vh - 24px))' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="font-bold text-sm text-gray-900">Pay with Card</span>
                </div>
                <button
                  onClick={closeWidget}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-[11px] font-medium leading-relaxed text-gray-500">
                  {helperText}
                </p>
              </div>

              {loading && (
                <div className="absolute inset-0 top-[104px] flex items-center justify-center bg-white z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#FF5C16] rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-medium">Loading payment form...</p>
                  </div>
                </div>
              )}

              <iframe
                src={widgetUrl}
                onLoad={() => setLoading(false)}
                allow="accelerometer; autoplay; camera; gyroscope; payment"
                className="w-full border-0"
                style={{ height: 'calc(100% - 104px)' }}
                title="Buy crypto with card"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
