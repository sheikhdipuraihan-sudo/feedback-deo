'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'bn'

type Dictionary = Record<string, string>

const bn: Dictionary = {
  'language.english': 'English',
  'language.bangla': 'বাংলা',
  'language.switch': 'ভাষা পরিবর্তন করুন',
  'nav.home': 'হোম',
  'nav.overview': 'ওভারভিউ',
  'nav.feedbackSpace': 'ফিডব্যাক স্পেস',
  'nav.qrLinks': 'QR ও লিংক',
  'nav.telegram': 'টেলিগ্রাম অ্যালার্ট',
  'nav.ai': 'Feedback Deo AI',
  'nav.widget': 'ওয়েবসাইট উইজেট',
  'nav.referrals': 'রেফার ও আয় করুন',
  'nav.billing': 'বিলিং',
  'nav.account': 'অ্যাকাউন্ট',
  'nav.logout': 'লগ আউট',
  'nav.openMenu': 'ড্যাশবোর্ড মেনু খুলুন',
  'nav.closeMenu': 'ড্যাশবোর্ড মেনু বন্ধ করুন',
  'dashboard.workspace': 'আপনার ওয়ার্কস্পেস',
  'dashboard.welcome': 'স্বাগতম, {name}',
  'dashboard.tagline': 'সৎ ফিডব্যাক সংগ্রহ করুন এবং পরবর্তী সেরা সিদ্ধান্ত নিন।',
  'dashboard.createTitle': 'আপনার ব্যবসার ওয়ার্কস্পেস তৈরি করুন',
  'dashboard.createBody': 'ব্যবসার ধরন বেছে নিয়ে গ্রাহকদের কাছ থেকে ফিডব্যাক সংগ্রহ শুরু করুন।',
  'dashboard.businessName': 'ব্যবসার নাম',
  'dashboard.businessType': 'ব্যবসার ধরন',
  'dashboard.create': 'ওয়ার্কস্পেস তৈরি করুন',
  'dashboard.creating': 'তৈরি হচ্ছে…',
  'dashboard.averageRating': 'গড় রেটিং',
  'dashboard.totalFeedback': 'মোট ফিডব্যাক',
  'dashboard.spaceStatus': 'স্পেসের অবস্থা',
  'dashboard.live': 'সক্রিয়',
  'dashboard.readyToCollect': 'সংগ্রহের জন্য প্রস্তুত',
  'dashboard.anonymousResponses': 'বেনামী উত্তর',
  'dashboard.recentFeedback': 'সাম্প্রতিক ফিডব্যাক',
  'dashboard.customerSaying': 'আপনার গ্রাহকেরা কী বলছেন।',
  'dashboard.search': 'ফিডব্যাক খুঁজুন',
  'dashboard.refresh': 'রিফ্রেশ',
  'dashboard.noFeedback': 'এখনও কোনো ফিডব্যাক নেই',
  'dashboard.shareLink': 'উত্তর দেখতে আপনার পাবলিক লিংক গ্রাহকদের সাথে শেয়ার করুন।',
  'dashboard.noMatches': 'মিল পাওয়া যায়নি',
  'dashboard.tryAnother': 'অন্য কোনো শব্দ দিয়ে চেষ্টা করুন।',
  'public.loading': 'ফিডব্যাক ফর্ম লোড হচ্ছে…',
  'public.unavailableTitle': 'ফিডব্যাক লিংকটি পাওয়া যাচ্ছে না',
  'public.unavailableBody': 'এই ফিডব্যাক লিংকটি আর সক্রিয় নেই।',
  'public.question': 'আপনার অভিজ্ঞতা কেমন ছিল?',
  'public.intro': 'আপনার সৎ মতামত এই ব্যবসাকে আরও ভালো হতে সাহায্য করে। কোনো অ্যাকাউন্ট লাগবে না।',
  'public.rate': 'আপনার অভিজ্ঞতার রেটিং দিন',
  'public.commentLabel': 'আমাদের কী জানা উচিত?',
  'public.commentPlaceholder': 'কী ভালো হয়েছে বা কী উন্নত করা যায় বলুন…',
  'public.send': 'ফিডব্যাক পাঠান',
  'public.sending': 'পাঠানো হচ্ছে…',
  'public.anonymous': 'ডিফল্টভাবে বেনামী',
  'public.thanks': 'আপনার ফিডব্যাকের জন্য ধন্যবাদ',
  'public.sent': 'আপনার উত্তরটি {name}-এর কাছে বেনামেভাবে পাঠানো হয়েছে।',
  'common.close': 'বন্ধ করুন',
  'common.save': 'সংরক্ষণ করুন',
  'common.cancel': 'বাতিল',
}

