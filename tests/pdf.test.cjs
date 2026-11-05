const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../generator.js'),P=require('../pdf-generator.js'),Zip=require('../vendor/jszip.min.js'),PDFLib=require('../vendor/pdf-lib.min.js'),fontkit=require('../vendor/fontkit.umd.min.js');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p));
const assets={original:read('assets/original.docx'),postal:read('assets/postal.docx'),content:JSON.parse(read('assets/content.json')),blank:read('assets/postal-blank.pdf'),font:read('assets/NotoSerifTC-Regular.ttf'),layout:JSON.parse(read('assets/pdf-layout.json'))};
const sample={name:'王小明',address:'220 新北市板橋區示例路1號5樓',household:'A',floor:5,contractDate:'2023-11-07',mailDate:'2026-10-28',total:16780000,invoices:[350000,150000,110000,230000]};
test('generate two selectable-text PDFs using retained Word postal form',async()=>{
 const result=await G.generate(sample,assets,Zip);const pdfs=await P.generate(result,assets,PDFLib,fontkit);
 const general=await PDFLib.PDFDocument.load(pdfs.generalPdf),postal=await PDFLib.PDFDocument.load(pdfs.postalPdf);
 assert.equal(general.getPageCount(),2);assert.equal(postal.getPageCount(),result.pages);assert.equal(postal.getPageCount(),result.letterPages+1);assert.equal(result.letterPages,8);assert.equal(postal.getPageCount(),9);
 for(const p of postal.getPages()){assert.equal(p.getWidth(),595.32);assert.equal(p.getHeight(),841.92);}
 const out=path.resolve(root,'../tmp/pdf-upgrade/output');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,G.filenames[0]),result.original);fs.writeFileSync(path.join(out,G.filenames[1]),result.postal);
 fs.writeFileSync(path.join(out,G.filenames[0].replace('.docx','.pdf')),pdfs.generalPdf);fs.writeFileSync(path.join(out,G.filenames[1].replace('.docx','.pdf')),pdfs.postalPdf);
 fs.writeFileSync(path.join(out,'expected.json'),JSON.stringify({paragraphs:result.paragraphs,lines:result.lines,data:result.data,pages:result.pages,letterPages:result.letterPages,cc:result.cc}));
});


