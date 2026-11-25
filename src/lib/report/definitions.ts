/**
 * Структура командного отчёта Zetic: шкалы, роли, зоны матриц и пояснения.
 * Тексты пересказаны по методическим материалам отчёта.
 */

export const COMPETENCIES = [
  "Принятие решений",
  "Достижение результатов",
  "Убеждение и влияние",
  "Сотрудничество",
  "Лидерство",
  "Управление собой",
  "Стрессоустойчивость",
  "Ресурсность",
  "Стратегия",
  "Навыки управления",
  "Развитие бизнеса",
  "Проф. реализация",
] as const

export type Competency = (typeof COMPETENCIES)[number]

/** Пороги «светофора» по проявленности компетенции, % */
export const TRAFFIC_THRESHOLDS = { weak: 35, strong: 70 } as const

export type TrafficLevel = "weak" | "limited" | "strong"

export function trafficLevel(percent: number): TrafficLevel {
  if (percent < TRAFFIC_THRESHOLDS.weak) return "weak"
  if (percent >= TRAFFIC_THRESHOLDS.strong) return "strong"
  return "limited"
}

export const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  weak: "Слабое проявление характеристики",
  limited: "Проявление характеристики с ограничениями",
  strong: "Яркое проявление характеристики",
}

export const INTEGRAL_TEXT = {
  intro:
    "Матрица показывает, какие группы характеристик определяют рабочее поведение участников. Каждая компетенция расположена по двум осям:",
  axes: [
    "проявленность — насколько характеристика развита у большинства участников по сравнению с рынком;",
    "согласованность — насколько одинаково её проявляют участники группы.",
  ],
  strong:
    "Зелёная зона — характеристики, которые ярко и согласованно проявляются у большинства. Это ключевые ресурсы группы: за счёт них участники выполняют работу и добиваются результата.",
  weak:
    "Красная зона — характеристики, которые согласованно слабо проявляются у большинства. Это ключевые ограничения группы, которые мешают выполнению работы.",
}

export const TRAFFIC_TEXT =
  "Таблица в формате «светофора» показывает результаты каждого участника по ключевым компетенциям: сразу видно самые сильные и самые слабые стороны. Данные рассчитываются автоматически по ответам на опросник."

// ---------- Командные роли ----------

export type RoleFamily = "integrators" | "entrepreneurs" | "administrators" | "producers"

export const ROLE_FAMILIES: Record<
  RoleFamily,
  { title: string; short: string; description: string }
> = {
  integrators: {
    title: "Интеграторы",
    short: "Стремятся к передаче знаний и целостности культуры",
    description:
      "Работают на долгосрочную целостность культуры и передачу знаний: настраивают людей на совместную работу и создают атмосферу взаимного уважения.",
  },
  entrepreneurs: {
    title: "Предприниматели",
    short: "Стремятся к развитию бизнеса",
    description:
      "Думают о развитии продуктов и бизнеса в долгую: глубоко изучают запросы рынка и клиентов, предлагают новые направления — клиентов, решения, способы монетизации, рыночные ниши.",
  },
  administrators: {
    title: "Администраторы",
    short: "Стремятся к прозрачности и эффективности работы",
    description:
      "Обеспечивают прозрачность и единые стандарты в текущей работе: унифицируют процессы, структурируют информацию, следят за порядком и соблюдением общих правил.",
  },
  producers: {
    title: "Производители",
    short: "Нацелены на выполнение планов и продуктивность",
    description:
      "Сфокусированы на результате здесь и сейчас: прагматичны, нетерпеливы, организуют работу команды на достижение целей и получают удовольствие от личной вовлечённости и результата.",
  },
}

export interface Role {
  key: string
  name: string
  family: RoleFamily
  description: string
}

