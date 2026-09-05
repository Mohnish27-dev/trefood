/**
 * Vendor Console Bilingual Dictionary (English / Simple Everyday Hindi).
 *
 * Uses conversational, natural Hindi (बोलचाल की सरल हिंदी) that canteen staff
 * and kitchen managers easily understand, avoiding bookish or difficult pure-Hindi words.
 */

export type VendorLanguage = "en" | "hi";

export interface TranslationItem {
  en: string;
  hi: string;
}

export const VENDOR_STRINGS = {
  // ── Navigation & Header ──────────────────────────────────────────
  navOrders: { en: "Orders", hi: "ऑर्डर" },
  navMenu: { en: "Menu", hi: "मेन्यू" },
  navEarnings: { en: "Earnings", hi: "कमाई" },
  navSettings: { en: "Settings", hi: "सेटिंग्स" },
  takingOrders: { en: "Taking orders", hi: "ऑर्डर चालू हैं" },
  closed: { en: "Closed", hi: "दुकान बंद है" },
  autoClosed: { en: "Auto-closed", hi: "सिस्टम द्वारा बंद" },
  autoClosedBannerTitle: { en: "Auto-closed", hi: "दुकान अपने आप बंद हो गई" },
  autoClosedBannerDesc: {
    en: "Three orders were not answered today, so TREFOOD stopped sending you more. Flip the switch above when someone is at the tablet again.",
    hi: "आज 3 ऑर्डर का समय पर जवाब नहीं मिला, इसलिए नए ऑर्डर रोक दिए गए हैं। काउंटर पर वापस आने पर ऊपर का स्विच ऑन करें।",
  },
  signOut: { en: "Sign out", hi: "लॉग आउट" },
  stopTakingOrders: { en: "Stop taking orders", hi: "ऑर्डर लेना बंद करें" },
  startTakingOrders: { en: "Start taking orders", hi: "ऑर्डर लेना शुरू करें" },

  // ── Board Columns & Stats ────────────────────────────────────────
  colNewOrders: { en: "New Orders", hi: "नए ऑर्डर" },
  colPreparing: { en: "Preparing", hi: "बन रहा है" },
  colOnTheWay: { en: "On the Way", hi: "रास्ते में है" },
  hintNewOrders: {
    en: "Accept or reject within 4 minutes",
    hi: "4 मिनट के अंदर स्वीकार या मना करें",
  },
  hintPreparing: {
    en: "Cooking food. Tap 'Mark on the way' when dispatched.",
    hi: "खाना बन रहा है। भेजने के बाद 'रास्ते में है' पर टैप करें।",
  },
  hintOnTheWay: {
    en: "Rider on the way. Call student upon arrival at gate.",
    hi: "डिलीवरी वाला रास्ते में है। गेट पर पहुंचकर छात्र को कॉल करें।",
  },
  ordersToday: { en: "orders today", hi: "ऑर्डर आज" },
  orderToday: { en: "order today", hi: "ऑर्डर आज" },
  yourShare: { en: "Your share", hi: "आपकी कमाई" },
  boardNotUpdatingTitle: { en: "The board is not updating", hi: "बोर्ड अपडेट नहीं हो रहा है" },
  boardNotUpdatingDesc: {
    en: "We cannot reach TREFOOD right now. Orders already placed are safe; this screen just cannot see them.",
    hi: "इंटरनेट कनेक्शन में समस्या है। ऑर्डर सुरक्षित हैं, कनेक्शन आते ही दिखेंगे।",
  },
  nothingCookingTitle: { en: "Nothing cooking", hi: "अभी कोई ऑर्डर नहीं है" },
  nothingCookingDesc: {
    en: "New orders land here with a chime and a 4-minute countdown. Leave this screen open and the tablet awake.",
    hi: "नया ऑर्डर आने पर घंटी बजेगी और 4 मिनट का समय मिलेगा। इस स्क्रीन को खुला रखें।",
  },

  // ── Order Card Details & Statuses ────────────────────────────────
  cash: { en: "Cash", hi: "कैश (COD)" },
  prepaid: { en: "Prepaid", hi: "ऑनलाइन भुगतान" },
  acceptWithin: { en: "Accept within", hi: "स्वीकार करने का समय" },
  packagingAndDelivery: { en: "Packaging & delivery", hi: "पैकिंग और डिलीवरी" },
  total: { en: "Total", hi: "कुल" },
  collectOnDelivery: { en: "Collect on delivery", hi: "गेट पर कैश लेना है" },
  minPrep: { en: "min prep", hi: "मिनट में तैयार" },
  custom: { en: "custom", hi: "कस्टम" },
  customTime: { en: "Custom...", hi: "अन्य समय..." },
  accept: { en: "Accept", hi: "स्वीकार करें" },
  reject: { en: "Reject", hi: "मना करें" },
  printKot: { en: "Print KOT", hi: "पर्ची (KOT) प्रिंट करें" },
  outOfStockItem: { en: "86 an item", hi: "आइटम खत्म हो गया (86)" },
  markOnTheWay: { en: "Mark on the way", hi: "रास्ते में भेजें" },
  riderAtGate: { en: "Rider at gate", hi: "डिलीवरी वाला गेट पर पहुंच गया" },
  callCustomer: { en: "Call customer", hi: "छात्र को कॉल करें" },
  confirmCashReceived: { en: "Confirm cash received", hi: "कैश मिल गया (पुष्टि करें)" },
  cashRefusedAction: { en: "Refused / Not paid", hi: "पैसे देने से मना किया" },
  noShowAction: { en: "No-show", hi: "छात्र नहीं आया (No Show)" },
  rerouteGate: { en: "Gate closed? Reroute", hi: "गेट बंद है? दूसरे गेट भेजें" },
  packetCodeWrittenPrompt: {
    en: "Write this 4-digit code on the packet:",
    hi: "यह 4 अंकों का कोड पैकेट पर लिखें:",
  },
  waitingStudentConfirm: {
    en: "Waiting for student to match packet code...",
    hi: "छात्र पैकेट का कोड देखकर पुष्टि करेगा...",
  },
  markReady: { en: "Mark Ready", hi: "तैयार (Ready) मार्क करें" },
  deliveredSuccess: { en: "Delivered", hi: "डिलीवर हो गया" },
  rejectedStatus: { en: "Rejected", hi: "रद्द किया गया" },
  expiredStatus: { en: "Expired (No Ack)", hi: "समय समाप्त" },

  // ── Modals & Dialogs ─────────────────────────────────────────────
  rejectDialogTitle: { en: "Reject this order?", hi: "क्या यह ऑर्डर मना करना चाहते हैं?" },
  rejectDialogDesc: {
    en: "The student will be refunded automatically. Frequent rejections hurt your platform score.",
    hi: "छात्र को तुरंत रिफंड मिल जाएगा। बार-बार मना करने से स्टोर रेटिंग कम होती है।",
  },
  rejectReasonPlaceholder: {
    en: "Reason for rejection (e.g. kitchen busy, item finished)",
    hi: "मना करने का कारण लिखें (उदा. रसोई व्यस्त है, सामान खत्म हो गया)",
  },
  confirmReject: { en: "Confirm Reject", hi: "मना करने की पुष्टि करें" },
  cancel: { en: "Cancel", hi: "वापस जाएं" },

  customTimeDialogTitle: { en: "Custom Preparation Time", hi: "तैयारी का समय चुनें" },
  customTimeDialogDesc: {
    en: "Enter preparation time in minutes (5 to 60 minutes):",
    hi: "मिनटों में समय दर्ज करें (5 से 60 मिनट तक):",
  },
  minutes: { en: "Minutes", hi: "मिनट" },
  acceptWithTime: { en: "Accept Order", hi: "ऑर्डर स्वीकार करें" },

  rerouteDialogTitle: { en: "Reroute to Main Gate?", hi: "मेन गेट पर भेजें?" },
  rerouteDialogDesc: {
    en: "If the hostel gate is locked, reroute delivery to the 24x7 Main Gate. The student will be notified immediately.",
    hi: "यदि हॉस्टल गेट बंद है, तो डिलीवरी 24x7 मेन गेट पर ट्रांसफर करें। छात्र को तुरंत सूचित किया जाएगा।",
  },
  confirmReroute: { en: "Reroute to Main Gate", hi: "मेन गेट पर ट्रांसफर करें" },

  cashRefusedTitle: { en: "Student Refused Payment?", hi: "छात्र ने पैसे नहीं दिए?" },
  cashRefusedDesc: {
    en: "Rider must NOT hand over the food. The food returns to your restaurant, the student COD token is forfeited to you, and COD will be blocked on their account.",
    hi: "खाना बिल्कुल न दें। खाना वापस ले आएं, छात्र का ऑनलाइन टोकन आपको मिलेगा और उसका COD ब्लॉक कर दिया जाएगा।",
  },
  confirmRefused: { en: "Confirm Refusal", hi: "पुष्टि करें (खाना वापस लाएं)" },

  // ── Menu Manager ─────────────────────────────────────────────────
  searchMenuPlaceholder: { en: "Search menu items...", hi: "मेन्यू में आइटम खोजें..." },
  findAnItem: { en: "Find an item", hi: "आइटम खोजें" },
  itemsOffMenu: { en: "items off the menu", hi: "आइटम मेन्यू से बाहर" },
  itemOffMenu: { en: "item off the menu", hi: "आइटम मेन्यू से बाहर" },
  everythingOn: { en: "Everything is on", hi: "सभी आइटम उपलब्ध हैं" },
  ordersAlreadyContain: { en: "orders already contain", hi: "ऑर्डर में यह आइटम शामिल है:" },
  orderAlreadyContains: { en: "order already contains", hi: "ऑर्डर में यह आइटम शामिल है:" },
  affectedOrdersExplanation: {
    en: "Open each one on the board and tap 86 on that line. The student then gets five minutes to swap it, drop it, or cancel — after which we drop it for them and refund that line.",
    hi: "बोर्ड पर उस ऑर्डर को खोलें और 86 पर टैप करें। छात्र को 5 मिनट में बदलाव करने या रद्द करने का विकल्प मिलेगा।",
  },
  dismiss: { en: "Dismiss", hi: "हटाएं" },
  nothingMatches: { en: "Nothing matches that", hi: "कुछ नहीं मिला" },
  nothingMatchesDesc: {
    en: "Try a shorter search, or clear it to see the whole menu.",
    hi: "सर्च साफ़ करें या छोटा नाम खोजें।",
  },
  noMenuYet: { en: "No menu yet", hi: "मेन्यू खाली है" },
  noMenuYetDesc: {
    en: "Your menu has not been published. Ask TREFOOD ops to load it and it will appear here.",
    hi: "मेन्यू अभी पब्लिश नहीं हुआ है। TREFOOD सपोर्ट से संपर्क करें।",
  },
  addOnGroup: { en: "add-on group", hi: "ऑप्शन ग्रुप" },
  addOnGroups: { en: "add-on groups", hi: "ऑप्शन ग्रुप" },
  statusOn: { en: "On", hi: "चालू" },
  status86: { en: "86", hi: "86 (बंद)" },
  inStock: { en: "In Stock", hi: "उपलब्ध है" },
  outOfStock: { en: "Out of stock (86)", hi: "खत्म हो गया (86)" },
  stockToggleHint: {
    en: "Toggle off to immediately hide from students",
    hi: "सामान खत्म होने पर बंद करें ताकि छात्र ऑर्डर न कर सकें",
  },
  addOnsCount: { en: "add-on options", hi: "ऑप्शन उपलब्ध हैं" },
  affectedOrdersAlert: {
    en: "This item is in active kitchen orders. Resolution sent to student.",
    hi: "यह आइटम वर्तमान ऑर्डर में है। छात्र को विकल्प भेज दिया गया है।",
  },

  // ── Earnings View ────────────────────────────────────────────────
  todayGross: { en: "Today, gross", hi: "आज की कुल बिक्री" },
  deliveredOrders: { en: "delivered orders", hi: "डिलीवर किए गए ऑर्डर" },
  deliveredOrder: { en: "delivered order", hi: "डिलीवर किया गया ऑर्डर" },
  platformCommission: { en: "Platform Commission", hi: "प्लेटफॉर्म कमीशन" },
  trefoodCommission: { en: "TREFOOD commission", hi: "TREFOOD कमीशन" },
  commissionChargedOn: {
    en: "Charged on food, packaging and delivery",
    hi: "खाने, पैकिंग और डिलीवरी पर कमीशन",
  },
  cashWithYou: { en: "Cash already with you", hi: "कैश (जो आपके पास जमा है)" },
  cashOrdersSettled: { en: "cash orders, settled at the gate", hi: "कैश ऑर्डर, गेट पर सेटल" },
  cashOrderSettled: { en: "cash order, settled at the gate", hi: "कैश ऑर्डर, गेट पर सेटल" },
  cashSettledAtGate: {
    en: "Cash collected at gate, self-settled",
    hi: "गेट पर मिला कैश, आपका ही है",
  },
  awaitingBankTransfer: { en: "Awaiting bank transfer", hi: "बैंक ट्रांसफर बाकी" },
  payoutStatementsWritten: {
    en: "Prepaid orders pending nightly transfer",
    hi: "रात में बैंक खाते में भेजी जाने वाली राशि",
  },
  statementsWrittenPending: {
    en: "Statements written but not yet paid",
    hi: "स्टेटमेंट बन चुकी है, भुगतान जल्द होगा",
  },
  lastSevenDays: { en: "Last seven days", hi: "पिछले 7 दिन" },
  day: { en: "Day", hi: "दिन" },
  ordersCount: { en: "Orders", hi: "ऑर्डर" },
  gross: { en: "Gross", hi: "कुल बिक्री" },
  commission: { en: "Commission", hi: "कमीशन" },
  netShare: { en: "Your share", hi: "आपकी कमाई" },
  ofWhichCash: { en: "Of which cash", hi: "जिसमें से कैश" },
  adjustments: { en: "Adjustments", hi: "कटौती / समायोजन" },
  adjustmentsTotal: { en: "Total", hi: "कुल" },
  noAdjustments: { en: "No adjustments", hi: "कोई कटौती नहीं" },
  noAdjustmentsDesc: {
    en: "Refund gateway fees and dispute debits would appear here. An empty list is a good list.",
    hi: "रिफंड या पेनाल्टी यहां दिखेगी। अभी कोई कटौती नहीं है।",
  },
  when: { en: "When", hi: "तारीख" },
  reason: { en: "Reason", hi: "कारण" },
  amount: { en: "Amount", hi: "राशि" },
  statements: { en: "Statements", hi: "स्टेटमेंट्स" },
  downloadCsv: { en: "Download CSV", hi: "CSV डाउनलोड करें" },
  noStatementsYet: { en: "No statements yet", hi: "अभी कोई स्टेटमेंट नहीं है" },
  noStatementsDesc: {
    en: "One is written for you every night at 23:59. Cash orders are already settled and never appear on it.",
    hi: "रोज़ रात 11:59 पर स्टेटमेंट तैयार होती है। कैश ऑर्डर पहले ही सेटल हो चुके होते हैं।",
  },
  prepaidOrders: { en: "Prepaid orders", hi: "ऑनलाइन ऑर्डर" },
  netPayable: { en: "Net payable", hi: "कुल भुगतान राशि" },
  carriedForward: { en: "Carried forward", hi: "आगे जोड़ी गई राशि" },
  settlementHistory: { en: "Settlement History & Payouts", hi: "बैंक ट्रांसफर और भुगतान का इतिहास" },
  status: { en: "Status", hi: "स्थिति" },
  paid: { en: "Paid", hi: "भुगतान हो गया" },
  pending: { en: "Pending", hi: "प्रक्रिया में" },
  downloadStatement: { en: "Download CSV Statement", hi: "स्टेटमेंट डाउनलोड करें" },

  // ── Settings ─────────────────────────────────────────────────────
  restaurantSettings: { en: "Restaurant Settings", hi: "रेस्टोरेंट सेटिंग्स" },
  contactInfo: { en: "Contact Information", hi: "संपर्क जानकारी" },
  operatingHours: { en: "Operating Hours", hi: "खुलने व बंद होने का समय" },
  prepTimeHeading: { en: "Default Prep Time", hi: "तैयारी का औसत समय" },
  serviceSection: { en: "Service", hi: "सर्विस सेटिंग्स" },
  serviceSectionDesc: {
    en: "Prep time is the estimate students see before they order. The real one is set per order when you accept.",
    hi: "यह समय छात्रों को ऑर्डर से पहले दिखता है। वास्तविक समय ऑर्डर स्वीकार करते समय तय होता है।",
  },
  typicalPrepTime: { en: "Typical prep time (minutes)", hi: "औसत तैयारी का समय (मिनट)" },
  phoneStudentsCall: { en: "Phone students and TREFOOD call", hi: "छात्र व TREFOOD संपर्क नंबर" },
  opens: { en: "Opens", hi: "खुलने का समय" },
  closes: { en: "Closes", hi: "बंद होने का समय" },
  closingAfterMidnight: {
    en: "Closing after midnight — that is fine, and it is how the late-night window works.",
    hi: "आधी रात के बाद बंद होना सामान्य है (लेट नाइट डिलीवरी)।",
  },
  chargesSection: { en: "Charges", hi: "शुल्क और कमीशन" },
  chargesSectionDesc: {
    en: "TREFOOD takes {pct}% of food, packaging and delivery combined. The delivery fee is set per campus and comes to you in full.",
    hi: "TREFOOD खाने, पैकिंग और डिलीवरी पर {pct}% कमीशन लेता है। डिलीवरी शुल्क पूरा आपको मिलता है।",
  },
  packagingFee: { en: "Packaging fee (rupees)", hi: "पैकिंग शुल्क (रुपये)" },
  minOrder: { en: "Minimum order (rupees)", hi: "न्यूनतम ऑर्डर (रुपये)" },
  campusDeliveryFee: {
    en: "Campus delivery fee, paid to you:",
    hi: "कैंपस डिलीवरी शुल्क (जो आपको मिलेगा):",
  },
  gatesYouDeliverTo: { en: "Gates you deliver to", hi: "गेट जहां डिलीवरी उपलब्ध है" },
  gatesDesc: {
    en: "This decides who can see you at all. A student picks their gate before browsing, so unticking one removes you from that hostel's list entirely.",
    hi: "छात्र अपने गेट के आधार पर दुकान देखते हैं। किसी गेट को हटाने पर वहां के छात्र ऑर्डर नहीं कर सकेंगे।",
  },
  open247: { en: "Open 24×7", hi: "24×7 खुला है" },
  shuts: { en: "Shuts", hi: "बंद होता है" },
  noGatesSelected: {
    en: "With no gates selected, no student on this campus can order from you.",
    hi: "कोई भी गेट न चुनने पर कोई छात्र ऑर्डर नहीं कर सकेगा।",
  },
  saveSettings: { en: "Save settings", hi: "सेटिंग्स सेव करें" },
  saving: { en: "Saving...", hi: "सेव हो रहा है..." },
  savedSuccessfully: { en: "Saved successfully", hi: "सफलतापूर्वक सेव हो गया" },

  // ── Page Titles & Subtitles ─────────────────────────────────────
  menuPageTitle: { en: "Menu", hi: "मेन्यू" },
  menuPageSubtitle: {
    en: "Flip a switch to take something off. It disappears from every new order immediately.",
    hi: "किसी आइटम को बंद करने के लिए स्विच टॉगल करें। यह तुरंत नए ऑर्डर में दिखना बंद हो जाएगा।",
  },
  earningsPageTitle: { en: "Earnings", hi: "कमाई" },
  earningsPageSubtitle: {
    en: "Cash orders are settled the moment the rider is paid — only prepaid orders wait for a bank transfer.",
    hi: "कैश ऑर्डर डिलीवरी के समय ही सेटल हो जाते हैं — केवल ऑनलाइन प्रीपेड ऑर्डर बैंक ट्रांसफर का इंतज़ार करते हैं।",
  },
  settingsPageTitle: { en: "Settings", hi: "सेटिंग्स" },
  settingsPageSubtitle: {
    en: "Hours, fees and the gates you serve. Everything here is visible to students.",
    hi: "समय, शुल्क और वो गेट जहां आप डिलीवरी करते हैं। यहां की हर जानकारी छात्रों को दिखती है।",
  },

  // ── Language Toggle Labels ───────────────────────────────────────
  languageToggleLabel: { en: "Language", hi: "भाषा" },
  english: { en: "English", hi: "English" },
  hindi: { en: "हिंदी", hi: "हिंदी" },
} as const;

