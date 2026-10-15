// Poster lines in the languages most spoken at home in the 13 councils (ABS Census 2021).
// Every line is a draft for a native speaker to check before printing. A language with no line,
// or with a line we aren't confident in, is shown as "needs a community translator" instead.
export const PHRASES = {
  English: { lang: 'en', title: 'Free blood pressure check', sub: '5 minutes · No appointment needed' },
  Arabic: { lang: 'ar', dir: 'rtl', title: 'فحص ضغط الدم مجاناً', sub: '5 دقائق · لا حاجة لموعد' },
  Mandarin: { lang: 'zh-Hans', title: '免费测量血压', sub: '5 分钟 · 无需预约' },
  Cantonese: { lang: 'zh-Hant', title: '免費量血壓', sub: '5 分鐘 · 無需預約' },
  Vietnamese: { lang: 'vi', title: 'Đo huyết áp miễn phí', sub: '5 phút · Không cần hẹn trước' },
  Punjabi: { lang: 'pa', title: 'ਮੁਫ਼ਤ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਜਾਂਚ', sub: '5 ਮਿੰਟ · ਅਪੌਇੰਟਮੈਂਟ ਦੀ ਲੋੜ ਨਹੀਂ' },
  Hindi: { lang: 'hi', title: 'मुफ़्त ब्लड प्रेशर जाँच', sub: '5 मिनट · अपॉइंटमेंट की ज़रूरत नहीं' },
  Tagalog: { lang: 'tl', title: 'Libreng pagsusuri ng presyon ng dugo', sub: '5 minuto · Hindi kailangan ng appointment' },
  Korean: { lang: 'ko', title: '무료 혈압 측정', sub: '5분 · 예약 필요 없음' },
  Nepali: { lang: 'ne', title: 'निःशुल्क रक्तचाप जाँच', sub: '5 मिनेट · अपोइन्टमेन्ट आवश्यक छैन' },
  Bengali: { lang: 'bn', title: 'বিনামূল্যে রক্তচাপ পরীক্ষা', sub: '5 মিনিট · অ্যাপয়েন্টমেন্টের প্রয়োজন নেই' },
  Spanish: { lang: 'es', title: 'Control gratuito de la presión arterial', sub: '5 minutos · Sin cita previa' },
  Italian: { lang: 'it', title: 'Controllo gratuito della pressione', sub: '5 minuti · Senza appuntamento' },
  Maltese: { lang: 'mt', title: "Kontroll b'xejn tal-pressjoni tad-demm", sub: "5 minuti · M'hemmx bżonn appuntament" },
  German: { lang: 'de', title: 'Kostenlose Blutdruckmessung', sub: '5 Minuten · Ohne Termin' },
  Gujarati: { lang: 'gu', title: 'મફત બ્લડ પ્રેશર તપાસ', sub: '5 મિનિટ · એપોઇન્ટમેન્ટની જરૂર નથી' },
  Tamil: { lang: 'ta', title: 'இலவச இரத்த அழுத்தப் பரிசோதனை', sub: '5 நிமிடங்கள் · முன்பதிவு தேவையில்லை' },
  Serbian: { lang: 'sr', title: 'Бесплатно мерење крвног притиска', sub: '5 минута · Није потребно заказивање' },
  French: { lang: 'fr', title: 'Contrôle gratuit de la tension artérielle', sub: '5 minutes · Sans rendez-vous' },
  Greek: { lang: 'el', title: 'Δωρεάν μέτρηση πίεσης', sub: '5 λεπτά · Χωρίς ραντεβού' },
  Croatian: { lang: 'hr', title: 'Besplatno mjerenje krvnog tlaka', sub: '5 minuta · Bez naručivanja' },
};

// Languages we deliberately don't print a draft for, with the reason shown on the poster page.
export const NEEDS_TRANSLATOR = {
  Samoan: 'An earlier draft line was not reliable, so it was removed.',
  Assyrian: 'Assyrian Neo-Aramaic: work with a community translator.',
  Chaldean: 'Chaldean Neo-Aramaic: work with a community translator.',
};
