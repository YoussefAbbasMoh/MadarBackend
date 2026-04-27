/**
 * Rich sample curricula for LMS seeding (~10 courses).
 * Media URLs are public samples (PDF / MP4 / images) — swap for Cloudinary in production.
 */

const { normalizePhoneE164 } = require('../src/utils/phone');

const PDF_SAMPLE = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const VIDEO_SAMPLE = 'https://www.w3schools.com/html/mov_bbb.mp4';
const IMG_SAMPLE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80';

function subVideo(title, description, minutes = 12) {
  return {
    title,
    description,
    type: 'video',
    fileUrl: VIDEO_SAMPLE,
    estimatedMinutes: minutes,
    published: true,
  };
}

function subPdf(title, description) {
  return {
    title,
    description,
    type: 'pdf',
    fileUrl: PDF_SAMPLE,
    estimatedMinutes: 15,
    published: true,
  };
}

function subImage(title, description) {
  return {
    title,
    description,
    type: 'image',
    fileUrl: IMG_SAMPLE,
    estimatedMinutes: 5,
    published: true,
  };
}

/** @type {{ text: string, options: string[], correctIndex: number, explanation?: string }[]} */
const q = (items) => items;

const SEED_INSTRUCTOR_EMAIL = 'seed.instructor@lms.local';
const SEED_SUPER_ADMIN_EMAIL = 'seed.superadmin@lms.local';
const SEED_STUDENT_EMAIL = 'seed.student@lms.local';
/**
 * Canonical seed student phone (E.164). The API normalizes common variants (e.g. 01000099911, 1000099911)
 * to this value for OTP lookup.
 */
const SEED_STUDENT_PHONE = '+201000099911';

/** Stable keys used to replace previous seed runs */
const SAMPLE_COURSE_KEYS = [
  'intro-python-data',
  'modern-web-react',
  'business-finance-101',
  'arabic-academic-writing',
  'clinical-pathophysiology',
  'ux-research-methods',
  'civil-structural-basics',
  'digital-marketing-growth',
  'intro-statistics-r',
  'film-studies-genre',
];