/** Сетка ролей 4×4: строки сверху вниз, столбцы слева направо. */
export const ROLE_GRID: Role[][] = [
  [
    { key: "magnet", name: "Магнит", family: "integrators", description: "Любит быть в центре внимания и пользуется поддержкой коллег; сплачивает коллектив и создаёт среду для общения и совместного развития." },
    { key: "facilitator", name: "Фасилитатор", family: "integrators", description: "Организует работу через выстраивание коммуникаций, помогает коллегам договориться между собой." },
    { key: "visionary", name: "Визионер", family: "entrepreneurs", description: "Мыслит абстрактно и концептуально, видит и формирует образ будущего." },
    { key: "adventurer", name: "Авантюрист", family: "entrepreneurs", description: "Действует по ситуации, смело берётся за новое и неопределённое, спокойно относится к рискам." },
  ],
  [
    { key: "negotiator", name: "Переговорщик", family: "integrators", description: "Умеет договариваться с пользой для себя и компании; решает задачи и продвигает работу через общение." },
    { key: "connector", name: "Коннектор", family: "integrators", description: "Обладает развитой эмпатией, легко заводит новые связи с коллегами, партнёрами и клиентами." },
    { key: "resource-seeker", name: "Искатель ресурсов", family: "entrepreneurs", description: "Гибко реагирует на изменения среды, предвидит их последствия и направляет ресурсы на развитие бизнеса." },
    { key: "inventor", name: "Изобретатель", family: "entrepreneurs", description: "Остро мыслит и соединяет разрозненные идеи в целостные решения; расширяет кругозор и любит сложные интеллектуальные задачи." },
  ],
  [
    { key: "keeper", name: "Хранитель", family: "administrators", description: "Выстраивает процессы и поддерживает порядок в коллективе." },
    { key: "inspirer", name: "Вдохновитель", family: "administrators", description: "Чуткий и проницательный, ищет системные решения и помогает другим структурировать работу." },
    { key: "organizer", name: "Организатор", family: "producers", description: "Добивается целей силами команды: собирает людей, ресурсы и инструменты и организует их работу." },
    { key: "improver", name: "Любитель улучшений", family: "producers", description: "Стремится повышать продуктивность и постоянно ищет, что можно улучшить." },
  ],
  [
    { key: "controller", name: "Контролёр", family: "administrators", description: "Следит за корректностью процессов и решений и за соблюдением правил; опирается на факты и цифры больше, чем на эмоции." },
    { key: "servant", name: "Благородный служитель", family: "administrators", description: "Ответственно и дисциплинированно выполняет работу, внимателен к деталям, ценит принадлежность к коллективу." },
    { key: "implementer", name: "Реализатор", family: "producers", description: "Ориентирован на выполнение задач, охотно сам погружается в детали и настойчиво доводит дело до конца." },
    { key: "problem-solver", name: "Решатель проблем", family: "producers", description: "Подключается по ситуации и быстро находит работающие решения сложных задач; предпочитает действие разговорам." },
  ],
]

export const ROLES: Role[] = ROLE_GRID.flat()

export const ROLES_TEXT =
  "Командный профиль показывает, каким способом участник предпочитает выполнять работу в текущий период."

export const ROLE_AXES = {
  top: ["Фокус на процесс", "Фокус на результат"],
  left: ["Неструктурированный подход", "Структурированный подход"],
  right: ["Концептуальные решения", "Локальные решения"],
}

// ---------- Матрица потенциала ----------

/** Зоны 3×3: строки — потенциал сверху вниз (высокий → низкий), столбцы — менеджерские навыки слева направо. */
export const POTENTIAL_ZONES: string[][] = [
  ["HiPro", "Готовность к переходу в 6–12 мес.", "Готовность к переходу"],
  ["HiPro", "Готовность к переходу в 12–18 мес.", "Готовность к переходу в 6–12 мес."],
  ["Зона контроля", "Необходимость активного развития", "Готовность к переходу в 18–24 мес."],
]

export const POTENTIAL_TEXT = {
  intro:
    "Матрица сопоставляет потенциал к развитию и менеджерские компетенции, которые определяют рабочее поведение участников.",
  axes: [
    "Потенциал к развитию — способность менять мышление и внутренние ресурсы, чтобы адаптироваться к изменениям и усложнению работы, сохраняя продуктивность и хорошие отношения с окружением.",
    "Менеджерские компетенции — сочетание качеств руководителя, которые позволяют эффективно управлять командой, ресурсами и процессами.",
  ],
  strong:
    "Зелёная зона — высокий потенциал и развитые менеджерские компетенции. Здесь находятся кадровый резерв и потенциальные преемники на управленческие роли.",
  weak:
    "Красная зона — низкий потенциал и неразвитые менеджерские компетенции. Таким сотрудникам нужно уделить дополнительное внимание.",
}