export type VendorStringKey = keyof typeof VENDOR_STRINGS;

/**
 * Localizes an adjustment note (e.g. gateway recovery, disputes, stockouts) into simple Hindi.
 */
export function localizeLedgerNote(note: string, lang: VendorLanguage): string {
  if (lang !== "hi") return note;

  // "Gateway fee not returned on refund of TRF-NITP-0008"
  const gwMatch = note.match(/Gateway fee not returned on refund of\s+([A-Z0-9-]+)/i);
  if (gwMatch) {
    return `ऑर्डर ${gwMatch[1]} के रिफंड पर गेटवे शुल्क कटौती`;
  }

  // "Dispute upheld on TRF-NITP-0008: ..."
  const disputeMatch = note.match(/Dispute upheld on\s+([A-Z0-9-]+)(:\s*(.*))?/i);
  if (disputeMatch) {
    const orderNum = disputeMatch[1];
    const reason = disputeMatch[3];
    return reason
      ? `ऑर्डर ${orderNum} पर विवाद कटौती: ${reason}`
      : `ऑर्डर ${orderNum} पर विवाद कटौती`;
  }

  // "... was unavailable and removed (F6)"
  const stockoutMatch = note.match(/(.*)\s+was unavailable and removed \(F6\)/i);
  if (stockoutMatch) {
    return `${stockoutMatch[1]} उपलब्ध नहीं था, इसलिए ऑर्डर से हटाया गया (86)`;
  }

  // "... ran out; student chose to cancel (F6)"
  const cancelMatch = note.match(/(.*)\s+ran out; student chose to cancel \(F6\)/i);
  if (cancelMatch) {
    return `${cancelMatch[1]} खत्म हो गया; छात्र ने ऑर्डर रद्द किया (86)`;
  }

  return note;
}

/**
 * Localizes ledger adjustment type tags.
 */
export function localizeLedgerType(type: string, lang: VendorLanguage): string {
  if (lang !== "hi") return type.replaceAll("_", " ").toLowerCase();
  switch (type.toUpperCase()) {
    case "REFUND_GATEWAY_RECOVERY":
      return "रिफंड गेटवे शुल्क वसूली";
    case "DISPUTE_DEBIT":
      return "विवाद कटौती";
    case "STOCKOUT_SHORTFALL":
      return "आइटम अनुपलब्धता (86)";
    case "PENALTY":
      return "पेनाल्टी / जुर्माना";
    case "MANUAL_ADJUSTMENT":
      return "एडमिन समायोजन";
    case "CARRY_FORWARD":
      return "पिछला बकाया";
    default:
      return type.replaceAll("_", " ").toLowerCase();
  }
}

/**
 * Formats a campus date string (e.g. "2026-09-04") localized to Hindi or English.
 */
export function formatCampusDateLocalized(dateString: string, lang: VendorLanguage): string {
  const d = new Date(`${dateString}T12:00:00Z`);
  if (lang === "hi") {
    return d.toLocaleDateString("hi-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
