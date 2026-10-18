const CACHE='forma-v9-auto-cloud';
const AUDIO_CACHE='forma-lesson-audio-v1';
const ASSETS=['./cloud-bootstrap.js?v=2.2.1','./training-update.css?v=2.2.1','./progression.js?v=2.2.1','./action-cards.js?v=2.2.1','./practice-view.js?v=2.2.1','./','./index.html','./styles.css?v=2.2.1','./portal.css?v=2.2.1','./lesson-plan.css?v=2.2.1','./lesson-plan.js?v=2.2.1','./lesson-plan-view.js?v=2.2.1','./app.js?v=2.2.1','./core.js?v=2.2.1','./cloud.js?v=2.2.1','./cloud-config.js?v=2.2.1','./cloud-sync.js?v=2.2.1','./cloud-view.js?v=2.2.1','./english-core.js?v=2.2.1','./english-ui.js?v=2.2.1','./lessons.js?v=2.2.1','./audio-manifest.js?v=2.2.1','./portal-view.js?v=2.2.1','./vendor/supabase.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('forma-')&&key!==CACHE&&key!==AUDIO_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function audioResponse(request){
  const cache=await caches.open(AUDIO_CACHE),cached=await cache.match(request.url);
  if(!cached){const response=await fetch(request);if(response.status===200)await cache.put(request.url,response.clone());return response;}
  const range=request.headers.get('range');if(!range)return cached;
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match)return cached;
  const buffer=await cached.arrayBuffer(),size=buffer.byteLength;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
  if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(buffer.slice(start,end+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith(new URL('./audio/',self.location).pathname)){event.respondWith(audioResponse(event.request));return;}
  if(event.request.mode!=='navigate'&&!/\.(?:html|js|css|png|svg|webmanifest)$/.test(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