const en: Dictionary = {
  'language.english': 'English', 'language.bangla': 'Bangla', 'language.switch': 'Switch language',
  'nav.home': 'Home', 'nav.overview': 'Overview', 'nav.feedbackSpace': 'Feedback space', 'nav.qrLinks': 'QR & Links', 'nav.telegram': 'Telegram alerts', 'nav.ai': 'Feedback Deo AI', 'nav.widget': 'Website widget', 'nav.referrals': 'Refer & Earn', 'nav.billing': 'Billing', 'nav.account': 'Account', 'nav.logout': 'Log out', 'nav.openMenu': 'Open dashboard menu', 'nav.closeMenu': 'Close dashboard menu',
  'dashboard.workspace': 'YOUR WORKSPACE', 'dashboard.welcome': 'Welcome, {name}', 'dashboard.tagline': 'Collect honest feedback and turn it into your next best decision.', 'dashboard.createTitle': 'Create your business workspace', 'dashboard.createBody': 'Choose your business type, then start collecting feedback from your customers.', 'dashboard.businessName': 'Business name', 'dashboard.businessType': 'Business type', 'dashboard.create': 'Create workspace', 'dashboard.creating': 'Creating…', 'dashboard.averageRating': 'AVERAGE RATING', 'dashboard.totalFeedback': 'TOTAL FEEDBACK', 'dashboard.spaceStatus': 'SPACE STATUS', 'dashboard.live': 'Live', 'dashboard.readyToCollect': 'Ready to collect', 'dashboard.anonymousResponses': 'Anonymous responses', 'dashboard.recentFeedback': 'Recent feedback', 'dashboard.customerSaying': 'What your customers are saying.', 'dashboard.search': 'Search feedback', 'dashboard.refresh': 'Refresh', 'dashboard.noFeedback': 'No feedback yet', 'dashboard.shareLink': 'Share your public link with customers to see responses here.', 'dashboard.noMatches': 'No matching feedback', 'dashboard.tryAnother': 'Try another search term.',
  'public.loading': 'Loading feedback form…', 'public.unavailableTitle': 'Feedback link unavailable', 'public.unavailableBody': 'This feedback link is not available.', 'public.question': 'How was your experience?', 'public.intro': 'Your honest feedback helps this business get better. No account required.', 'public.rate': 'Rate your experience', 'public.commentLabel': 'What should we know?', 'public.commentPlaceholder': 'Tell us what went well or what we can improve…', 'public.send': 'Send feedback', 'public.sending': 'Sending…', 'public.anonymous': 'Anonymous by default', 'public.thanks': 'Thank you for your feedback', 'public.sent': 'Your response was sent anonymously to {name}.', 'common.close': 'Close', 'common.save': 'Save', 'common.cancel': 'Cancel'
}

type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string, vars?: Record<string, string>) => string }
const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en'
    const saved = window.localStorage.getItem('feedback-deo-locale')
    return saved === 'bn' || saved === 'en' ? saved : 'en'
  })
  useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn' : 'en'
    window.localStorage.setItem('feedback-deo-locale', locale)
  }, [locale])
  const value = useMemo(() => ({
    locale,
    setLocale: (next: Locale) => setLocaleState(next),
    t: (key: string, vars?: Record<string, string>) => {
      const source = locale === 'bn' ? bn[key] : undefined
      let text = source || (en[key] === key ? key : en[key]) || key
      Object.entries(vars || {}).forEach(([name, replacement]) => { text = text.replace(`{${name}}`, replacement) })
      return text
    },
  }), [locale])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage()
  return <div className={`language-toggle${compact ? ' compact' : ''}`} role="group" aria-label={t('language.switch')}>
    <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" className={locale === 'bn' ? 'active' : ''} onClick={() => setLocale('bn')} aria-pressed={locale === 'bn'}>বাংলা</button>
  </div>
}
