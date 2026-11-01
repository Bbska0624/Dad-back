import '../src/env.js';
import {readFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
try {
 const rows=JSON.parse(readFileSync(new URL('../src/data/services.json',import.meta.url),'utf8'));
 for(const [sortOrder,row] of rows.entries()) await db.service.upsert({where:{id:row.id},create:{...row,sortOrder},update:{}});
 console.log('Services initialized; existing edits preserved.');
} finally {await db.$disconnect();}
