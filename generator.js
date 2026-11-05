/* Shared by the browser and Node tests. DOCX packages remain on this device. */
(function (root) {
  'use strict';
  const filenames = ['一般信函_20261028.docx', '存證信函_20261028.docx'];
  const escapeXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  function rocDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('請填寫完整日期。');
    const [y,m,d] = s.split('-').map(Number), dt = new Date(Date.UTC(y,m-1,d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m-1 || dt.getUTCDate() !== d || y < 1912 || y > 2200) throw Error('日期無效。');
    return `${y-1911}年${m}月${d}日`;
  }
  const money = n => `${(n/10000).toLocaleString('en-US',{maximumFractionDigits:4})}萬元`;
  function wanToYuan(value) {
    const text=String(value).trim();
    if(!/^\d+(?:\.\d{1,4})?$/.test(text)) throw Error('金額請以萬元填寫，最多小數4位（精確至1元）。');
    const [whole,fraction='']=text.split('.');
    const yuan=Number(whole)*10000+Number(fraction.padEnd(4,'0'));
    if(!Number.isSafeInteger(yuan) || yuan<1 || yuan>1000000000) throw Error('金額須介於0.0001萬元與100,000萬元之間。');
    return yuan;
  }
  function validate(input) {
    const d = {...input};
    for (const [key,label,max] of [['name','姓名',20],['address','收件地址',48],['household','戶別',8]]) {
      d[key] = String(d[key] || '').trim();
      if (!d[key] || Array.from(d[key]).length > max || /[\x00-\x1f\x7f\ufffe\uffff]/.test(d[key])) throw Error(`${label}必填，且不得超過${max}字或包含換行。`);
    }
    d.floor = Number(d.floor);
    if (!Number.isInteger(d.floor) || d.floor < 1 || d.floor > 99) throw Error('樓層須為1至99的整數。');
    const amount = (n,label) => {
      if (String(n).trim() === '' || !/^\d+$/.test(String(n)) || !Number.isSafeInteger(Number(n)) || Number(n)<1 || Number(n)>1000000000) throw Error(`${label}須為1至10億元的整數（元）。`);
      return Number(n);
    };
    d.total = amount(d.total,'契約總價');
    if (!Array.isArray(d.invoices) || !d.invoices.length || d.invoices.length > 30) throw Error('請填寫1至30筆發票金額。');
    d.invoices = d.invoices.map((n,i)=>amount(n,`第${i+1}筆發票`));
    d.paid = d.invoices.reduce((a,b)=>a+b,0);
    d.trust = d.trust === undefined ? d.paid : amount(d.trust,'信託查詢金額');
    if (d.paid > d.total) throw Error('已繳款合計不可超過契約總價。');
    if (d.trust !== d.paid) throw Error('目前範本以全部已繳款仍在信託為前提；信託金額與發票合計不同，請先核對資料。');
    d.contractDateText = rocDate(d.contractDate); d.mailDateText = rocDate(d.mailDate);
    if (d.mailDate < d.contractDate) throw Error('交寄日期不可早於簽約日期。');
    // Contract wording: 15% of the price, capped at the amount paid. Round to whole NTD.
    d.penalty = Math.min(Math.round(d.total * 15 / 100),d.paid); d.claim = d.paid+d.penalty;
    return d;
  }
  function values(input) {
    const d=validate(input);
    return {name:d.name,address:d.address,unit:`第${d.floor}樓第${d.household}戶`,contractDate:d.contractDateText,mailDate:d.mailDateText,total:money(d.total),paid:money(d.paid),trust:money(d.trust),penalty:money(d.penalty),claim:money(d.claim),invoiceCount:String(d.invoices.length),invoices:d.invoices.map(money).join('、')};
  }
  function fill(template, data, xml=false) {
    return template.replace(/\{\{(\w+)\}\}/g,(_,key)=> {
      if (!(key in data)) throw Error(`範本欄位缺漏：${key}`);
      return xml ? escapeXml(data[key]) : data[key];
    });
  }
  function linesFor(paragraphs) {
    return paragraphs.flatMap(p=> {const a=Array.from(p),lines=[];for(let i=0;i<a.length;i+=20)lines.push(a.slice(i,i+20).join(''));return lines;});
  }
  async function generate(input, assets, JSZip) {
    const data=values(input), paragraphs=assets.content.paragraphs.map(p=>fill(p,data));
    const original=await JSZip.loadAsync(assets.original), postal=await JSZip.loadAsync(assets.postal);
    original.file('word/document.xml',fill(await original.file('word/document.xml').async('string'),data,true));
    const lines=linesFor(paragraphs.slice(5)),letterPages=Math.ceil(lines.length/10),pages=letterPages+1;
    let body='';
    for(let page=0;page<letterPages;page++) {
      const table=assets.content.postalTable.replace(/\{\{CELL_(\d+)\}\}/g,(_,i)=> {
        const row=Math.floor(Number(i)/20),col=Number(i)%20;
        return escapeXml(Array.from(lines[page*10+row]||'')[col]||'');
      });
      // Normal document-body tables allow clicking, selecting, deleting and typing.
      const separator=`<w:p><w:pPr>${page?'<w:pageBreakBefore/>':''}<w:keepNext/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr></w:r></w:p>`;
      body+=separator+table;
    }
    body+=assets.content.ccSlipWord;
    const xml=await postal.file('word/document.xml').async('string');
    postal.file('word/document.xml',xml.replace(/(<w:body[^>]*>)/,match=>match+body));
    postal.file('word/header1.xml',fill(await postal.file('word/header1.xml').async('string'),{...data,pages:letterPages},true));
    const options={type:'uint8array',compression:'DEFLATE'};
    return {original:await original.generateAsync(options),postal:await postal.generateAsync(options),paragraphs,pages,letterPages,lines,data,cc:assets.content.cc,ccSlip:assets.content.ccSlip};
  }
  const api={filenames,validate,values,fill,linesFor,generate,rocDate,money,wanToYuan};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.LetterGenerator=api;
})(typeof globalThis!=='undefined'?globalThis:this);


