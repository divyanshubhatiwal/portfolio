// Hindi text for /hi/. Machine-assisted translation: please have a native speaker review it before
// relying on it. Technical terms, product names and code stay in English, as is usual in Indian tech writing.
import { PROFILE, PROJECTS } from '@/data/site';
import type { DataDict, Dict } from './types';

export type { Dict } from './types';

export const HI: Dict & { data: DataDict } = {
  meta: {
    description: 'B.Tech CSE (AI & ML) का छात्र और इंजीनियर, जो LLM एजेंट, बैकएंड सर्विस, फ़ुल-स्टैक प्रोडक्ट और मोबाइल ऐप बनाता है।',
    skip: 'मुख्य सामग्री पर जाएँ', switchLabel: 'English', switchTitle: 'Read this page in English',
  },
  nav: { about: 'परिचय', skills: 'कौशल', experience: 'अनुभव', projects: 'प्रोजेक्ट', cases: 'केस स्टडी', blog: 'ब्लॉग', contact: 'संपर्क', resume: 'रिज़्यूमे', downloadResume: 'रिज़्यूमे डाउनलोड करें' },
  hero: {
    status: 'नए अवसरों के लिए उपलब्ध',
    lede: 'मैं ऐसा सॉफ़्टवेयर बनाता हूँ जो अपना काम दिखाता है: AI एजेंट जो अपने असफल प्रयोगों से सीखते हैं, फ़ॉरेंसिक पाइपलाइन जो हर दावे का सबूत देती है, और ऐसे ऐप जिन्हें लोग सच में इस्तेमाल करते हैं।',
    viewWork: 'मेरा काम देखें', getInTouch: 'संपर्क करें',
    quote: '"जो टूल सिर्फ़ अपने अच्छे नतीजे दिखाए, वह टूल नहीं, विज्ञापन है।"', scroll: 'नीचे देखें',
  },
  about: {
    eyebrow: '01 / मेरे बारे में', title: 'पहले मापो, फिर दावा करो।',
    p1: 'मैं वहाँ काम करता हूँ जहाँ <strong>applied AI और प्रोडक्ट इंजीनियरिंग</strong> मिलते हैं। मैंने ऐसे LLM एजेंट बनाए हैं जो ख़ुद अपने प्रयोग डिज़ाइन करके चलाते हैं, एक फ़ॉरेंसिक पाइपलाइन जो कच्चे लॉग से घटना की टाइमलाइन दोबारा बनाती है, एक क्वांट ट्रेडिंग प्लेटफ़ॉर्म, और वेब व मोबाइल के लिए कंज़्यूमर ऐप।',
    p2: 'हर प्रोजेक्ट एक ही तरह शुरू होता है: <strong>दावा तय करो, baseline बनाओ, फिर मापो</strong>। अगर कोई सिस्टम यह नहीं दिखा सकता कि उसका जवाब कहाँ से आया, तो वह अभी अधूरा है।',
    focus: '> current_focus: LLM एजेंट, सबूत पर आधारित RAG, और production-grade फ़ुल-स्टैक ऐप।',
    statProjects: 'पूरे किए प्रोजेक्ट', statPlatforms: 'प्लेटफ़ॉर्म', statTech: 'मुख्य तकनीकें',
    portrait: 'तस्वीर:', openToWork: 'काम के लिए उपलब्ध',
    cards: [
      ['AI एजेंट और LLM', 'मल्टी-एजेंट सिस्टम, RAG और एजेंट लूप, जिन्हें Optuna TPE जैसे असली baseline से परखा गया है।'],
      ['फ़ुल-स्टैक डेवलपर', 'React, Node.js, Express और MongoDB, WebRTC वॉइस चैट से लेकर लाइव ट्रेडिंग टर्मिनल तक।'],
      ['प्रोडक्शन वाली सोच', 'तय नियमों वाले risk gate, offline-first डिज़ाइन, strict TypeScript और कोड के साथ आने वाले टेस्ट।'],
    ],
  },
  skills: { eyebrow: '02 / टूलबॉक्स', title: 'कौशल और तकनीकें', sub: 'वह स्टैक जिसे मैं किसी आइडिया को चलते हुए सिस्टम में बदलने के लिए चुनता हूँ।' },
  experience: { eyebrow: '03 / सफ़र', title: 'अनुभव', sub: 'मैंने कहाँ काम किया और क्या बनाकर दिया।' },
  projects: {
    eyebrow: '04 / काम', title: 'मुख्य प्रोजेक्ट', sub: 'ऐसे सिस्टम जो सिर्फ़ डेमो के लिए नहीं, मापे जाने के लिए बने हैं।', filterLabel: 'श्रेणी के हिसाब से प्रोजेक्ट छाँटें',
    all: 'सभी', caseStudy: 'केस स्टडी', tryIt: 'यहीं आज़माएँ', source: 'सोर्स कोड', live: 'लाइव डेमो ↗', shot: 'स्क्रीनशॉट:',
    focusShown: 'मेरा <b></b> काम पहले दिखाया जा रहा है।', focusReset: 'सामान्य क्रम दिखाएँ',
  },
  github: {
    eyebrow: '05 / ओपन सोर्स', title: 'GitHub और कोडिंग गतिविधि',
    sub: 'मेरी GitHub और LeetCode प्रोफ़ाइल से सीधे: योगदान, भाषाएँ, हल किए गए सवाल और हाल में किया गया काम।',
    repos: 'पब्लिक रिपॉज़िटरी', followers: 'फ़ॉलोअर', since: 'GitHub पर कब से', langs: 'मुख्य भाषाएँ', solved: 'हल किए',
    easy: 'आसान', medium: 'मध्यम', hard: 'कठिन', rating: 'कॉन्टेस्ट रेटिंग', contests: 'कॉन्टेस्ट', ranking: 'वैश्विक रैंक',
    graph: 'पिछले एक साल का योगदान', graphAlt: 'GitHub योगदान ग्राफ़:',
  },
  certs: { eyebrow: '06 / प्रमाणपत्र', title: 'सर्टिफ़िकेशन', sub: 'कोर्स और प्रमाणपत्र जो मेरे काम का आधार हैं।', view: 'प्रमाणपत्र देखें ↗' },
  ach: { eyebrow: '07 / उपलब्धियाँ', title: 'उपलब्धियाँ', sub: 'वे आँकड़े जिन पर मुझे गर्व है, और उनके पीछे के पड़ाव।' },
  contact: {
    eyebrow: '08 / संपर्क', title: 'आइए साथ काम करें।', sub: 'इंटर्नशिप, फ़ुल-टाइम नौकरी और दिलचस्प फ़्रीलांस प्रोजेक्ट के लिए उपलब्ध।',
    email: 'ईमेल', location: 'स्थान', quick: 'क्विक कनेक्ट खोलें', formTitle: 'संदेश भेजें', formSub: 'फ़ॉर्म भरें, संदेश सीधे मेरे इनबॉक्स में आएगा।',
    name: 'नाम', namePh: 'आपका नाम', subject: 'विषय', pick: 'विषय चुनें', subjects: ['प्रोजेक्ट के बारे में', 'नौकरी का अवसर', 'सामान्य सवाल'],
    message: 'संदेश', messagePh: 'अपनी बात बताइए...', send: 'संदेश भेजें',
  },
  footer: { built: 'Astro से बनी', updated: 'आख़िरी अपडेट:' },

  data: {
    roles: ['AI और फ़ुल-स्टैक इंजीनियर', 'LLM एजेंट बिल्डर', 'React और React Native डेवलपर', 'ऐसे सिस्टम जो अपना काम दिखाएँ'],
    skillGroups: { 'Languages': 'प्रोग्रामिंग भाषाएँ', 'Frontend & Mobile': 'फ़्रंटएंड और मोबाइल', 'Backend & Data': 'बैकएंड और डेटा', 'AI / ML': 'AI / ML' },
    categories: { 'AI / ML': 'AI / ML', 'Full-Stack': 'फ़ुल-स्टैक', 'Backend': 'बैकएंड', 'Mobile': 'मोबाइल' },
    projects: {
      'AutoSci': 'एक स्वचालित मल्टी-एजेंट रिसर्च सिस्टम। LLM एजेंट ML प्रयोगों की योजना बनाकर उन्हें चलाता है, फिर अपनी असफलताओं पर विचार करके तय करता है कि आगे क्या आज़माना है। इसे उसी बजट पर random search, Optuna TPE और सीमित LLM संस्करणों से तुलना करके परखा जाता है।',
      'Venture DAO': 'स्वचालित ट्रेडिंग और गवर्नेंस प्लेटफ़ॉर्म। स्पष्ट state machine वाला इंजन, idempotent ऑर्डर डिस्पैच, ऐसा risk preflight जिसे कोई भी कोड रास्ता छोड़ नहीं सकता, AES-256-GCM क्रेडेंशियल वॉल्ट, TOTP 2FA और 20+ Jest टेस्ट सूट।',
      'FlowBoard': 'AI वाला प्रोजेक्ट मैनेजमेंट ऐप, जिसमें 15+ व्यू (Kanban, Gantt, sprint, कैलेंडर, analytics) हैं और row-level security वाला रियल-टाइम Postgres बैकएंड है। LLM सादी भाषा से टास्क बनाता है, और उसके न चलने पर नियमों वाला विकल्प काम करता है।',
      'RideCompare': 'कई प्रोवाइडर का किराया एक जगह दिखाने वाली सर्विस। चार राइड-हेलिंग प्रोवाइडर से एक साथ किराया और ETA लेती है, उन्हें एक schema में बदलती है और ज़्यादा इस्तेमाल होने वाले रास्ते को Redis में cache करती है।',
      'SafeSignal AI': 'NLP वाला pharmacovigilance डेटा प्लेटफ़ॉर्म। दवा के दुष्प्रभाव की बिखरी रिपोर्टों को relational schema में बदलता है और ROR/PRR आँकड़ों से दवा-सुरक्षा के संकेत ढूँढता है, Elasticsearch सर्च और पूरे pytest सूट के साथ।',
      'Forensic Agent': 'सबूत पर आधारित घटना-जाँच। यह अलग-अलग तरह के लॉग को entity graph में बदलता है, असामान्य घटनाओं को रैंक करता है, उन्हें घटना-श्रृंखलाओं में जोड़ता है, और हर जवाब के हर कथन के साथ उसका स्रोत देता है।',
      'T20 Score Predictor': 'IPL जैसे simulated डेटा पर ML पाइपलाइन: पारी का डेटा बनाती है, मैच के दौरान के फ़ीचर तैयार करती है और Linear Regression की Random Forest से तुलना करती है। यह इस साइट पर आपके ब्राउज़र में चलती है, और ईमानदारी से दिखाती है कि मॉडल ने असल में क्या सीखा।',
      'Friends Talk': 'गुमनाम, आवाज़ से चलने वाली रैंडम चैट। एक टैप में आवाज़ से मैच, बिना कैमरा या अकाउंट के। इसमें अपनी signalling, matchmaking और moderation शामिल है।',
      'Breathe': 'offline-first साँस लेने का ऐप, जिसमें 60 FPS ऐनिमेटेड गाइड, box और 4-7-8 पैटर्न, ambient आवाज़, haptics, streak और रिमाइंडर हैं। न अकाउंट, न कोई नेटवर्क कॉल।',
      'Lumina': 'फ़ुल-स्टैक ब्लॉगिंग प्लेटफ़ॉर्म, जिसमें vector embeddings पर AI वाली semantic search और रियल-टाइम नोटिफ़िकेशन हैं।',
    },
    experience: [
      { role: 'स्वतंत्र इंजीनियर', org: 'स्व-निर्देशित प्रोजेक्ट', period: '2024 — अब तक', place: 'रिमोट',
        points: [
          'AutoSci डिज़ाइन करके बनाया, एक मल्टी-एजेंट रिसर्च harness जो LLM से चलने वाले प्रयोग-प्रस्तावकों की तुलना random search और Optuna TPE से करता है।',
          'सबूत पर आधारित फ़ॉरेंसिक पाइपलाइन बनाई जो कच्चे लॉग को स्रोत सहित घटना-टाइमलाइन में बदलती है, ground-truth evaluator के साथ।',
          'फ़ुल-स्टैक प्रोडक्ट (Venture DAO, Friends Talk) बनाकर Vercel और Render पर MongoDB Atlas के साथ डिप्लॉय किए।',
        ] },
      { role: 'मोबाइल डेवलपर', org: 'Breathe (निजी ऐप)', period: '2025', place: 'Android / iOS',
        points: [
          'offline-first Expo ऐप बनाया, जिसमें UI thread पर चलने वाला साँस का ऐनिमेशन 60 FPS का लक्ष्य रखता है।',
          'ऐसी सेशन टाइमिंग जोड़ी जो ऐप के बैकग्राउंड में जाने पर भी सही रहती है, साथ में haptics, ambient ऑडियो और लोकल रिमाइंडर।',
          'Strict TypeScript, Jest टेस्ट और APK, AAB व iOS के लिए EAS build पाइपलाइन।',
        ] },
      { role: 'B.Tech, CSE (AI & ML)', org: 'SRM Institute of Science and Technology', period: '2023 — 2027', place: 'दिल्ली-NCR कैंपस, गाज़ियाबाद',
        points: [
          `CGPA ${PROFILE.education.cgpa} / 10।`,
          'पढ़ाई के विषय: Data Structures & Algorithms, Operating Systems, DBMS, OOP, Compiler Design, Software Engineering & Project Management, Data Mining और NLP।',
        ] },
    ],
    certs: {
      'Introduction to Artificial Intelligence': 'AI की मूल अवधारणाएँ, मशीन लर्निंग और डीप लर्निंग की बुनियादी बातें, और AI के असली इस्तेमाल।',
      'Python (Basic)': 'Python के data types, control flow, functions और मूल syntax की कौशल परीक्षा।',
      'Java (Basic)': 'Java की बुनियादी बातें, OOP, classes और मुख्य भाषा-सुविधाओं की कौशल परीक्षा।',
      'Introduction to Data Science': 'डेटा साइंस की प्रक्रिया: डेटा जुटाना, साफ़ करना, समझना और मॉडल बनाना।',
      'Introduction to Natural Language Processing': 'टेक्स्ट की तैयारी, tokenisation, टेक्स्ट को दर्शाने के तरीके और NLP के आम काम।',
      'Data Analysis with Python & Pandas': 'Pandas से तालिका वाले डेटा को लोड करना, बदलना और उसका विश्लेषण करना।',
      'Data Mining': 'classification, clustering और association rules से डेटा में पैटर्न ढूँढना।',
    },
    stats: ['SRM IST में CGPA', 'बनाए गए प्रोजेक्ट', 'सर्टिफ़िकेशन', 'कक्षा XII (CBSE)'],
    milestones: [
      { when: 'अक्टूबर 2024', title: 'HackerRank Python और Java', text: 'Python और Java, दोनों में HackerRank कौशल सर्टिफ़िकेशन पास किए।' },
      { when: 'अप्रैल 2025', title: 'IBM: Introduction to AI', text: 'Coursera पर IBM का AI की बुनियाद वाला कोर्स पूरा किया।' },
      { when: '2025', title: 'Infosys Springboard के 4 कोर्स', text: 'Data Science, NLP, Pandas से Data Analysis और Data Mining।' },
      { when: '2026', title: 'Venture DAO पर 20+ टेस्ट सूट', text: 'हर Docker डिप्लॉय से पहले इंजन, auth, vault और venue adapters Jest से जाँचे जाते हैं।' },
      { when: '2026', title: 'लाइव प्रोडक्ट लॉन्च किए', text: 'Friends Talk friendstalk.fun पर लाइव है, और T20 Score Predictor इसी साइट पर ब्राउज़र में चलता है।' },
      { when: '2023 — अब तक', title: `${PROJECTS.length} प्रोजेक्ट, शुरू से आख़िर तक`, text: 'ML पाइपलाइन से लेकर बैकएंड सर्विस और मोबाइल ऐप तक, हर एक अकेले बनाया और संभाला।' },
    ],
  },
};
