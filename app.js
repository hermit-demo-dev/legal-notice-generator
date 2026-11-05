'use strict';
const form=document.querySelector('#form'), invoices=document.querySelector('#invoices');
let current=null, urls=[], revision=0;
const currency=n=>LetterGenerator.money(n);
const contractYear=document.querySelector('#contract-year'),contractMonth=document.querySelector('#contract-month'),contractDay=document.querySelector('#contract-day');
for(let y=1912;y<=Math.max(2036,new Date().getFullYear()+10);y++)contractYear.add(new Option(`${y}年`,y));
for(let m=1;m<=12;m++)contractMonth.add(new Option(`${m}月`,m));
contractYear.value='2023';contractMonth.value='11';
function syncContractDate(resetDay=false){
  const chosen=resetDay?'':contractDay.value,year=Number(contractYear.value),month=Number(contractMonth.value);
  contractDay.replaceChildren(new Option('選擇日',''));
  for(let d=1;d<=new Date(year,month,0).getDate();d++)contractDay.add(new Option(`${d}日`,d));
  contractDay.value=chosen;
  form.elements.contractDate.value=contractDay.value?`${year}-${String(month).padStart(2,'0')}-${String(contractDay.value).padStart(2,'0')}`:'';
}
function setContractDate(value){const [y,m,d]=value.split('-').map(Number);contractYear.value=String(y);contractMonth.value=String(m);syncContractDate(true);contractDay.value=String(d);syncContractDate();}
contractYear.onchange=contractMonth.onchange=()=>{syncContractDate(true);update();};
contractDay.onchange=()=>{syncContractDate();update();};
syncContractDate();
function hideResults(){revision++;current=null;document.querySelector('#results').hidden=true;urls.forEach(URL.revokeObjectURL);urls=[];}
function update(){
  hideResults();
  const yuan=value=>{try{return LetterGenerator.wanToYuan(value);}catch{return 0;}};
  const paid=[...invoices.querySelectorAll('input')].reduce((s,i)=>s+yuan(i.value),0),total=yuan(form.elements.total.value),penalty=Math.min(Math.round(total*.15),paid);
  document.querySelector('#paid').textContent=currency(paid);document.querySelector('#sum-paid').textContent=currency(paid);document.querySelector('#sum-penalty').textContent=total?currency(penalty):'—';document.querySelector('#claim').textContent=total?currency(paid+penalty):'— 萬元';
}
function addInvoice(value=''){
  if(invoices.children.length>=30)return;
  const row=document.createElement('div');row.className='invoice-row';
  const label=document.createElement('label'),span=document.createElement('span'),input=document.createElement('input'),button=document.createElement('button');
  input.type='number';input.inputMode='decimal';input.min='0.0001';input.max='100000';input.step='0.0001';input.required=true;input.value=value;input.placeholder='金額（萬元）';
  button.type='button';button.className='remove';button.textContent='×';button.title='移除此筆';
  label.append(span,input);row.append(label,button);invoices.append(row);
  button.onclick=()=>{row.remove();renumber();update();};renumber();update();
}
function renumber(){[...invoices.children].forEach((row,i)=>{row.querySelector('span').textContent=`第 ${i+1} 張`;row.querySelector('button').setAttribute('aria-label',`移除第${i+1}張發票`);});document.querySelector('#add').disabled=invoices.children.length>=30;}
function read(){const d=Object.fromEntries(new FormData(form));d.total=LetterGenerator.wanToYuan(d.total);d.invoices=[...invoices.querySelectorAll('input')].map(i=>LetterGenerator.wanToYuan(i.value));return d;}
async function loadAssets(){
  const changedAssets=new Set(['assets/postal.docx','assets/content.json','assets/postal-blank.pdf']);
  const responses=await Promise.all(['assets/original.docx','assets/postal.docx','assets/content.json','assets/postal-blank.pdf','assets/NotoSerifTC-Regular.ttf','assets/pdf-layout.json'].map(p=>fetch(p+(changedAssets.has(p)?'?v=20261105-postal-5':''))));
  if(responses.some(r=>!r.ok))throw Error('無法讀取範本，請重新整理網頁後再試。');
  return {original:await responses[0].arrayBuffer(),postal:await responses[1].arrayBuffer(),content:await responses[2].json(),blank:await responses[3].arrayBuffer(),font:await responses[4].arrayBuffer(),layout:await responses[5].json()};
}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));urls.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.click();}
document.querySelector('#add').onclick=()=>addInvoice();
form.addEventListener('input',()=>{update();document.querySelector('#error').hidden=true;});
document.querySelector('#sample').onclick=()=>{
  const sample={name:'王小明',address:'220 新北市板橋區示例路1號5樓',household:'A',floor:5,contractDate:'2023-11-07',mailDate:'2026-10-28',total:1678};
  Object.entries(sample).forEach(([k,v])=>form.elements[k].value=v);setContractDate(sample.contractDate);invoices.replaceChildren();[35,15,11,23].forEach(addInvoice);document.querySelector('#confirm').checked=false;update();
};
form.onsubmit=async e=>{
  e.preventDefault();const error=document.querySelector('#error'),button=document.querySelector('#generate');error.hidden=true;hideResults();
  const started=revision;
  try{
    if(!document.querySelector('#confirm').checked)throw Error('請確認範本適用情況。');
    const data=read();LetterGenerator.validate(data);button.disabled=true;button.textContent='正在製作 Word 與 PDF…';
    const assets=await loadAssets();
    const result=await LetterGenerator.generate(data,assets,JSZip);
    Object.assign(result,await LetterPdfGenerator.generate(result,assets,PDFLib,fontkit));
    if(started!==revision)throw Error('資料已變更，請重新產生文件。');
    current=result;document.querySelector('#results').hidden=false;document.querySelector('#status').textContent=`四份檔案已備妥。一般信函 PDF ${result.generalPdfPages} 頁；存證信函正文 ${result.letterPages} 頁＋末頁剪貼聯記表 1 頁，共 ${result.pages} 頁。`;
    const preview=document.querySelector('#preview');preview.replaceChildren();result.paragraphs.forEach(text=>{const p=document.createElement('p');p.textContent=text;preview.append(p);});
    document.querySelector('#results').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(ex){error.textContent=ex.message||'產生失敗，請重新整理後再試。';error.hidden=false;error.scrollIntoView({behavior:'smooth',block:'center'});}
  finally{button.disabled=false;button.innerHTML='產生 Word 與 PDF <span>↗</span>';}
};
document.querySelector('#download-original').onclick=()=>{if(current)download(current.original,LetterGenerator.filenames[0],'application/vnd.openxmlformats-officedocument.wordprocessingml.document');};
document.querySelector('#download-postal').onclick=()=>{if(current)download(current.postal,LetterGenerator.filenames[1],'application/vnd.openxmlformats-officedocument.wordprocessingml.document');};
document.querySelector('#download-general-pdf').onclick=()=>{if(current)download(current.generalPdf,LetterGenerator.filenames[0].replace(/\.docx$/,'.pdf'),'application/pdf');};
document.querySelector('#download-postal-pdf').onclick=()=>{if(current)download(current.postalPdf,LetterGenerator.filenames[1].replace(/\.docx$/,'.pdf'),'application/pdf');};
document.querySelector('#download-zip').onclick=async()=>{if(!current)return;const z=new JSZip();z.file(LetterGenerator.filenames[0],current.original);z.file(LetterGenerator.filenames[1],current.postal);z.file(LetterGenerator.filenames[0].replace(/\.docx$/,'.pdf'),current.generalPdf);z.file(LetterGenerator.filenames[1].replace(/\.docx$/,'.pdf'),current.postalPdf);download(await z.generateAsync({type:'uint8array',compression:'DEFLATE'}),'信函_Word與PDF.zip','application/zip');};
for(let i=0;i<4;i++)addInvoice();