// ---------- Шкалы 0–10 ----------

export interface Scale {
  key: string
  code?: string
  name: string
}

export interface ScaleGroup {
  title: string
  scales: Scale[]
}

export interface ScaleSection {
  key: "traits" | "stress" | "burnout" | "values"
  title: string
  description: string
  /** Цвет тепловой карты */
  heat: string
  groups: ScaleGroup[]
}

export const SCALE_SECTIONS: ScaleSection[] = [
  {
    key: "traits",
    title: "Черты характера",
    description:
      "Базовые черты личности, которые определяют стиль работы и отношения с окружением. Их можно осознанно усиливать или сдерживать.",
    heat: "oklch(0.6 0.13 255)",
    groups: [
      {
        title: "Эмоциональная устойчивость",
        scales: [
          { key: "C", code: "C", name: "Эмоциональная стабильность" },
          { key: "O", code: "O", name: "Тревожность" },
          { key: "Q4", code: "Q4", name: "Внутреннее напряжение" },
        ],
      },
      {
        title: "Командная устойчивость",
        scales: [
          { key: "F", code: "F", name: "Импульсивность" },
          { key: "N", code: "N", name: "Дипломатичность" },
          { key: "I", code: "I", name: "Восприятие" },
          { key: "A", code: "A", name: "Открытость" },
        ],
      },
      {
        title: "Устойчивость результата",
        scales: [
          { key: "M", code: "M", name: "Концептуальность" },
          { key: "Q2", code: "Q2", name: "Автономность" },
          { key: "G", code: "G", name: "Ответственность" },
          { key: "Q3", code: "Q3", name: "Самоконтроль" },
        ],
      },
      {
        title: "Устойчивость в изменениях",
        scales: [
          { key: "Q1", code: "Q1", name: "Критичность" },
          { key: "L", code: "L", name: "Осторожность" },
          { key: "H", code: "H", name: "Смелость" },
          { key: "E", code: "E", name: "Лидерство" },
        ],
      },
    ],
  },
  {
    key: "stress",
    title: "Поведение в стрессе",
    description:
      "Самые типичные реакции и стратегии поведения в стрессе и неопределённости. Их можно менять, сознательно выбирая другие действия и повышая личную эффективность.",
    heat: "oklch(0.68 0.14 140)",
    groups: [
      {
        title: "Активное преодоление сложностей («бей»)",
        scales: [
          { key: "self-control", name: "Самообладание и самоутверждение" },
          { key: "situation-control", name: "Контроль над ситуацией" },
          { key: "positive-motivation", name: "Позитивная мотивация и снижение стресса" },
        ],
      },
      {
        title: "Уход от решения («беги»)",
        scales: [
          { key: "escape", name: "Замещение, отвлечение, бегство от стресса" },
          { key: "anticipatory-avoidance", name: "Антиципирующее избегание" },
          { key: "social-support", name: "Поиск социальной поддержки" },
        ],
      },
      {
        title: "Усиление переживаний («замри»)",
        scales: [
          { key: "self-blame", name: "Самообвинение и жалость к себе" },
          { key: "withdrawal", name: "Социальная замкнутость" },
          { key: "rumination", name: "Заезженная пластинка" },
          { key: "self-justification", name: "Самооправдание" },
          { key: "aggression", name: "Агрессия" },
        ],
      },
    ],
  },
  {
    key: "burnout",
    title: "Выгорание",
    description:
      "Механизмы выгорания: какие факторы формируют каждую его фазу и на каком этапе участники находятся сейчас.",
    heat: "oklch(0.64 0.17 20)",
    groups: [
      {
        title: "Фаза 1. Напряжение",
        scales: [
          { key: "workload-fatigue", name: "Усталость от нагрузки, скорости и принципов работы" },
          { key: "career-deadlock", name: "Профессиональный тупик" },
        ],
      },
      {
        title: "Фаза 2. Сопротивление",
        scales: [
          { key: "communication-fatigue", name: "Усталость от коммуникаций" },
          { key: "communication-avoidance", name: "Уход от коммуникаций" },
        ],
      },
      {
        title: "Фаза 3. Истощение",
        scales: [
          { key: "attention-loss", name: "Сокращение внимания" },
          { key: "psychosomatics", name: "Психосоматика" },
        ],
      },
    ],
  },
  {
    key: "values",
    title: "Ценности",
    description:
      "Жизненные ценности и мотивы, которые определяют выбор и предпочтения человека и его жизненную стратегию.",
    heat: "oklch(0.8 0.14 90)",
    groups: [
      {
        title: "Ценности гармонии и согласованности",
        scales: [
          { key: "belonging", name: "Причастность" },
          { key: "tradition", name: "Традиционализм" },
          { key: "impressions", name: "Жажда впечатлений" },
          { key: "aesthetics", name: "Эстетичность" },
          { key: "hedonism", name: "Гедонизм" },
        ],
      },
      {
        title: "Ценности преодоления и доминирования",
        scales: [
          { key: "recognition", name: "Признание" },
          { key: "achievement", name: "Достижения" },
          { key: "commercial", name: "Коммерческий подход" },
          { key: "security", name: "Безопасность" },
          { key: "intellect", name: "Интеллект (познавание)" },
        ],
      },
    ],
  },
]

