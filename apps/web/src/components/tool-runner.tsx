'use client';
import {useState} from 'react';
import QRCode from 'qrcode';
import {PDFDocument,degrees} from 'pdf-lib';
import {getTool} from '@/lib/tools';

function save(data:Blob,name:string){const u=URL.createObjectURL(data);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
function rangePages(value:string,max:number){const items=new Set<number>();for(const token of value.split(',')){const s=token.trim();if(!s)continue;const match=/^(\d+)(?:-(\d+))?$/.exec(s);if(!match)throw new Error('Use pages like 1,3-5');const first=Number(match[1]),last=Number(match[2]||match[1]);if(first<1||last>max||last<first)throw new Error(`Pages must be between 1 and ${max}`);for(let i=first;i<=last;i++)items.add(i-1)}if(!items.size)throw new Error('Select at least one page');return [...items].sort((a,b)=>a-b)}
async function canvasBlob(canvas:HTMLCanvasElement,type:string,quality:number){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export failed')),type,quality));}
const MAX_IMAGE_PIXELS = 45_000_000;
const imageTypes: Record<string, string> = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp'};
async function processImage(file: File, slug: string, option: string, quality: number) {
  if (file.size === 0 || file.size > 20 * 1024 * 1024) throw Error('Choose an image of up to 20 MiB');
  if (!Object.values(imageTypes).includes(file.type)) throw Error('Only PNG, JPEG and WebP are supported');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > MAX_IMAGE_PIXELS) throw Error('Image pixel dimensions exceed the safety limit');
    let width = image.width;
    let height = image.height;
    let source = [0, 0, width, height];

    if (slug === 'resize-image') {
      width = option.trim() ? Number(option) : Math.max(1, Math.round(image.width / 2));
      if (!Number.isInteger(width) || width < 1 || width > 12_000) throw Error('Enter a whole width from 1 to 12000');
      height = Math.max(1, Math.round(image.height * width / image.width));
    }
    if (slug === 'crop-image') {
      const values = option.trim() ? option.split(',').map(value => value.trim())
        : ['0', '0', String(Math.max(1, Math.floor(width / 2))), String(Math.max(1, Math.floor(height / 2)))];
      if (values.length !== 4 || values.some(value => !/^\d+$/.test(value))) throw Error('Use x,y,width,height within the image');
      const [x, y, cropWidth, cropHeight] = values.map(Number);
      if (!cropWidth || !cropHeight || x + cropWidth > width || y + cropHeight > height) throw Error('Crop must fit within the image');
      width = cropWidth;
      height = cropHeight;
      source = [x, y, width, height];
    }
    if (width * height > MAX_IMAGE_PIXELS || width > 16_384 || height > 16_384) throw Error('Output dimensions exceed the safety limit');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Canvas unavailable');
    const [x, y, sourceWidth, sourceHeight] = source;
    context.drawImage(image, x, y, sourceWidth, sourceHeight, 0, 0, width, height);
    const type = slug === 'convert-image' ? imageTypes[option || 'webp']
      : slug === 'compress-image' ? imageTypes[option || 'jpeg'] : file.type;
    const blob = await canvasBlob(canvas, type, quality);
    if (blob.type !== type) throw Error('This browser cannot export the selected format');
    return blob;
  } finally {
    image.close();
  }
}
const PDF_TOOLS=['merge-pdf','split-pdf','rotate-pdf','extract-pdf'];
const IMAGE_TOOLS=['resize-image','convert-image','compress-image','crop-image'];
export function ToolRunner({slug}:{slug:string}){
 const tool=getTool(slug);const [files,setFiles]=useState<File[]>([]);const [input,setInput]=useState('');const [option,setOption]=useState('');const [result,setResult]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [quality,setQuality]=useState(0.8);
 if(!tool)return <p>Unknown tool</p>;
 const isPdf=PDF_TOOLS.includes(slug),isImage=IMAGE_TOOLS.includes(slug),needsFile=isPdf||isImage;
 const accept=isPdf?'.pdf,application/pdf':isImage?'image/png,image/jpeg,image/webp':'';
 const inputLimit = slug === 'qr-code' ? 2048 : 1_000_000;
 async function run(){setError('');setResult('');setBusy(true);try{
  if(needsFile&&files.length===0)throw Error('Choose a file first');
 if(!needsFile&&input.length>inputLimit)throw Error('Input is too long');
  if(isPdf){
   if(files.length>10)throw Error('Maximum 10 files');for(const f of files){if(f.size>25*1024*1024||f.size===0)throw Error('PDF must be 1 byte to 25 MB');if(!f.name.toLowerCase().endsWith('.pdf'))throw Error('Choose PDF files');}
   const out=await PDFDocument.create();
   if(slug==='merge-pdf'){
    if(files.length<2)throw Error('Select at least two PDFs');let count=0;
    for(const f of files){const source=await PDFDocument.load(await f.arrayBuffer());count+=source.getPageCount();if(count>200)throw Error('Limit: 200 pages');const pages=await out.copyPages(source,source.getPageIndices());pages.forEach(p=>out.addPage(p));}
   }else{
    const source=await PDFDocument.load(await files[0].arrayBuffer());const n=source.getPageCount();if(n>200)throw Error('Limit: 200 pages');
    if(slug==='rotate-pdf'){const angle=Number(option||'90');if(![90,180,270].includes(angle))throw Error('Invalid rotation');const copy=await out.copyPages(source,source.getPageIndices());copy.forEach((p,i)=>{p.setRotation(degrees((source.getPage(i).getRotation().angle+angle)%360));out.addPage(p)})}
    else {const indices=rangePages(option||'1',n);const copy=await out.copyPages(source,indices);copy.forEach(p=>out.addPage(p));}
   }
   save(new Blob([new Uint8Array(await out.save())],{type:'application/pdf'}),`${slug}-${Date.now()}.pdf`);setResult('PDF processed locally and downloaded.');
  }else if(isImage){
   const blob = await processImage(files[0], slug, option, quality);
   const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
   save(blob, `${slug}-${Date.now()}.${extension}`);
   setResult(`Image downloaded (${Math.round(blob.size / 1024)} KB).`);
  }else if(slug==='qr-code'){if(!input.trim()||input.length>2048)throw Error('Enter 1–2048 characters');const uri=await QRCode.toDataURL(input,{width:512,margin:2,errorCorrectionLevel:'M'});const response=await fetch(uri);save(await response.blob(),'toolnest-qr.png');setResult('QR PNG downloaded.');}
  else if(slug==='json-formatter'){setResult(JSON.stringify(JSON.parse(input),null,2));}
  else if(slug==='base64'){if(option==='decode'){const binary=atob(input.trim());const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));setResult(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}else{const bytes=new TextEncoder().encode(input);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);setResult(btoa(binary))}}
  else if(slug==='text-case'){if(option==='lower')setResult(input.toLowerCase());else if(option==='title')setResult(input.toLowerCase().replace(/\b\p{L}/gu,x=>x.toUpperCase()));else setResult(input.toUpperCase())}
 }catch(e){setError(e instanceof Error?e.message:'Unexpected failure');}finally{setBusy(false)}}
 const helper=slug==='rotate-pdf'?'Angle (90, 180 or 270)':slug==='split-pdf'||slug==='extract-pdf'?'Pages (e.g. 1,3-5)':slug==='resize-image'?'Target width in pixels':slug==='crop-image'?'x,y,width,height':'';
 return <div className="card max-w-2xl"><p className="text-xs uppercase tracking-wider text-blue-600 font-bold">{tool.kind} utility · processed on your device</p><h1 className="text-3xl font-bold mt-2">{tool.icon} {tool.title}</h1><p className="text-slate-600 mt-2 mb-7">{tool.description}</p>
 {needsFile?<div><label className="block font-semibold text-sm mb-2">Choose {slug==='merge-pdf'?'PDF files':'a file'}<input className="field mt-2" type="file" accept={accept} multiple={slug==='merge-pdf'} disabled={busy} onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>{files.length>0&&<p className="text-xs text-slate-500 mt-2 break-words">{files.map(f=>f.name).join(', ')}</p>}</div>:<label className="block font-semibold text-sm">Input text<textarea className="field min-h-40 mt-2" value={input} maxLength={inputLimit} onChange={e=>setInput(e.target.value)} placeholder="Enter your content"/></label>}
 {helper&&<label className="block text-sm font-semibold mt-5">{helper}<input className="field mt-2" value={option} onChange={e=>setOption(e.target.value)} placeholder={slug==='resize-image'?'800':slug==='crop-image'?'0,0,500,500':slug==='rotate-pdf'?'90':'1,3-5'}/></label>}
 {['convert-image','base64','text-case'].includes(slug)&&<label className="block text-sm font-semibold mt-5">Mode<select className="field mt-2" value={option} onChange={e=>setOption(e.target.value)}>{(slug==='convert-image'?[['webp','WebP'],['jpeg','JPEG'],['png','PNG']]:slug==='base64'?[['encode','Encode'],['decode','Decode']]:[['upper','UPPERCASE'],['lower','lowercase'],['title','Title Case']]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>}
 {slug==='compress-image'&&<label className="block text-sm font-semibold mt-5">Output format<select className="field mt-2" value={option||'jpeg'} onChange={event=>setOption(event.target.value)}><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>}
 {['compress-image','convert-image'].includes(slug)&&<label className="block text-sm font-semibold mt-5">Quality: {quality.toFixed(1)}<input className="block w-full mt-2" type="range" min="0.1" max="1" step="0.1" value={quality} onChange={e=>setQuality(Number(e.target.value))}/></label>}
 <button className="btn mt-6" onClick={run} disabled={busy}>{busy?'Processing...':'Run tool'}</button>{error&&<div className="mt-5 text-sm text-red-700 bg-red-50 p-3 rounded-xl" role="alert">{error}</div>}{result&&<div className="mt-5 text-sm bg-green-50 text-green-900 p-3 rounded-xl" role="status"><pre className="whitespace-pre-wrap break-all max-h-96 overflow-auto">{result}</pre></div>}
 <p className="text-xs text-slate-500 mt-6">This browser-based tool does not upload your selected files to the ToolNest server. Processing large files can use significant device memory.</p></div>
}
