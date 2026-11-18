export type ToolKind='pdf'|'image'|'developer';
export type ToolDefinition={slug:string;title:string;description:string;kind:ToolKind;icon:string};
export const TOOLS:ToolDefinition[]=[
{slug:'merge-pdf',title:'Merge PDF',description:'Combine PDF documents in order',kind:'pdf',icon:'📑'},
{slug:'split-pdf',title:'Split PDF',description:'Separate a page range from a PDF',kind:'pdf',icon:'✂️'},
{slug:'rotate-pdf',title:'Rotate PDF',description:'Rotate all pages of a PDF',kind:'pdf',icon:'🔄'},
{slug:'extract-pdf',title:'Extract PDF pages',description:'Create a PDF from selected pages',kind:'pdf',icon:'📄'},
{slug:'resize-image',title:'Resize image',description:'Resize by width and height',kind:'image',icon:'📐'},
{slug:'convert-image',title:'Convert image',description:'Convert PNG, JPEG, and WebP',kind:'image',icon:'🖼️'},
{slug:'compress-image',title:'Compress image',description:'Reduce JPEG or WebP size',kind:'image',icon:'🗜️'},
{slug:'crop-image',title:'Crop image',description:'Crop by pixel coordinates',kind:'image',icon:'✂️'},
{slug:'qr-code',title:'QR generator',description:'Make a QR code from text or a URL',kind:'developer',icon:'▦'},
{slug:'json-formatter',title:'JSON formatter',description:'Validate and pretty-print JSON',kind:'developer',icon:'{}'},
{slug:'base64',title:'Base64 converter',description:'Encode or decode text',kind:'developer',icon:'🔡'},
{slug:'text-case',title:'Text case converter',description:'Uppercase, lowercase, and title case',kind:'developer',icon:'Aa'}
];
export const getTool=(slug:string)=>TOOLS.find(t=>t.slug===slug);