export const HEATMAP_TEXT = [
  "Тепловая карта показывает усреднённый профиль групп и позволяет сравнить их между собой по выбранным шкалам.",
  "В ячейках — средние значения группы от 0 до 10. Чем выше значение, тем сильнее характеристика выражена в группе.",
  "Карта помогает увидеть, какие параметры выражены сильнее или слабее, где различия между группами существенны, а где минимальны, и целиком оценить сходства и различия профилей.",
]

// ---------- Стили обучения ----------

export type LearningStyle = "observer" | "theorist" | "practitioner" | "researcher"

/** 2×2: [верх-лево, верх-право], [низ-лево, низ-право] */
export const LEARNING_GRID: { key: LearningStyle; name: string; motto: string }[][] = [
  [
    { key: "observer", name: "Наблюдатель", motto: "Наблюдение и чувства" },
    { key: "theorist", name: "Теоретик", motto: "Наблюдение и мышление" },
  ],
  [
    { key: "practitioner", name: "Практик", motto: "Действие и чувства" },
    { key: "researcher", name: "Исследователь", motto: "Действие и мышление" },
  ],
]

export const LEARNING_AXES = {
  top: "Общение и концептуализация",
  bottom: "Конкретный опыт",
  left: "Активное экспериментирование",
  right: "Тестирование и размышление",
}

/** Разделы, которые можно включать/выключать в содержании командного отчёта. */
export const REPORT_CONTENT_SECTIONS = [
  { id: "participants", title: "Состав участников" },
  { id: "groups", title: "Группы участников" },
  { id: "integral-all", title: "Интегральный отчёт: все участники" },
  { id: "integral-team", title: "Интегральный отчёт: команда" },
  { id: "traffic", title: "Разметка компетенций" },
  { id: "roles", title: "Распределение ролей" },
  { id: "role-descriptions", title: "Расшифровка профилей" },
  { id: "potential", title: "Матрица потенциала" },
  ...SCALE_SECTIONS.map((s) => ({ id: s.key, title: s.title })),
  ...SCALE_SECTIONS.map((s) => ({
    id: `heat-${s.key}`,
    title: `Тепловая карта: ${s.title.toLowerCase()}`,
  })),
  { id: "learning", title: "Стили обучения" },
] as const

export type ReportContentSectionId = (typeof REPORT_CONTENT_SECTIONS)[number]["id"]

const REPORT_CONTENT_SECTION_IDS = new Set<string>(
  REPORT_CONTENT_SECTIONS.map((s) => s.id),
)

export function allReportContentSectionIds(): ReportContentSectionId[] {
  return REPORT_CONTENT_SECTIONS.map((s) => s.id)
}

/**
 * Оставляет только известные id разделов в порядке REPORT_CONTENT_SECTIONS.
 * null/undefined → все разделы (значение по умолчанию).
 */
export function normalizeReportContentSections(
  ids: readonly string[] | undefined | null,
): ReportContentSectionId[] {
  if (ids == null) return allReportContentSectionIds()
  const selected = new Set(
    ids.filter((id): id is ReportContentSectionId => REPORT_CONTENT_SECTION_IDS.has(id)),
  )
  return REPORT_CONTENT_SECTIONS.map((s) => s.id).filter((id) => selected.has(id))
}
