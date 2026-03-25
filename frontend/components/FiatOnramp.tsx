'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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
}

export default function FiatOnramp({
  walletAddress,
  disabled = false,
  onRequireWallet,
  onCreateFundingIntent,
  onSuccess,
}: FiatOnrampProps) {
  const [preparing, setPreparing] = useState(false)
  const [pendingWalletConnection, setPendingWalletConnection] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const helperText = useMemo(() => {
    if (note) return note
    if (!walletAddress) return 'Coal will securely sign you in and create your Coal wallet first, then MoonPay will fund it with card.'
    return 'MoonPay securely funds your Coal wallet first, then Coal completes the merchant payment from that same wallet onchain.'
  }, [note, walletAddress])

  const openForWallet = useCallback(async (resolvedWalletAddress: string) => {
    setNote(null)
    setPreparing(true)
    try {
      const session = await onCreateFundingIntent(resolvedWalletAddress)
      if (!session) {
        setPreparing(false)
        return
      }

      setNote(session.testnetNotice || session.note || null)
      onSuccess?.({ fundingIntentId: session.fundingIntentId })
      if (typeof window !== 'undefined') {
        window.location.assign(session.url)
      }
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
    </>
  )
}
