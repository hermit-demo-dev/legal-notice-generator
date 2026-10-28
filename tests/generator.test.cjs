const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../generator.js'),Zip=require('../vendor/jszip.min.js');
const root=path.join(__dirname,'..');
const assets={original:fs.readFileSync(path.join(root,'assets/original.docx')),postal:fs.readFileSync(path.join(root,'assets/postal.docx')),content:JSON.parse(fs.readFileSync(path.join(root,'assets/content.json'),'utf8'))};
const sample={name:'王小明',address:'220 新北市板橋區示例路1號5樓',household:'A',floor:5,contractDate:'2023-11-07',mailDate:'2026-10-28',total:16780000,trust:840000,invoices:[350000,150000,110000,230000]};
test('general letter download filename',()=>assert.equal(G.filenames[0],'一般信函_20261028.docx'));
test('all reusable fields and money calculations',()=>{const v=G.values(sample);assert.equal(v.paid,'84萬元');assert.equal(v.penalty,'84萬元');assert.equal(v.claim,'168萬元');assert.equal(v.invoiceCount,'4');assert.equal(v.contractDate,'112年11月7日');});
test('trust amount is reused without a second input',()=>{const {trust,...input}=sample;assert.equal(G.values(input).trust,'84萬元');});
test('15% cap and fractional wan amounts',()=>{const v=G.values({...sample,total:1000000,trust:200001,invoices:[200001]});assert.equal(v.penalty,'15萬元');assert.equal(v.claim,'35.0001萬元');assert.equal(v.paid,'20.0001萬元');});
test('wan inputs convert exactly to whole yuan without changing claim amounts',()=>{
 assert.equal(G.wanToYuan('1678'),16780000);assert.equal(G.wanToYuan('35.0001'),350001);assert.equal(G.wanToYuan('0.0001'),1);
 assert.equal(G.wanToYuan('1.001'),10010);assert.equal(G.money(1),'0.0001萬元');assert.equal(G.money(16780000),'1,678萬元');
 for(const value of ['','-1','0','1.00001','NaN','1e3','100000.0001'])assert.throws(()=>G.wanToYuan(value));
 const input={...sample,total:G.wanToYuan('1678'),invoices:['35','15','11','23'].map(G.wanToYuan)};
 assert.equal(G.values(input).claim,'168萬元');
});
test('validate dates, amount mismatches and invalid inputs',()=>{
 for(const delta of [{contractDate:'2023-02-29'},{total:0},{invoices:[]},{trust:1},{name:'x\nY'},{floor:0},{total:'1.1'},{mailDate:'2022-01-01'}])assert.throws(()=>G.validate({...sample,...delta}));
 assert.equal(G.rocDate('2024-02-29'),'113年2月29日');assert.equal(G.linesFor(['😀'.repeat(21)])[0].length,40);
});
test('generate complete packages with every character and variable preserved',async()=>{
 const result=await G.generate(sample,assets,Zip), o=await Zip.loadAsync(result.original),p=await Zip.loadAsync(result.postal);
 const ox=await o.file('word/document.xml').async('string'),px=await p.file('word/document.xml').async('string');
 assert.equal(result.pages,9);assert(!/\{\{/.test(ox+px));assert.equal((px.match(/<w:tbl[ >]/g)||[]).length,result.pages*2);
 assert(ox.includes('EE0000'));assert(px.includes('王小明'));assert(px.includes('220 新北市板橋區示例路1號5樓'));assert(px.includes('w:color="000000"'));assert(!px.includes('<a:blip '));
 for(const m of px.matchAll(/<wps:txbx\b[^>]*\bid="(\d+)"/g))assert(Number(m[1])<=65535,'Word textbox story id must remain within unsigned-short range');
 const tables=[...px.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].map(m=>m[0]);let recovered='';
 for(let i=0;i<tables.length;i+=2){
  const rows=[...tables[i].matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(m=>m[0]).slice(1);
  for(const row of rows){const cells=[...row.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(m=>m[0]).slice(1);for(const cell of cells)recovered+=[...cell.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m=>m[1]).join('');}
 }
 assert.equal(recovered,result.lines.join(''));
 const body=result.paragraphs.join('\n');assert.equal(result.data.unit,'第5樓第A戶');assert.equal((body.match(/第5樓第A戶/g)||[]).length,2);assert(!body.includes('棟'));assert(body.includes('4張發票影本'));assert.equal((body.match(/本函送達後14日內/g)||[]).length,2);
 assert.equal(result.paragraphs.at(-1),'寄件人簽章：');assert(!ox.includes('（親簽）'));assert(!px.includes('（親簽）'));
 const lastParagraph=[...ox.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].at(-1)[0];
 assert.equal([...lastParagraph.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m=>m[1]).join(''),'寄件人簽章：');
 const out=path.resolve(root,'../tmp/web-generator/output');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,G.filenames[0]),result.original);fs.writeFileSync(path.join(out,G.filenames[1]),result.postal);
});
test('XML-special text and different household dynamically repaginate',async()=>{
 const result=await G.generate({...sample,name:'林<&小明',household:'B',floor:12,invoices:Array(30).fill(10000),trust:300000},assets,Zip);
 const z=await Zip.loadAsync(result.original),xml=await z.file('word/document.xml').async('string');assert(xml.includes('林&lt;&amp;小明'));assert(result.paragraphs[5].includes('第12樓第B戶'));assert(result.paragraphs[17].includes('30張'));assert(result.pages>9);
});
test('public templates contain no original buyer-specific values or external relationships',async()=>{
 for(const bytes of [assets.original,assets.postal]){const z=await Zip.loadAsync(bytes);for(const name of Object.keys(z.files).filter(n=>n.endsWith('.xml')||n.endsWith('.rels'))){const s=await z.file(name).async('string');assert(!/TargetMode="External"/.test(s));if(name==='word/document.xml')assert(!s.includes('第5樓第A戶')&&!s.includes('1,678萬元')&&!s.includes('84萬元'));}}
});



