/* Local, selectable-text PDFs. Uses the same filled paragraphs and 20x10 lines as Word. */
(function(root){
  'use strict';
  const A4=[595.32,841.92];
  function wrap(text,font,size,width){
    const lines=[];let current='';
    for(const char of Array.from(text)){
      if(current && font.widthOfTextAtSize(current+char,size)>width){lines.push(current);current=char;}else current+=char;
    }
    if(current)lines.push(current);
    return lines;
  }
  function unsupportedCharacters(text,font){
    const codes=new Set(font.getCharacterSet());
    return [...new Set(Array.from(text))].filter(c=>!codes.has(c.codePointAt(0)));
  }
  async function generate(result,assets,PDFLib,fontkit){
    const {PDFDocument,rgb}=PDFLib;
    async function create(title){
      const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
      const font=await doc.embedFont(assets.font,{subset:true});
      const missing=unsupportedCharacters(result.paragraphs.join('')+Object.values(result.data).join(''),font);
      if(missing.length)throw Error(`PDF字型不支援以下字元：${missing.join('')}。請確認輸入字元。`);
      doc.setTitle(title);doc.setAuthor('');doc.setCreator('Letter Generator');
      return {doc,font};
    }
    const general=await create('一般信函');let page=general.doc.addPage(A4),y=A4[1]-60;
    const black=rgb(0,0,0),left=64,right=64,bottom=58;
    for(let i=0;i<result.paragraphs.length;i++){
      const small=i<5 || (i>=15 && i<=19),size=small?10.5:12,lineHeight=small?17:21;
      const lines=wrap(result.paragraphs[i],general.font,size,A4[0]-left-right);
      // Keep a clause together whenever it fits on a fresh page.
      const keepLines=lines.length*lineHeight<A4[1]-60-bottom?lines.length:2;
      if(y-bottom<lineHeight*keepLines){page=general.doc.addPage(A4);y=A4[1]-60;}
      for(const line of lines){
        if(y<bottom+size){page=general.doc.addPage(A4);y=A4[1]-60;}
        page.drawText(line,{x:left,y:y-size,font:general.font,size,color:black});y-=lineHeight;
      }
      y-=i<5?2:7;
    }
    const postal=await create('存證信函');const background=await postal.doc.embedPdf(assets.blank,[0]);
    const config=assets.layout;
    for(let p=0;p<result.letterPages;p++){
      const sheet=postal.doc.addPage(A4);sheet.drawPage(background[0],{x:0,y:0,width:A4[0],height:A4[1]});
      for(let row=0;row<10;row++){
        const line=Array.from(result.lines[p*10+row]||'');
        for(let col=0;col<line.length;col++){
          const char=line[col],size=12,width=postal.font.widthOfTextAtSize(char,size);
          sheet.drawText(char,{x:config.gridX+col*config.cellWidth+(config.cellWidth-width)/2,y:A4[1]-(config.firstBaseline+row*config.cellHeight),size,font:postal.font,color:black});
        }
      }
      for(const meta of config.fields){
        const text=String(meta.key==='pages'?result.letterPages:result.data[meta.key]);
        const lines=wrap(text,postal.font,meta.size,meta.width);
        if(lines.length>meta.maxLines)throw Error(`寄件${meta.key==='name'?'姓名':'地址'}超出郵局欄位，請縮短後再產生。`);
        lines.forEach((line,i)=>sheet.drawText(line,{x:meta.x,y:A4[1]-meta.baseline-i*(meta.lineHeight||meta.size+1),size:meta.size,font:postal.font,color:black}));
      }
    }
    // Detachable recipient list on a plain final page, without postal grid/artwork.
    const slip=postal.doc.addPage(A4),box=result.ccSlip;
    slip.drawText(box.note,{x:64,y:A4[1]-66,size:10,font:postal.font,color:black});
    slip.drawText(box.note2,{x:64,y:A4[1]-86,size:10,font:postal.font,color:black});
    slip.drawRectangle({x:box.x,y:A4[1]-box.top-box.height,width:box.width,height:box.height,borderColor:black,borderWidth:.75,borderDashArray:[3,2]});
    let sy=box.top+box.padding;
    for(let i=0;i<result.cc.length;i++){
      const size=i===0?11:9,height=i===0?16:12;
      for(const line of wrap(result.cc[i],postal.font,size,box.width-2*box.padding)){
        slip.drawText(line,{x:box.x+box.padding,y:A4[1]-sy-size,font:postal.font,size,color:black});sy+=height;
      }
    }
    if(sy>box.top+box.height-box.padding)throw Error('副本聯記表內容超出剪貼框，請調整版型。');
    return {generalPdf:await general.doc.save(),postalPdf:await postal.doc.save(),generalPdfPages:general.doc.getPageCount(),postalPdfPages:postal.doc.getPageCount()};
  }
  const api={generate,wrap};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LetterPdfGenerator=api;
})(typeof globalThis!=='undefined'?globalThis:this);