const courses = [
  {
    key: 'intro-python-data',
    title: 'Introduction to Python for Data Science',
    category: 'STEM · Programming',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80',
    price: 449,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Learn Python from zero to small data projects. This sample course mirrors a full university-style module: weekly readings, short lectures, Jupyter-style exercises (described in text), and graded quizzes.

By the end you will understand variables, control flow, functions, file I/O, and introductory use of NumPy-style thinking for vectors and tables (conceptual — swap in real notebooks when you wire your environment).

**Audience:** First-year CS, business analytics minors, or self-taught developers needing structure.`,
    lessons: [
      {
        title: 'Week 1 — Setup & mindset',
        description: 'Install tools, run your first script, learn how this LMS organizes lessons.',
        published: true,
        subLessons: [
          subVideo('Welcome & how to use this course', 'Navigation, deadlines, and asking questions in chat.', 8),
          subPdf('Syllabus & grading rubric', 'Weights for quizzes, participation, and the capstone script.'),
          subImage('IDE layout cheat sheet', 'A visual map of panels you will use in most weeks.'),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          timerMinutes: 15,
          questions: q([
            {
              text: 'What is the usual extension for a Python source file?',
              options: ['.js', '.py', '.java', '.rb'],
              correctIndex: 1,
              explanation: 'Python files use the .py extension.',
            },
            {
              text: 'Which keyword defines a function in Python?',
              options: ['function', 'def', 'fn', 'lambda only'],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Week 2 — Variables & types',
        description: 'Numbers, strings, booleans, and basic input/output.',
        published: true,
        subLessons: [
          subVideo('Types in Python', 'Dynamic typing vs strong typing — intuition for beginners.', 14),
          subPdf('Reading: variables & memory (conceptual)', 'High-level notes without C-level pointers.'),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Which of these is a valid Python string literal?',
              options: ["'hello'", 'hello', '@hello', '`hello`'],
              correctIndex: 0,
            },
          ]),
        },
      },
      {
        title: 'Week 3 — Control flow',
        description: 'Conditionals, loops, and common patterns.',
        published: true,
        subLessons: [
          subVideo('if / elif / else', 'Decision trees and guarding edge cases.', 16),
          subVideo('for and while loops', 'When to prefer each; avoiding infinite loops.', 18),
        ],
      },
      {
        title: 'Capstone week',
        description: 'Submit a short script that reads a CSV description (mock) and prints summary stats.',
        published: true,
        subLessons: [
          subPdf('Capstone brief', 'Requirements, sample output, and academic integrity reminder.'),
          subVideo('Walkthrough: structuring a small project', 'Files, functions, and testing mentally with asserts.', 20),
        ],
        quiz: {
          type: 'homework',
          published: true,
          fileUploadEnabled: true,
          questions: q([
            {
              text: 'Confirm you have read the integrity policy before uploading your work.',
              options: ['No', 'Yes'],
              correctIndex: 1,
            },
          ]),
        },
      },
    ],
  },
  {
    key: 'modern-web-react',
    title: 'Modern Web Apps with React & TypeScript',
    category: 'Technology · Web',
    coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=80',
    price: 599,
    currency: 'EGP',
    certificateEnabled: true,
    description: `A project-based tour of client-side engineering: components, hooks, routing, data fetching patterns, and accessibility basics. Labs reference Vite and a component library mindset similar to shadcn/ui.

You will ship a small dashboard UI (static data) and extend it with loading and error states.`,
    lessons: [
      {
        title: 'Module A — Components & JSX',
        published: true,
        subLessons: [
          subVideo('Why component trees scale', 'Composition over inheritance in UI.', 11),
          subPdf('JSX vs template engines', 'Short reading with examples.'),
        ],
      },
      {
        title: 'Module B — State & hooks',
        published: true,
        subLessons: [
          subVideo('useState and derived state', 'Avoid redundant state; patterns for forms.', 15),
          subVideo('useEffect for data (carefully)', 'Dependencies, cleanup, stale closures.', 17),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Which hook stores mutable component-local state?',
              options: ['useRef', 'useState', 'useMemo', 'useId'],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Module C — Routing & URLs',
        published: true,
        subLessons: [subVideo('Declarative routes', 'Nested routes and URL as source of truth.', 14)],
      },
      {
        title: 'Module D — Ship checklist',
        published: true,
        subLessons: [
          subPdf('Accessibility checklist', 'Keyboard, labels, focus order.'),
          subImage('Example responsive layout', 'Breakpoints reference.'),
        ],
      },
    ],
  },
  {
    key: 'business-finance-101',
    title: 'Business Finance for Non-Finance Majors',
    category: 'Business',
    coverImage: 'https://images.unsplash.com/photo-1554224311-beee4ece3038?w=1200&q=80',
    price: 349,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Time value of money, financial statements, budgeting, and capital decisions — taught with caselets and numeric intuition before formulas. Includes spreadsheet literacy notes (conceptual).

Suitable for entrepreneurship tracks and engineers moving into product leadership.`,
    lessons: [
      {
        title: 'Unit 1 — Financial statements',
        published: true,
        subLessons: [
          subVideo('Balance sheet vs income statement', 'What each question answers.', 12),
          subPdf('Caselet: Café Nova opening year', 'Read before discussion thread.'),
        ],
      },
      {
        title: 'Unit 2 — Time value of money',
        published: true,
        subLessons: [
          subVideo('Present value intuition', 'Discounting future cash flows.', 16),
          subImage('Timeline diagrams', 'Visualizing inflows/outflows.'),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Receiving money sooner rather than later is generally:',
              options: ['Less valuable', 'More valuable', 'Same value always', 'Illegal'],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Unit 3 — Budgeting & variance',
        published: true,
        subLessons: [subPdf('Operating budget template (annotated)', 'Line items explained.')],
      },
    ],
  },
  {
    key: 'arabic-academic-writing',
    title: 'Arabic Academic Writing & Argumentation',
    category: 'Languages · Arabic',
    coverImage: 'https://images.unsplash.com/photo-1546412412-48de701df5b6?w=1200&q=80',
    price: 279,
    currency: 'EGP',
    certificateEnabled: false,
    description: `Build clear thesis-driven essays in Modern Standard Arabic: cohesion devices, paragraph architecture, citation habits, and revision strategies. Includes bilingual glossaries for academic terms.

**Note:** Sample content is bilingual (AR/EN instructions) to match a bilingual language[] flag.`,
    lessons: [
      {
        title: 'أساسيات الفقرة',
        published: true,
        subLessons: [
          subVideo('Topic sentence → support → wrap', 'Model paragraph walkthrough.', 10),
          subPdf('Transitions bank (MSA)', 'Printable reference sheet.'),
        ],
      },
      {
        title: 'Building an argument',
        published: true,
        subLessons: [
          subVideo('Claims, reasons, warrants', 'Toulmin-style overview in Arabic.', 14),
          subImage('Annotated student paragraph', 'Good vs weak cohesion marked.'),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Which element states the main claim of a paragraph?',
              options: ['Evidence only', 'Topic sentence / claim', 'Footnote', 'Margin doodle'],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Draft workshop',
        published: true,
        subLessons: [subPdf('Peer review worksheet', 'Rubric-aligned checklist.')],
      },
    ],
  },
  {
    key: 'clinical-pathophysiology',
    title: 'Clinical Pathophysiology — Systems Integration',
    category: 'Health & Medicine',
    coverImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=1200&q=80',
    price: 799,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Integrative pathophysiology for advanced undergraduates: oxygen delivery, heart failure cascades, renal regulation, and shock states. Emphasizes mechanisms linking cellular change to bedside findings.

**Disclaimer:** Educational sample only — not medical advice.`,
    lessons: [
      {
        title: 'Block 1 — Oxygen transport',
        published: true,
        subLessons: [
          subVideo('Hb-O2 curve & shifts', 'Clinical correlates.', 13),
          subPdf('Reading: anemia classifications', 'Overview tables.'),
        ],
      },
      {
        title: 'Block 2 — Heart failure',
        published: true,
        subLessons: [
          subVideo('Forward vs backward failure', 'Pressure-volume thinking.', 15),
          subImage('Pressure-volume loop schematic', 'Labelled diagram.'),
        ],
        quiz: {
          type: 'exam',
          published: true,
          timerMinutes: 20,
          maxAttempts: 1,
          questions: q([
            {
              text: 'Which finding is most associated with left-sided heart failure?',
              options: ['Ascites dominant', 'Pulmonary edema pattern', 'Jaundice', 'Goiter'],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Block 3 — Shock overview',
        published: true,
        subLessons: [subPdf('Shock types comparison table', 'Distributive, cardiogenic, obstructive, hypovolemic.')],
      },
    ],
  },
  {
    key: 'ux-research-methods',
    title: 'UX Research Methods for Product Teams',
    category: 'Arts & Design · UX',
    coverImage: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=1200&q=80',
    price: 429,
    currency: 'EGP',
    certificateEnabled: true,
    description: `From discovery interviews to usability tests and survey design — ethical, inclusive, and actionable. Includes study plans, consent language placeholders, and synthesis methods (affinity mapping described).`,
    lessons: [
      {
        title: 'Discovery interviews',
        published: true,
        subLessons: [
          subVideo('Non-leading questions', 'Live examples and fixes.', 12),
          subPdf('Interview guide template', 'Editable structure.'),
        ],
      },
      {
        title: 'Usability testing',
        published: true,
        subLessons: [
          subVideo('Think-aloud protocol', 'Moderator script basics.', 14),
          subImage('Severity rating scale', 'Example 0–4 rubric.'),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Which sample size is common for qualitative usability rounds (rule of thumb)?',
              options: ['3–5 users per round', '500 users', '1 user only', '0 users'],
              correctIndex: 0,
            },
          ]),
        },
      },
      {
        title: 'Reporting insights',
        published: true,
        subLessons: [subPdf('One-page findings format', 'Executive summary + evidence links.')],
      },
    ],
  },
  {
    key: 'civil-structural-basics',
    title: 'Civil Engineering — Structural Loads & Statics Refresher',
    category: 'Engineering',
    coverImage: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&q=80',
    price: 519,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Free-body diagrams, support reactions, distributed loads, and intro to beam bending intuition. Problem sets described with reference figures; swap in your own PDF problem packs later.`,
    lessons: [
      {
        title: 'Statics refresher',
        published: true,
        subLessons: [
          subVideo('Equilibrium equations in 2D', 'ΣF, ΣM.', 11),
          subPdf('Worked examples set A', 'Classic textbook-style walkthroughs.'),
        ],
      },
      {
        title: 'Trusses & method of joints',
        published: true,
        subLessons: [subVideo('Zero-force members', 'Pattern recognition.', 13)],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'For a concurrent force system in equilibrium in 2D, how many independent scalar equations are commonly used?',
              options: ['1', '2', '3', '6'],
              correctIndex: 2,
            },
          ]),
        },
      },
      {
        title: 'Intro to bending moment diagrams',
        published: true,
        subLessons: [subImage('Sign conventions poster', 'Positive sagging convention.')],
      },
    ],
  },
  {
    key: 'digital-marketing-growth',
    title: 'Digital Marketing & Growth Experiments',
    category: 'Business · Marketing',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    price: 389,
    currency: 'EGP',
    certificateEnabled: false,
    description: `Funnels, attribution basics, A/B tests, and content strategy for student-run ventures. Ethical data collection and privacy notes included.`,
    lessons: [
      {
        title: 'Funnels & metrics',
        published: true,
        subLessons: [
          subVideo('North Star vs vanity metrics', 'Pick metrics tied to learning outcomes for ed-products.', 10),
          subPdf('GA4 concepts primer', 'Events, conversions — overview.'),
        ],
      },
      {
        title: 'Experiments',
        published: true,
        subLessons: [
          subVideo('Designing an A/B test', 'Power — conceptual; not a stats course.', 12),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Changing multiple variables at once in a funnel test usually:',
              options: ['Makes attribution easier', 'Makes attribution harder', 'Is always illegal', 'Removes the need for users'],
              correctIndex: 1,
            },
          ]),
        },
      },
    ],
  },
  {
    key: 'intro-statistics-r',
    title: 'Introduction to Statistics with R (conceptual + practice)',
    category: 'STEM · Statistics',
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
    price: 359,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Distributions, estimation, hypothesis testing intuition, and simple linear models — with readings that mirror R outputs (you can attach real .Rmd later). Academic integrity note for shared datasets.`,
    lessons: [
      {
        title: 'Data & distributions',
        published: true,
        subLessons: [
          subVideo('Histograms & density', 'What smooth curves mean.', 9),
          subPdf('Normal model reading', '68–95–99.7 rule explained.'),
        ],
      },
      {
        title: 'Inference building blocks',
        published: true,
        subLessons: [
          subVideo('p-values without mysticism', 'What they do and do not say.', 14),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'A 95% confidence interval for a mean is constructed to:',
              options: [
                'Capture the sample mean with 95% probability only',
                'Give a plausible range for the population parameter under the model',
                'Prove the alternative hypothesis',
                'Replace the need for data',
              ],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Simple linear regression',
        published: true,
        subLessons: [subImage('Residual plot interpretation', 'Fan shapes and outliers.')],
      },
    ],
  },
  {
    key: 'film-studies-genre',
    title: 'Film Studies — Genre, Authorship, and Audience',
    category: 'Humanities',
    coverImage: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80',
    price: 299,
    currency: 'EGP',
    certificateEnabled: true,
    description: `Close reading of mise-en-scène, genre contracts, and audience reception. Weekly viewing prompts reference publicly available trailers and stills; replace with licensed films for campus screening.`,
    lessons: [
      {
        title: 'Genre theory',
        published: true,
        subLessons: [
          subVideo('What is a genre contract?', 'Expectations and subversion.', 11),
          subPdf('Reading: Rick Altman excerpt (summary)', 'Synthetic paraphrase for teaching.'),
        ],
      },
      {
        title: 'Authorship debates',
        published: true,
        subLessons: [
          subVideo('Auteur vs industrial authorship', 'Case study outline.', 12),
        ],
        quiz: {
          type: 'quiz',
          published: true,
          questions: q([
            {
              text: 'Genre hybridity refers to:',
              options: [
                'Only one genre existing',
                'Mixing conventions from multiple genres',
                'Deleting audiences',
                'Removing sound from film',
              ],
              correctIndex: 1,
            },
          ]),
        },
      },
      {
        title: 'Final essay prep',
        published: true,
        subLessons: [subPdf('Argument outline template', 'Thesis, motives, evidence slots.')],
      },
    ],
  },
];

/** Ten deterministic test learners (+20155000002 … +20155000010) plus the legacy canonical phone as student 01. */
function buildSeedStudentDefs() {
  const defs = [
    {
      email: SEED_STUDENT_EMAIL,
      phone: normalizePhoneE164(SEED_STUDENT_PHONE),
      name: 'Sample Student 01 (Seed)',
    },
  ];
  for (let i = 2; i <= 10; i += 1) {
    const pad = String(i).padStart(2, '0');
    defs.push({
      email: `seed.student${pad}@lms.local`,
      phone: normalizePhoneE164(`+201550000${pad}`),
      name: `Sample Student ${pad} (Seed)`,
    });
  }
  return defs;
}

/**
 * Reference roster for the seed instructor: each student is paired with one sample course by index
 * (matches `seedFullSampleCurriculum` split enrollment).
 */
function buildSeedTestStudentRoster() {
  const defs = buildSeedStudentDefs();
  return defs.map((d, i) => {
    const c = courses[i];
    return {
      name: d.name,
      email: d.email,
      phone: d.phone,
      courseKey: c ? c.key : null,
      courseTitle: c ? c.title : null,
    };
  });
}

module.exports = {
  SEED_INSTRUCTOR_EMAIL,
  SEED_SUPER_ADMIN_EMAIL,
  SEED_STUDENT_EMAIL,
  SEED_STUDENT_PHONE,
  SAMPLE_COURSE_KEYS,
  courses,
  buildSeedStudentDefs,
  buildSeedTestStudentRoster,
};
