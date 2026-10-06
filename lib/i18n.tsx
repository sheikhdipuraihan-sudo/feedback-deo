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

const DOM_TRANSLATIONS: Record<string, string> = {
  'How it works': 'কীভাবে কাজ করে', 'Features': 'ফিচার', 'Pricing': 'মূল্য', 'FAQ': 'সাধারণ প্রশ্ন', 'Log in': 'লগ ইন', 'Create account': 'অ্যাকাউন্ট তৈরি করুন', 'Built for local businesses in Bangladesh': 'বাংলাদেশের স্থানীয় ব্যবসার জন্য তৈরি', 'Know what your customers ': 'আপনার গ্রাহকেরা কী ভাবেন তা জানুন ', 'really': 'সত্যিই', ' think.': '।', 'Get started free': 'বিনামূল্যে শুরু করুন', 'See how it works': 'কীভাবে কাজ করে দেখুন', 'HOW IT WORKS': 'কীভাবে কাজ করে', 'Small moment.': 'ছোট মুহূর্ত।', 'Big difference.': 'বড় পরিবর্তন।', 'Create your space': 'আপনার স্পেস তৈরি করুন', 'Place your QR codes': 'আপনার QR কোড বসান', 'Listen and improve': 'শুনুন ও উন্নতি করুন', 'MADE FOR EVERY CUSTOMER TOUCHPOINT': 'প্রতিটি গ্রাহক সংযোগের জন্য', 'Everything you need.': 'আপনার যা দরকার।', "Nothing you don't.": 'অপ্রয়োজনীয় কিছু নয়।', 'QR feedback': 'QR ফিডব্যাক', 'Zero login': 'লগইন ছাড়াই', 'Telegram alerts': 'টেলিগ্রাম অ্যালার্ট', 'Clear analytics': 'সহজ অ্যানালিটিক্স', 'ONE CLEAR VIEW': 'একটি পরিষ্কার ভিউ', "Your customer's voice,": 'আপনার গ্রাহকের কণ্ঠ,', 'all in one place.': 'সব এক জায়গায়।', 'Explore the dashboard': 'ড্যাশবোর্ড দেখুন', 'SIMPLE PRICING': 'সহজ মূল্য', 'Start free. Grow when ready.': 'বিনামূল্যে শুরু করুন। প্রস্তুত হলে বাড়ান।', 'Free': 'ফ্রি', 'Pro': 'প্রো', 'Start free': 'বিনামূল্যে শুরু করুন', 'MOST POPULAR': 'সবচেয়ে জনপ্রিয়', 'Questions, answered': 'আপনার প্রশ্নের উত্তর', 'Good to know.': 'জেনে রাখা ভালো।', 'Ask us anything': 'যেকোনো প্রশ্ন করুন', 'Simple customer feedback for local businesses.': 'স্থানীয় ব্যবসার জন্য সহজ কাস্টমার ফিডব্যাক।', 'Tell us about your experience': 'আপনার অভিজ্ঞতা জানান', 'Welcome back': 'আবার স্বাগতম', 'Reset your password': 'পাসওয়ার্ড রিসেট করুন', 'Thanks for sharing.': 'শেয়ার করার জন্য ধন্যবাদ।', 'Done': 'সম্পন্ন',
  'Loading QR & links…': 'QR ও লিংক লোড হচ্ছে…', 'Your QR codes and share links.': 'আপনার QR কোড ও শেয়ার লিংক।', 'QR & LINKS': 'QR ও লিংক', 'Your QR opens the public feedback link; create a named feedback point for each counter, room, stylist, class, table, or service area.': 'আপনার QR পাবলিক ফিডব্যাক লিংক খুলবে; প্রতিটি কাউন্টার, রুম, স্টাইলিস্ট, ক্লাস, টেবিল বা সার্ভিস এলাকার জন্য একটি নামযুক্ত ফিডব্যাক পয়েন্ট তৈরি করুন।',
  'PUBLIC FEEDBACK LINK': 'পাবলিক ফিডব্যাক লিংক', 'One link for your whole space': 'আপনার পুরো স্পেসের জন্য একটি লিংক', 'Share this address directly, or use the workspace QR code below.': 'এই ঠিকানাটি সরাসরি শেয়ার করুন, অথবা নিচের ওয়ার্কস্পেস QR কোড ব্যবহার করুন।', 'Copy link': 'লিংক কপি করুন', 'Open': 'খুলুন', 'Copied': 'কপি হয়েছে',
  'QR BRANDING': 'QR ব্র্যান্ডিং', 'Make it yours': 'নিজের মতো সাজান', 'Choose a style and download a print-ready QR. The feedback destination stays the same.': 'একটি স্টাইল বেছে নিয়ে প্রিন্টের জন্য প্রস্তুত QR ডাউনলোড করুন। ফিডব্যাকের গন্তব্য একই থাকবে।', 'FREE · DEFAULT THEME': 'ফ্রি · ডিফল্ট থিম', 'PRO THEMES UNLOCKED': 'PRO থিম আনলক হয়েছে', 'Choose a theme': 'একটি থিম বেছে নিন', 'Default is included. Upgrade to Pro to unlock all 15 themes.': 'ডিফল্ট থিম অন্তর্ভুক্ত। সব ১৫টি থিম আনলক করতে Pro-তে আপগ্রেড করুন।', 'Default': 'ডিফল্ট', 'Clean & scannable': 'পরিষ্কার ও সহজে স্ক্যানযোগ্য', 'Modern': 'মডার্ন', 'Fresh, crisp frame': 'তাজা, পরিষ্কার ফ্রেম', 'Minimal': 'মিনিমাল', 'Quiet and simple': 'শান্ত ও সরল', 'Gradient': 'গ্রেডিয়েন্ট', 'Colorful outer frame': 'রঙিন বাইরের ফ্রেম', 'Neon': 'নিয়ন', 'Night-time contrast': 'রাতের কনট্রাস্ট', 'Dark': 'ডার্ক', 'Deep green canvas': 'গভীর সবুজ ক্যানভাস', 'Elegant': 'এলিগ্যান্ট', 'Warm, refined': 'উষ্ণ ও পরিশীলিত', 'Business': 'বিজনেস', 'Professional teal': 'প্রফেশনাল টিল', 'Glass': 'গ্লাস', 'Soft translucent look': 'নরম স্বচ্ছ লুক', 'Premium': 'প্রিমিয়াম', 'Green & gold': 'সবুজ ও সোনালি', 'Rounded': 'রাউন্ডেড', 'Soft-edged card': 'নরম প্রান্তের কার্ড', 'Soft': 'সফট', 'Gentle pastel': 'কোমল প্যাস্টেল', 'Luxury': 'লাক্সারি', 'Ink and champagne': 'ইঙ্ক ও শ্যাম্পেন', 'Vibrant': 'উজ্জ্বল ব্র্যান্ড ফ্রেম', 'Custom Brand': 'কাস্টম ব্র্যান্ড', 'Your Pro brand color': 'আপনার Pro ব্র্যান্ডের রং',
  'Business name': 'ব্যবসার নাম', 'Your business name': 'আপনার ব্যবসার নাম', 'Short brand text': 'ছোট ব্র্যান্ড টেক্সট', 'Optional': 'ঐচ্ছিক', 'Logo': 'লোগো', 'PNG, JPG, or WebP · max 5 MB': 'PNG, JPG বা WebP · সর্বোচ্চ ৫ MB', 'Upload logo': 'লোগো আপলোড করুন', 'Replace logo': 'লোগো বদলান', 'Remove': 'সরান', 'Brand color': 'ব্র্যান্ডের রং', 'Custom color': 'কাস্টম রং', 'Layout': 'লেআউট', 'Pro customization': 'Pro কাস্টমাইজেশন', 'Premium layouts': 'প্রিমিয়াম লেআউট', 'Stacked branding': 'স্ট্যাকড ব্র্যান্ডিং', 'Compact logo row': 'কমপ্যাক্ট লোগো রো', 'QR first': 'প্রথমে QR', 'LIVE PREVIEW': 'লাইভ প্রিভিউ', 'Download high-resolution PNG': 'হাই-রেজোলিউশন PNG ডাউনলোড করুন', 'Print-ready · square modules · generous quiet zone': 'প্রিন্টের জন্য প্রস্তুত · স্কয়ার মডিউল · পর্যাপ্ত শান্ত জোন',
  'FEEDBACK POINTS': 'ফিডব্যাক পয়েন্ট', 'Give each point its own QR and link': 'প্রতিটি পয়েন্টের জন্য আলাদা QR ও লিংক দিন', 'These links are different from your general public feedback link.': 'এই লিংকগুলো আপনার সাধারণ পাবলিক ফিডব্যাক লিংক থেকে আলাদা।', 'Refresh links': 'লিংক রিফ্রেশ করুন', 'Add feedback point': 'ফিডব্যাক পয়েন্ট যোগ করুন', 'No feedback points yet': 'এখনও কোনো ফিডব্যাক পয়েন্ট নেই', 'Add a point to create its own share link and downloadable QR code.': 'নিজস্ব শেয়ার লিংক ও ডাউনলোডযোগ্য QR কোড তৈরি করতে একটি পয়েন্ট যোগ করুন।',
  'FEEDBACK DEO AI': 'FEEDBACK DEO AI', 'Business feedback, made clear.': 'ব্যবসার ফিডব্যাক এখন আরও পরিষ্কার।', 'PRO FEATURE': 'PRO ফিচার', 'Unlock your feedback assistant': 'আপনার ফিডব্যাক সহকারী আনলক করুন', 'Feedback report': 'ফিডব্যাক রিপোর্ট', 'Analyze feedback': 'ফিডব্যাক বিশ্লেষণ করুন', 'Run again': 'আবার চালান', 'Analyzing…': 'বিশ্লেষণ হচ্ছে…', 'Ready when you are': 'আপনি প্রস্তুত হলেই শুরু করুন', 'Chat about your business': 'আপনার ব্যবসা নিয়ে চ্যাট করুন', 'Ask about your feedback or workspace…': 'আপনার ফিডব্যাক বা ওয়ার্কস্পেস সম্পর্কে জিজ্ঞাসা করুন…', 'Send message': 'মেসেজ পাঠান', 'Summary': 'সারাংশ',
  'FEEDBACK DEO PRO': 'FEEDBACK DEO PRO', 'Upgrade to Pro': 'Pro-তে আপগ্রেড করুন', 'Get unlimited feedback for your business.': 'আপনার ব্যবসার জন্য আনলিমিটেড ফিডব্যাক পান।', 'Monthly Pro plan': 'মাসিক Pro প্ল্যান', 'Send ৳49 via bKash': 'bKash-এ ৳৪৯ পাঠান', 'Merchant / personal number': 'মার্চেন্ট / ব্যক্তিগত নম্বর', 'Your business UID': 'আপনার ব্যবসার UID', 'bKash transaction ID': 'bKash ট্রানজ্যাকশন ID', 'Submit payment for review': 'রিভিউয়ের জন্য পেমেন্ট জমা দিন', 'Payment submissions': 'পেমেন্ট জমা', 'Payment submitted for admin review.': 'অ্যাডমিন রিভিউয়ের জন্য পেমেন্ট জমা হয়েছে।', 'Back to dashboard': 'ড্যাশবোর্ডে ফিরে যান', 'Open dashboard': 'ড্যাশবোর্ড খুলুন',
  'FEEDBACK DEO · REFER & EARN': 'FEEDBACK DEO · রেফার ও আয় করুন', 'Share Feedback Deo.': 'Feedback Deo শেয়ার করুন।', 'Earn free Pro months.': 'ফ্রি Pro মাস উপার্জন করুন।', 'YOUR PERSONAL REFERRAL LINK': 'আপনার ব্যক্তিগত রেফারেল লিংক', 'Invite a business owner': 'একজন ব্যবসার মালিককে আমন্ত্রণ জানান', 'QUALIFIED REFERRALS': 'যোগ্য রেফারেল', 'UNSPENT POINTS': 'অব্যবহৃত পয়েন্ট', 'MONTHS REDEEMED': 'রিডিম করা মাস', 'NEXT REWARD': 'পরবর্তী পুরস্কার', '5 points = 1 month of Pro': '৫ পয়েন্ট = ১ মাস Pro', 'Redeem 5 points for 1 month': '১ মাসের জন্য ৫ পয়েন্ট রিডিম করুন', 'Redeeming…': 'রিডিম হচ্ছে…', 'How we keep rewards fair': 'আমরা কীভাবে পুরস্কার ন্যায্য রাখি', 'Refresh referral status': 'রেফারেল স্ট্যাটাস রিফ্রেশ করুন',
  'WEBSITE WIDGET': 'ওয়েবসাইট উইজেট', 'Bring customer feedback to your website.': 'আপনার ওয়েবসাইটে গ্রাহকের ফিডব্যাক দেখান।', 'Customize it': 'কাস্টমাইজ করুন', 'YOUR EMBED': 'আপনার এম্বেড', 'Theme': 'থিম', 'White': 'সাদা', 'Clean and bright': 'পরিষ্কার ও উজ্জ্বল', 'Deep, low-glare': 'গভীর, কম ঝলক', 'Recent reviews to show': 'সাম্প্রতিক কতটি রিভিউ দেখাবেন', 'Generate embed code': 'এম্বেড কোড তৈরি করুন', 'Refresh embed code': 'এম্বেড কোড রিফ্রেশ করুন', 'Paste into your website': 'আপনার ওয়েবসাইটে পেস্ট করুন', 'Copy code': 'কোড কপি করুন', 'CUSTOMER REVIEWS': 'গ্রাহকের রিভিউ', 'Anonymous feedback': 'বেনামী ফিডব্যাক',
  'ACCOUNT SETTINGS': 'অ্যাকাউন্ট সেটিংস', 'Delete your account': 'আপনার অ্যাকাউন্ট মুছুন', 'Account deleted': 'অ্যাকাউন্ট মুছে ফেলা হয়েছে', 'Current password': 'বর্তমান পাসওয়ার্ড', 'Account email': 'অ্যাকাউন্ট ইমেইল', 'Permanently delete account': 'স্থায়ীভাবে অ্যাকাউন্ট মুছুন', 'Contact feedbackdeo@gmail.com': 'feedbackdeo@gmail.com-এ যোগাযোগ করুন',
  'GET IN TOUCH': 'যোগাযোগ করুন', 'We’re here to help.': 'আমরা সাহায্য করতে প্রস্তুত।', 'Terms of Service': 'সেবার শর্তাবলি', 'Privacy Policy': 'গোপনীয়তা নীতি', 'Back to Feedback Deo': 'Feedback Deo-তে ফিরে যান', 'LEGAL': 'আইনি', 'Contact': 'যোগাযোগ', 'Effective date: October 6, 2026': 'কার্যকর তারিখ: ৬ অক্টোবর, ২০২৬',
  'ADMIN CONSOLE': 'অ্যাডমিন কনসোল', 'Operations overview': 'অপারেশনস ওভারভিউ', 'Payment requests': 'পেমেন্ট অনুরোধ', 'Total businesses': 'মোট ব্যবসা', 'Active Pro': 'সক্রিয় Pro', 'Pending payments': 'অমীমাংসিত পেমেন্ট', 'Banned businesses': 'ব্যান করা ব্যবসা', 'Search businesses, owner IDs, or transaction IDs': 'ব্যবসা, মালিকের ID বা ট্রানজ্যাকশন ID খুঁজুন', 'Log out': 'লগ আউট', 'Previous page': 'আগের পৃষ্ঠা', 'Next page': 'পরের পৃষ্ঠা',
}

const originalText = new WeakMap<Text, string>()

function translateDom(locale: Locale) {
  if (typeof document === 'undefined') return
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  nodes.forEach(node => {
    const parent = node.parentElement
    if (!parent || parent.closest('script,style,textarea,input,select,option,.language-toggle')) return
    const original = originalText.get(node) || node.nodeValue || ''
    originalText.set(node, original)
    node.nodeValue = locale === 'en' ? original : Object.entries(DOM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length).reduce((text, [from, to]) => text.replaceAll(from, to), original)
  })
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
    translateDom(locale)
    const observer = new MutationObserver(() => translateDom(locale))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
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
  return <LanguageContext.Provider value={value}><div className="global-language-toolbar"><LanguageToggle /></div>{children}</LanguageContext.Provider>
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
