// PDF-ийн гурван слайдтай нүүр хуудасны сургалтууд. `id` нь API-ийн курсын id, `open` бол төлбөртэй бүртгэлтэй (бусад нь хүлээлгийн жагсаалт). `kind` нь CourseArt-ийн хувилбарыг (code / chart / keys) заана.
export const homeCourses = [
  {
    id: 'data-analysis', open: true, kind: 'chart', art: 'art2', slide: true,
    image: { src: '/assets/courses/power-bi-slide.jpg', width: 1200, height: 674, alt: { mn: 'Power BI ба өгөгдлийн шинжилгээ сургалт', en: 'Power BI and Data Analysis course' } },
    tag: { mn: 'ӨГӨГДӨЛ БА ШИНЖИЛГЭЭ', en: 'DATA & ANALYTICS' },
    title: { mn: 'Өгөгдлийн шинжилгээ ба Power BI', en: 'Data Analysis & Power BI' },
    text: { mn: 'Өгөгдлөө цэгцэлж, шинжилгээ хийн, үр дүнгээ ойлгомжтой тайлан болон интерактив самбараар харуулж сураарай. Power BI ашиглан мэдээллээ шийдвэр гаргахад хэрэгтэй бодит ойлголт болгох ур чадвар эзэмшинэ.', en: 'Learn to organise and analyse data, then communicate your findings through clear reports and interactive dashboards. Turn information into insights for better decisions with Power BI.' },
    meta: { mn: 'Анхан, ахисан түвшин · Өгөгдөл, тайлан, Power BI', en: 'Beginner to advanced · Data, reporting, Power BI' },
    status: { mn: 'Бүртгэл нээлттэй', en: 'Enrollment open' },
    button: { mn: 'Сургалт авах', en: 'Take this course' },
  },
  {
    id: 'cybersecurity', kind: 'code', art: 'art1', slide: true,
    image: { src: '/assets/courses/cybersecurity-slide.jpg', width: 1200, height: 674, alt: { mn: 'Мэдээллийн аюулгүй байдал сургалт', en: 'Information Security course' } },
    tag: { mn: 'МЭДЭЭЛЛИЙН АЮУЛГҮЙ БАЙДАЛ', en: 'INFORMATION SECURITY' },
    title: { mn: 'Мэдээллийн аюулгүй байдал', en: 'Information Security' },
    text: { mn: 'Хувийн болон байгууллагын мэдээллээ хамгаалах үндсэн арга барилтай танилцаарай. Цахим эрсдэлийг таних, бүртгэлээ найдвартай хамгаалах, өдөр тутамдаа аюулгүй ажиллах дадлыг эзэмшинэ.', en: 'Explore the foundations of protecting personal and business information. Learn to recognise digital risks, secure your accounts and build safer everyday habits.' },
    meta: { mn: 'Цахим эрсдэл · Мэдээлэл хамгаалалт', en: 'Digital risks · Information protection' },
    status: { mn: 'Удахгүй', en: 'Coming soon' },
    button: { mn: 'Хүлээлгийн жагсаалт', en: 'Join waitlist' },
  },
  {
    id: 'machine-learning', kind: 'code', art: 'art3', slide: true,
    image: { src: '/assets/courses/ai-deep-learning-slide.jpg', width: 1200, height: 674, alt: { mn: 'AI ба Deep Learning сургалт', en: 'AI and Deep Learning course' } },
    tag: { mn: 'ХИЙМЭЛ ОЮУН', en: 'ARTIFICIAL INTELLIGENCE' },
    title: { mn: 'AI & Deep Learning', en: 'AI & Deep Learning' },
    text: { mn: 'Хиймэл оюун болон гүн сургалтын үндсэн ойлголтуудыг судлаарай. Өгөгдөл бэлтгэхээс эхлэн загвар сургах, үр дүнг үнэлэх хүртэлх үйл явцыг ойлгож, бодит асуудалд хэрэглэх сууриа тавина.', en: 'Discover the foundations of artificial intelligence and deep learning. Understand the journey from preparing data to training and evaluating models for real-world problems.' },
    meta: { mn: 'Хиймэл оюун · Гүн сургалт · Загвар', en: 'Artificial intelligence · Deep learning · Models' },
    status: { mn: 'Удахгүй', en: 'Coming soon' },
    button: { mn: 'Хүлээлгийн жагсаалт', en: 'Join waitlist' },
  },
];

export const chartBars = ['40%', '65%', '53%', '87%', '100%'];

// art-code блок: 3 мөр + ногоон "ready" мөр
export const courseCodeArt = {
  mn: { lines: ['> сайн уу, ирээдүй.', 'def sanaagaa_buteeh():', '  return bolomj'], ok: '✓ бүтээхэд бэлэн' },
  en: { lines: ['> hello, future.', 'def build_your_idea():', '  return possibility'], ok: '✓ ready to create' },
};

export const courseKeys = ['⌘', '⇧', '✦'];
