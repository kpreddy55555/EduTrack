'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
export default function Page() {
  const router = useRouter()
  useEffect(() => { router.replace('/student-portal/dashboard') }, [])
  return <div className="flex items-center justify-center min-h-screen"><p className="text-slate-400">Redirecting to Student Portal...</p></div>
}
