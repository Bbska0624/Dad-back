// Mock "өгөгдлийн сан". Backend бэлэн болоход энэ хавтас хэрэггүй болно.
// Өгөгдлийн хэлбэр docs/API.md-тэй яг таарах ёстой.
import { ApiError } from '../client';
import { courseImages, newsImages } from '../../assets/siteImages';

export const courses = [
  {
    id: 'vip-course', category: 'AI', status: 'waitlist', price: null, image: courseImages['vip-course'],
    title: { mn: 'VIP цогц сургалт', en: 'VIP Course' },
    description: { mn: 'Суурь ойлголтоос AI төсөл хүртэлх цогц хөтөлбөр.', en: 'A complete path from fundamentals to an AI project.' },
  },
  {
    id: 'data-analysis', category: 'Data', status: 'open', price: null, image: courseImages['data-analysis'],
    title: { mn: 'Өгөгдлийн шинжилгээ ба Power BI', en: 'Data Analysis & Power BI' },
    description: { mn: 'SQL, Python болон Power BI ашиглан өгөгдөл шинжилж, тайлан бүтээх.', en: 'Analyse data and build reports with SQL, Python and Power BI.' },
  },
  {
    id: 'computer-skills', category: 'Digital', status: 'waitlist', price: null, image: courseImages['computer-skills'],
    title: { mn: 'Компьютерын хэрэглээ', en: 'Computer Skills' },
    description: { mn: 'Компьютерын үндсэн хэрэглээ, файл болон өдөр тутмын дижитал хэрэгслүүд.', en: 'Computer basics, files and everyday digital tools.' },
  },
  {
    id: 'python-programming', category: 'Code', status: 'planned', price: null, image: courseImages['python-programming'],
    title: { mn: 'Python программчлал', en: 'Python Programming' },
    description: { mn: 'Python хэлний суурь, өгөгдлийн бүтэц, автоматжуулалт.', en: 'Python fundamentals, data structures and automation.' },
  },
  {
    id: 'web-development', category: 'Code', status: 'planned', price: null, image: courseImages['web-development'],
    title: { mn: 'Вэб хөгжүүлэлт', en: 'Web Development' },
    description: { mn: 'HTML, CSS, JavaScript ашиглан вэбсайт бүтээх суурь.', en: 'Build websites with HTML, CSS and JavaScript.' },
  },
  {
    id: 'sql-databases', category: 'Data', status: 'planned', price: null, image: courseImages['sql-databases'],
    title: { mn: 'SQL ба өгөгдлийн сан', en: 'SQL & Databases' },
    description: { mn: 'Өгөгдлийн сангийн зохион байгуулалт, хайлт болон шинжилгээ.', en: 'Database design, queries and analysis.' },
  },
  {
    id: 'ai-rag-systems', category: 'AI', status: 'planned', price: null, image: courseImages['ai-rag-systems'],
    title: { mn: 'AI ба RAG систем', en: 'AI & RAG Systems' },
    description: { mn: 'Эх сурвалжид тулгуурласан AI туслах бүтээх ойлголтууд.', en: 'Explore grounded AI assistants and retrieval.' },
  },
  {
    id: 'machine-learning', category: 'AI', status: 'planned', price: null, image: courseImages['machine-learning'],
    title: { mn: 'Машин сургалт', en: 'Machine Learning' },
    description: { mn: 'Өгөгдөл бэлтгэх, загвар сургах, үр дүнг үнэлэх суурь.', en: 'Prepare data, train models and evaluate results.' },
  },
  {
    id: 'cybersecurity', category: 'Digital', status: 'planned', price: null, image: courseImages['cybersecurity'],
    title: { mn: 'Кибер аюулгүй байдал', en: 'Cybersecurity' },
    description: { mn: 'Дижитал мэдээлэл, бүртгэл болон системээ хамгаалах суурь.', en: 'Foundations for protecting accounts, information and systems.' },
  },
];

const sample = (number, category, title, summary) => ({
  id: String(Number(number)),
  number,
  category,
  title,
  summary,
  publishedAt: null,
  details: { date: null, location: null, partners: null },
  body: null,
  isSample: true,
  coverImage: newsImages[number],
});

