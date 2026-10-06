/**
 * Traducción de la interfaz "de fábrica" del CV (títulos de sección y
 * etiquetas de campo TAL COMO están en database.ts, en inglés) a otros
 * idiomas, más el idioma de las fechas — controlado por un campo del CV
 * (CVVersion.displayLanguage), no de la template.
 *
 * IMPORTANTE — qué es esto y qué NO es (§21 del contexto: "No habrá
 * traducción automática... no se debe implementar un servicio externo de
 * traducción"):
 *
 * - Esto es un diccionario ESTÁTICO y LOCAL de un puñado de textos fijos
 *   que la propia app pone por defecto (títulos de sección, etiquetas de
 *   campo como "Location" o "Level") — no un traductor. No hay ninguna
 *   llamada externa ni modelo de lenguaje de por medio.
 * - SOLO traduce texto que coincide EXACTAMENTE con uno de estos valores
 *   por defecto. En cuanto el usuario edita un título de sección o el
 *   contenido de un campo, deja de coincidir con la clave del diccionario
 *   y se queda tal cual el usuario lo escribió — nunca se traduce
 *   contenido propio del usuario (descripciones, nombres de proyectos,
 *   etc.), solo esta "cascarilla" que la app genera.
 * - Si se quiere el CV en un idioma no soportado aquí, la vía que ya
 *   existía sigue abierta: renombrar secciones/campos a mano (§21: "el
 *   usuario debe poder modificarlos").
 */

/** Mapeo del código corto de idioma guardado en el CV a un locale BCP-47 usable por Intl. */
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
  zh: "zh-CN",
  ja: "ja-JP",
  hi: "hi-IN",
  ar: "ar-EG",
};

export const SUPPORTED_DISPLAY_LANGUAGES = Object.keys(LOCALE_BY_LANGUAGE);

/** BCP-47 para Intl/toLocaleDateString, a partir del código corto guardado en el CV. */
export function localeForDisplayLanguage(lang: string | null | undefined): string {
  if (!lang) return LOCALE_BY_LANGUAGE.en!;
  return LOCALE_BY_LANGUAGE[lang] ?? LOCALE_BY_LANGUAGE.en!;
}

/** "Actualidad"/"Present"/... para DateRangeValue.current — ver formatting.ts. */
const CURRENT_LABEL_BY_LANGUAGE: Record<string, string> = {
  es: "Actualidad",
  en: "Present",
  fr: "Aujourd'hui",
  de: "Heute",
  pt: "Atualidade",
  it: "Presente",
  zh: "至今",
  ja: "現在",
  hi: "वर्तमान",
  ar: "حتى الآن",
};

export function currentLabelForDisplayLanguage(lang: string | null | undefined): string {
  if (!lang) return CURRENT_LABEL_BY_LANGUAGE.en!;
  return CURRENT_LABEL_BY_LANGUAGE[lang] ?? CURRENT_LABEL_BY_LANGUAGE.en!;
}

/**
 * Diccionario texto-por-defecto -> traducción, por idioma. El inglés es la
 * base (lo que ya hay en database.ts) así que no necesita entrada propia:
 * elegir "en" es un no-op.
 */
const LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    // Títulos de sección
    "Personal information": "Información personal",
    Experience: "Experiencia",
    Education: "Educación",
    Projects: "Proyectos",
    Skills: "Habilidades",
    Languages: "Idiomas",
    Certifications: "Certificaciones",
    Awards: "Premios",
    Publications: "Publicaciones",
    Courses: "Cursos",
    Volunteering: "Voluntariado",
    References: "Referencias",
    // Etiquetas de campo
    "Full name": "Nombre completo",
    "Headline / role": "Titular / puesto",
    Email: "Correo electrónico",
    Phone: "Teléfono",
    Location: "Ubicación",
    "Links (portfolio, GitHub, LinkedIn...)": "Enlaces (portfolio, GitHub, LinkedIn...)",
    Links: "Enlaces",
    Summary: "Resumen",
    Role: "Puesto",
    Company: "Empresa",
    Dates: "Fechas",
    Description: "Descripción",
    Technologies: "Tecnologías",
    Degree: "Titulación",
    Institution: "Institución",
    Title: "Título",
    Subtitle: "Subtítulo",
    Skill: "Habilidad",
    Level: "Nivel",
    Language: "Idioma",
    Tool: "Herramienta",
    "Programming Languages": "Lenguajes de programación",
    "Soft Skills": "Habilidades blandas",
    Name: "Nombre",
    Issuer: "Emisor",
    Date: "Fecha",
    Venue: "Publicado en",
    Organization: "Organización",
    Relation: "Relación",
    Contact: "Contacto",
  },
  zh: {
    "Personal information": "个人信息", Experience: "工作经历", Education: "教育经历", Projects: "项目", Skills: "技能", Languages: "语言",
    Certifications: "证书", Awards: "奖项", Publications: "出版物", Courses: "课程", Volunteering: "志愿服务", References: "推荐人",
    "Full name": "姓名", "Headline / role": "标题 / 职位", Email: "电子邮箱", Phone: "电话", Location: "地点", "Links (portfolio, GitHub, LinkedIn...)": "链接（作品集、GitHub、LinkedIn…）", Links: "链接",
    Summary: "简介", Role: "职位", Company: "公司", Dates: "日期", Description: "描述", Technologies: "技术", Degree: "学位", Institution: "院校", Title: "标题", Subtitle: "副标题", Skill: "技能", Level: "级别", Language: "语言", Tool: "工具", "Programming Languages": "编程语言", "Soft Skills": "软技能", Name: "名称", Issuer: "颁发机构", Date: "日期", Venue: "发表平台", Organization: "组织", Relation: "关系", Contact: "联系方式",
  },
  ja: {
    "Personal information": "個人情報", Experience: "職務経験", Education: "学歴", Projects: "プロジェクト", Skills: "スキル", Languages: "言語",
    Certifications: "資格", Awards: "受賞歴", Publications: "出版物", Courses: "講座", Volunteering: "ボランティア", References: "推薦者",
    "Full name": "氏名", "Headline / role": "見出し / 職種", Email: "メールアドレス", Phone: "電話番号", Location: "所在地", "Links (portfolio, GitHub, LinkedIn...)": "リンク（ポートフォリオ、GitHub、LinkedIn…）", Links: "リンク",
    Summary: "概要", Role: "職種", Company: "会社", Dates: "期間", Description: "説明", Technologies: "技術", Degree: "学位", Institution: "教育機関", Title: "タイトル", Subtitle: "サブタイトル", Skill: "スキル", Level: "レベル", Language: "言語", Tool: "ツール", "Programming Languages": "プログラミング言語", "Soft Skills": "ソフトスキル", Name: "名前", Issuer: "発行元", Date: "日付", Venue: "掲載先", Organization: "団体", Relation: "関係", Contact: "連絡先",
  },
  hi: {
    "Personal information": "व्यक्तिगत जानकारी", Experience: "अनुभव", Education: "शिक्षा", Projects: "परियोजनाएँ", Skills: "कौशल", Languages: "भाषाएँ",
    Certifications: "प्रमाणपत्र", Awards: "पुरस्कार", Publications: "प्रकाशन", Courses: "पाठ्यक्रम", Volunteering: "स्वयंसेवा", References: "संदर्भ",
    "Full name": "पूरा नाम", "Headline / role": "शीर्षक / भूमिका", Email: "ईमेल", Phone: "फ़ोन", Location: "स्थान", "Links (portfolio, GitHub, LinkedIn...)": "लिंक (पोर्टफ़ोलियो, GitHub, LinkedIn...)" , Links: "लिंक",
    Summary: "सारांश", Role: "भूमिका", Company: "कंपनी", Dates: "तारीखें", Description: "विवरण", Technologies: "तकनीक", Degree: "डिग्री", Institution: "संस्थान", Title: "शीर्षक", Subtitle: "उपशीर्षक", Skill: "कौशल", Level: "स्तर", Language: "भाषा", Tool: "टूल", "Programming Languages": "प्रोग्रामिंग भाषाएँ", "Soft Skills": "सॉफ्ट स्किल", Name: "नाम", Issuer: "जारीकर्ता", Date: "तारीख", Venue: "प्रकाशन स्थान", Organization: "संगठन", Relation: "संबंध", Contact: "संपर्क",
  },
  ar: {
    "Personal information": "المعلومات الشخصية", Experience: "الخبرة", Education: "التعليم", Projects: "المشروعات", Skills: "المهارات", Languages: "اللغات",
    Certifications: "الشهادات", Awards: "الجوائز", Publications: "المنشورات", Courses: "الدورات", Volunteering: "التطوع", References: "التوصيات",
    "Full name": "الاسم الكامل", "Headline / role": "العنوان / المسمى الوظيفي", Email: "البريد الإلكتروني", Phone: "الهاتف", Location: "الموقع", "Links (portfolio, GitHub, LinkedIn...)": "روابط (معرض الأعمال وGitHub وLinkedIn...)" , Links: "الروابط",
    Summary: "الملخص", Role: "المسمى الوظيفي", Company: "الشركة", Dates: "التواريخ", Description: "الوصف", Technologies: "التقنيات", Degree: "الدرجة العلمية", Institution: "المؤسسة التعليمية", Title: "العنوان", Subtitle: "العنوان الفرعي", Skill: "المهارة", Level: "المستوى", Language: "اللغة", Tool: "الأداة", "Programming Languages": "لغات البرمجة", "Soft Skills": "المهارات الشخصية", Name: "الاسم", Issuer: "الجهة المانحة", Date: "التاريخ", Venue: "مكان النشر", Organization: "المنظمة", Relation: "صلة القرابة", Contact: "جهة الاتصال",
  },
};

/**
 * Traduce un texto (título de sección o etiqueta de campo) si coincide
 * EXACTAMENTE con uno de los valores por defecto conocidos para ese
 * idioma; si no coincide (texto personalizado por el usuario, o idioma sin
 * diccionario), lo devuelve tal cual, sin tocarlo.
 */
export function translateDefaultLabel(text: string, lang: string | null | undefined): string {
  if (!lang) return text;
  const dict = LABEL_TRANSLATIONS[lang];
  if (!dict) return text;
  return dict[text] ?? text;
}
