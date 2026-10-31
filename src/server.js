import './env.js'; // эхэнд нь: app.js-ээс өмнө .env уншигдах ёстой
import app from './app.js';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`MCI backend: http://localhost:${port}/api`));