export const news = [
  {
    id: '1', number: '01', isSample: false, publishedAt: null,
    category: { mn: 'Байгаль орчин · Хамтын ажиллагаа', en: 'Environment · Collaboration' },
    title: { mn: 'Хушхан брэндтэй хамтран “Хусхан төгөл”-д мод тарилаа', en: 'Tree planting at Hushkhan Tugul with HUSHKHAN' },
    summary: { mn: '“Хусхан төгөл”-д Хушхан брэндтэй хамтран мод тарих ажилд оролцлоо.', en: 'We joined HUSHKHAN for a tree-planting initiative at Hushkhan Tugul.' },
    body: {
      mn: 'Бид Хушхан брэндтэй хамтран “Хусхан төгөл”-д мод тарилаа. Мод тарихаар бэлтгэсэн суулгацууд, талбай руу явж буй оролцогчид болон тарьсан суулгацын зургуудыг хүргэж байна.',
      en: 'We planted trees at Hushkhan Tugul in collaboration with HUSHKHAN. These photographs show the saplings prepared for planting, participants heading to the site and a newly planted sapling.',
    },
    details: { date: null, location: { mn: 'Хусхан төгөл', en: 'Hushkhan Tugul' }, partners: { mn: 'Хушхан брэнд', en: 'HUSHKHAN' } },
    coverImage: {
      src: '/assets/news/khush-tugul/saplings.jpg', width: 4032, height: 3024,
      alt: { mn: 'Мод тарихаар бэлтгэсэн хоёр суулгац', en: 'Two saplings prepared for planting' },
      caption: { mn: 'Мод тарихаар бэлтгэсэн суулгацууд.', en: 'Saplings prepared for planting.' },
    },
    gallery: [
      {
        src: '/assets/news/khush-tugul/planting-team.jpg', width: 3072, height: 4096,
        alt: { mn: 'Хусхан төгөлд мод тарих талбай руу явж буй оролцогчид', en: 'Participants heading to the planting site at Hushkhan Tugul' },
        caption: { mn: 'Мод тарих талбай руу явж буй оролцогчид.', en: 'Participants on their way to the planting site.' },
      },
      {
        src: '/assets/news/khush-tugul/planted-sapling.jpg', width: 1536, height: 2048,
        alt: { mn: 'Хусхан төгөлд хөрсөнд тарьсан суулгац', en: 'A newly planted sapling at Hushkhan Tugul' },
        caption: { mn: 'Хусхан төгөлд тарьсан суулгац.', en: 'A sapling planted at Hushkhan Tugul.' },
      },
    ],
  },
  {
    id: '2', number: '02', isSample: false, publishedAt: '2025-10-24T00:00:00.000Z',
    category: { mn: 'Нийгмийн хариуцлага · Эмэгтэйчүүдийн бизнес', en: 'Social responsibility · Women in business' },
    title: { mn: 'Эмэгтэйчүүдийн бизнесийг дэмжих нь – ирээдүйд хийж буй хөрөнгө оруулалт', en: 'Supporting women’s businesses is an investment in the future' },
    summary: {
      mn: 'МЗБЭЭХ-ны бизнес эрхлэгч 7 эмэгтэйд тус бүр 1,000,000₮, нийт 7,000,000₮-ийн үнэ бүхий вэб сайт хийлгэх эрхийн бичиг гардууллаа.',
      en: 'We presented seven women entrepreneurs from the Mongolian Young Businesswomen’s Association with website vouchers worth ₮1,000,000 each, ₮7,000,000 in total.',
    },
    body: {
      mn: ' ЭМЭГТЭЙЧҮҮДИЙН БИЗНЕСИЙГ ДЭМЖИХ НЬ – ИРЭЭДҮЙД ХИЙЖ БУЙ ХӨРӨНГӨ ОРУУЛАЛТ \n\nMagic Code AI компанийн зүгээс нийгмийн хариуцлагынхаа хүрээнд МЗБЭЭХ-ныхоо бизнес эрхлэгч 7 эмэгтэйг дэмжин, тус бүр 1,000,000₮, нийт 7,000,000₮-ийн үнэ бүхий вэб сайт хийлгэх эрхийн бичиг гардууллаа\n\nБид эмэгтэйчүүдийн бизнесийг дижитал орчинд хөгжүүлэх, үйл ажиллагааг нь өргөжүүлэх, шинэ боломжуудыг нээхэд хувь нэмрээ оруулж байгаадаа баяртай байна.\n\n Сайн үйлс бүхэн дэлгэрэх болтугай! \n\n Magic Code AI\nMindful Technology – Ухаалаг технологи, ухамсарт хөгжил.',
      en: ' SUPPORTING WOMEN’S BUSINESSES IS AN INVESTMENT IN THE FUTURE \n\nAs part of its social responsibility, Magic Code AI supported seven women entrepreneurs from the Mongolian Young Businesswomen’s Association, presenting each with a website voucher worth ₮1,000,000, ₮7,000,000 in total \n\nWe are glad to help women grow their businesses online, expand their operations and open up new opportunities.\n\n May every good deed spread! \n\n✨ Magic Code AI\nMindful Technology – smart technology, mindful growth.'
    },
    details: {
      date: { mn: '2026.10.24', en: '24 October 2026' },
      location: null,
      partners: { mn: 'Монголын залуу бизнес эрхлэгч эмэгтэйчүүдийн холбоо (МЗБЭЭХ)', en: 'Mongolian Young Businesswomen’s Association' },
    },
    coverImage: {
      src: '/assets/news/women-business/certificates.jpg', srcSet: '/assets/news/women-business/certificates-small.jpg 768w, /assets/news/women-business/certificates.jpg 1600w',
      width: 1600, height: 900, position: 'center 30%',
      alt: { mn: '1,000,000₮-ийн эрхийн бичиг барьсан бизнес эрхлэгч эмэгтэйчүүд', en: 'Women entrepreneurs holding ₮1,000,000 website vouchers' },
      caption: { mn: 'Вэб сайт хийлгэх эрхийн бичгийг гардууллаа.', en: 'Presenting the website vouchers.' },
    },
    gallery: [
      {
        src: '/assets/news/women-business/group-photo.jpg', srcSet: '/assets/news/women-business/group-photo-small.jpg 768w, /assets/news/women-business/group-photo.jpg 1600w', width: 1600, height: 900,
        alt: { mn: 'МЗБЭЭХ-ны “Good Morning” арга хэмжээний оролцогчдын хамтын зураг', en: 'Group photo of participants at the association’s Good Morning event' },
        caption: { mn: 'МЗБЭЭХ-ны “Good Morning” арга хэмжээний оролцогчид.', en: 'Participants at the association’s Good Morning event.' },
      },
      {
        src: '/assets/news/women-business/event-screen.jpg', srcSet: '/assets/news/women-business/event-screen-small.jpg 768w, /assets/news/women-business/event-screen.jpg 1600w', width: 1600, height: 922,
        alt: { mn: 'МЗБЭЭХ-ны “Good Morning” арга хэмжээний дэлгэц', en: 'Screen for the association’s Good Morning women’s event' },
        caption: { mn: '“Good Morning” эмэгтэйчүүдийн арга хэмжээ.', en: 'The Good Morning women’s event.' },
      },
      ...['award-1', 'award-2', 'award-3'].map((name) => ({
        src: `/assets/news/women-business/${name}.jpg`, srcSet: `/assets/news/women-business/${name}-small.jpg 640w, /assets/news/women-business/${name}.jpg 900w`, width: 900, height: 1600,
        alt: { mn: 'Тайзан дээр эрхийн бичиг гардуулж буй агшин', en: 'A voucher being presented on stage' },
        caption: { mn: 'Эрхийн бичиг гардуулах агшин.', en: 'Presenting a voucher on stage.' },
      })),
    ],
  },
  {
    id: '3', number: '03', isSample: false, publishedAt: '2026-05-22T00:00:00.000Z',
    category: { mn: 'Эрдэм шинжилгээ · Хурал', en: 'Research · Conference' },
    title: {
      mn: '“Монголын Мэдээллийн Технологи-2026” эрдэм шинжилгээний хурал',
      en: '“Mongolian Information Technology 2026” research conference'
    },
    summary: {
      mn: '“Монголын Мэдээллийн Технологи-2026” эрдэм шинжилгээний хуралд оролцлоо.',
      en: 'We took part in the “Mongolian Information Technology 2026” research conference.',
    },
    body: {
      mn: '“Монголын Мэдээллийн Технологи-2026” эрдэм шинжилгээний хурал 2026 оны 5-р сарын 22-нд Үндэсний батлан хамгаалахын их сургуульд боллоо. Хурлын нээлт, илтгэлүүд, постер танилцуулга болон хуралд оролцсон агшнуудыг хүргэж байна.',
      en: 'The “Mongolian Information Technology 2026” research conference took place on 22 May 2026 at the National Defense University of Mongolia. These photographs show the opening, presentations, poster sessions and moments from the conference.',
    },
    details: {
      date: { mn: '2026.05.22', en: '22 May 2026' },
      location: { mn: 'Үндэсний батлан хамгаалахын их сургууль', en: 'National Defense University of Mongolia' },
      partners: null,
    },
    coverImage: {
      src: '/assets/news/it-conference-2026/opening.jpg', srcSet: '/assets/news/it-conference-2026/opening-small.jpg 768w, /assets/news/it-conference-2026/opening.jpg 1600w',
      width: 1600, height: 1200, position: 'center 45%',
      alt: { mn: '“Монголын Мэдээллийн Технологи-2026” хурлын нээлт', en: 'Opening of the Mongolian Information Technology 2026 conference' },
      caption: { mn: 'Хурлын нээлт.', en: 'The conference opening.' },
    },
    gallery: [
      {
        src: '/assets/news/it-conference-2026/presentation.jpg', srcSet: '/assets/news/it-conference-2026/presentation-small.jpg 768w, /assets/news/it-conference-2026/presentation.jpg 1600w', width: 1600, height: 1200,
        alt: { mn: 'Хурлын танхимд илтгэл тавьж буй агшин', en: 'A presentation in the conference hall' },
        caption: { mn: 'Хурлын илтгэлүүд.', en: 'Conference presentations.' },
      },
      {
        src: '/assets/news/it-conference-2026/ai-cybersecurity.jpg', srcSet: '/assets/news/it-conference-2026/ai-cybersecurity-small.jpg 640w, /assets/news/it-conference-2026/ai-cybersecurity.jpg 1200w', width: 1200, height: 1600,
        alt: { mn: '“Convergence of AI and Cybersecurity” урилгат илтгэлийн дэлгэц', en: 'Screen showing the invited address “Convergence of AI and Cybersecurity”' },
        caption: { mn: '“Convergence of AI and Cybersecurity” урилгат илтгэл.', en: 'Invited address: “Convergence of AI and Cybersecurity”.' },
      },
      ...['poster-1', 'poster-2'].map((name, i) => ({
        src: `/assets/news/it-conference-2026/${name}.jpg`, srcSet: `/assets/news/it-conference-2026/${name}-small.jpg 640w, /assets/news/it-conference-2026/${name}.jpg ${i ? 1120 : 1139}w`, width: i ? 1120 : 1139, height: 1600,
        alt: { mn: 'Хурлын эрдэм шинжилгээний постер', en: 'A research poster at the conference' },
        caption: { mn: 'Эрдэм шинжилгээний постер.', en: 'Research poster.' },
      })),
    ],
  },
  sample('04', { mn: 'Сургалт · Жишээ', en: 'Learning · Sample' }, { mn: 'Дижитал ур чадварын сургалт', en: 'Digital skills workshop' },
    { mn: 'Сургалтын сэдэв, хамрагдсан оролцогчид, бүтээлүүдийг энд танилцуулна.', en: 'Present workshop topics, participants and their work here.' }),
  sample('05', { mn: 'Төсөл · Жишээ', en: 'Projects · Sample' }, { mn: 'Суралцагчдын бүтээлийн өдөр', en: 'Student project showcase' },
    { mn: 'Суралцагчдын төсөл, шийдэл болон туршлагыг энд хуваалцана.', en: 'Share student projects, solutions and experiences here.' }),
  sample('06', { mn: 'Сайн дурын ажил · Жишээ', en: 'Volunteering · Sample' }, { mn: 'Мэдлэгээ хуваалцах сайн дурын өдөр', en: 'Volunteer knowledge sharing' },
    { mn: 'Сайн дурын оролцоо, хамтын ажлын түүхийг энд нийтэлнэ.', en: 'Publish volunteer stories and collaborative activities here.' }),
  sample('07', { mn: 'Хамтын ажиллагаа · Жишээ', en: 'Partnerships · Sample' }, { mn: 'Боловсролын төлөөх хамтын ажиллагаа', en: 'Partnerships for education' },
    { mn: 'Хамтарсан санаачилгын зорилго, явц болон үр дүнг энд танилцуулна.', en: 'Introduce joint initiatives, their progress and outcomes here.' }),
  sample('08', { mn: 'Уулзалт · Жишээ', en: 'Events · Sample' }, { mn: 'Мэргэжил сонголт ба технологийн ирээдүй', en: 'Careers and the future of technology' },
    { mn: 'Зөвлөгөө, ярилцлага болон уулзалтын гол санаануудыг энд хуваалцана.', en: 'Share career advice, conversations and event takeaways here.' }),
];

// Бүртгэл, төлбөр хуудас дахин ачаалахад арилна (санах ойд л хадгалагдана).
export const enrollments = new Map();
export const payments = new Map();

export const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export function notFound(what) {
  return new ApiError(404, 'not_found', `${what} not found`);
}
