const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('raster logo is downscaled to at most 400px and GIF is preserved', async () => {
  const src = fs.readFileSync('pharmacy-branding.js','utf8');
  const start = src.indexOf('    async function processLogoFile(file)');
  const end = src.indexOf('    global.EPharmaBranding = {', start);
  const canvas = {width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/webp;base64,YQ=='};
  class ImageMock { constructor(){this.naturalWidth=1600;this.naturalHeight=800} set src(value){this.onload()} }
  const context={document:{createElement:()=>canvas},Image:ImageMock,readFileAsDataUrl:async()=> 'data:image/gif;base64,YQ==',atob: s=>Buffer.from(s,'base64').toString(),Promise,Math,Error};
  vm.createContext(context);vm.runInContext(src.slice(start,end),context);
  const result=await context.processLogoFile({type:'image/png',size:1000000});
  assert.match(result,/^data:image\/webp/);assert.equal(canvas.width,400);assert.equal(canvas.height,200);assert.ok(result.length<150*1024);
  const gif=await context.processLogoFile({type:'image/gif',size:1000000});assert.equal(gif,'data:image/gif;base64,YQ==');
  await assert.rejects(context.processLogoFile({type:'image/png',size:6*1024*1024}),/5 MB/);
});

test('profile photo is cropped square and rejects unsupported types', async () => {
  const src=fs.readFileSync('pharmacy-branding.js','utf8');
  const start=src.indexOf('    async function processAvatarFile(file)');
  const end=src.indexOf('    global.EPharmaBranding = {',start);
  let args; const canvas={width:0,height:0,getContext:()=>({drawImage(...a){args=a}}),toDataURL:()=> 'data:image/webp;base64,YQ=='};
  class ImageMock { constructor(){this.naturalWidth=800;this.naturalHeight=400} set src(value){this.onload()} }
  const context={document:{createElement:()=>canvas},Image:ImageMock,readFileAsDataUrl:async()=> 'data:image/png;base64,YQ==',Promise,Math,Error};
  vm.createContext(context); vm.runInContext(src.slice(start,end),context);
  assert.match(await context.processAvatarFile({type:'image/png',size:1000}),/^data:image\/webp/);
  assert.equal(canvas.width,256); assert.equal(canvas.height,256); assert.deepEqual(args.slice(1,5),[200,0,400,400]);
  await assert.rejects(context.processAvatarFile({type:'image/svg+xml',size:100}),/PNG, JPG or WebP/);
});
