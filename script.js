const $ = (sel, root=document) => root.querySelector(sel);
const fmt = (t)=>{ if(!isFinite(t)||t<0) t=0; const m=Math.floor(t/60),s=Math.floor(t%60); return `${m}:${s.toString().padStart(2,'0')}`; };

const audio = $('#audio');
const btnPlay = $('#btnPlay');
const btnPause = $('#btnPause');
const btnStop = $('#btnStop');
const seek = $('#seek');
const cur = $('#cur');
const dur = $('#dur');
const lyricsEl = $('#lyrics');
const songName = $('#songName');
const folderInput = $('#folderInput');
const playlistEl = $('#playlist');
const btnExportLrc = $('#btnExportLrc');
const btnNext = $('#btnNext');
const btnPrev = $('#btnPrev');
const searchBox = $('#searchBox');

let entries = [];
let activeIndex = -1;
let playlist = [];
let currentIndex = -1;

function parseLRC(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  for(const raw of lines){
    if(!raw.trim()) continue;
    const tagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let match; let textLine = raw.replace(tagRe, '').trim();
    if(!raw.match(tagRe)) continue;
    tagRe.lastIndex = 0;
    while((match = tagRe.exec(raw))){
      const min = parseInt(match[1]), sec = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3,'0')) : 0;
      const t = min*60 + sec + ms/1000;
      out.push({time:t, text:textLine});
    }
  }
  out.sort((a,b)=>a.time-b.time);
  return out;
}

function parseMetadata(text){
  const meta = {};
  const lines = text.split(/\r?\n/);
  for(const raw of lines){
    const match = raw.match(/^\[(ti|ar|al|by):([^\]]+)\]$/i);
    if(match){
      const key = match[1].toLowerCase();
      meta[key] = match[2].trim();
    }
  }
  return meta;
}

function renderLyrics(){
  lyricsEl.innerHTML = '';
  entries.forEach((e, i)=>{
    const row = document.createElement('div');
    row.className = 'line';
    row.dataset.index = i;
    row.innerHTML = `<div class="line-row"><span class="stamp">[${fmt(e.time)}]</span><span>${e.text||'…'}</span></div>`;
    row.addEventListener('click', ()=>{ audio.currentTime = e.time + 0.01; });
    lyricsEl.appendChild(row);
  });
  activeIndex = -1;
  btnExportLrc.disabled = entries.length===0;
}

function updateActive(time){
  if(entries.length===0) return;
  let i = activeIndex;
  if(i<0 || i>=entries.length || time < entries[i].time || (i+1<entries.length && time >= entries[i+1].time)){
    let lo=0, hi=entries.length-1, ans=0;
    while(lo<=hi){
      const mid=(lo+hi>>1);
      if(entries[mid].time<=time){ ans=mid; lo=mid+1; } else hi=mid-1;
    }
    i = ans;
  }
  if(i!==activeIndex){
    const prev = lyricsEl.querySelector('.line.active');
    if(prev) prev.classList.remove('active');
    const next = lyricsEl.querySelector(`.line[data-index="${i}"]`);
    if(next){ next.classList.add('active'); next.scrollIntoView({block:'center'}); }
    activeIndex = i;
  }
}

audio.addEventListener('timeupdate', ()=>{
  cur.textContent = fmt(audio.currentTime);
  if(audio.duration){ seek.value = (audio.currentTime / audio.duration) * 100; }
  updateActive(audio.currentTime + 0.02);
});
audio.addEventListener('loadedmetadata', ()=>{ dur.textContent = fmt(audio.duration||0); });
audio.addEventListener('ended', ()=>{ playNext(); }); // auto next

seek.addEventListener('input', ()=>{
  if(audio.duration){ audio.currentTime = (seek.value/100) * audio.duration; }
});

btnPlay.addEventListener('click', ()=> audio.play());
btnPause.addEventListener('click', ()=> audio.pause());
btnStop.addEventListener('click', ()=>{ audio.pause(); audio.currentTime = 0; });
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

// Load playlist from folder
folderInput.addEventListener("change", e => loadFolder([...e.target.files]));

function loadFolder(files){
  const map = {};
  for(const f of files){
    const base = f.name.replace(/\.[^.]+$/,'');
    if(!map[base]) map[base] = {};
    if(f.type.startsWith('audio/')) map[base].audio = f;
    else if(f.name.endsWith('.lrc')) map[base].lrc = f;
  }
  playlist = [];
  playlistEl.innerHTML = '';
  for(const [name, obj] of Object.entries(map)){
    if(obj.audio){
      const audioUrl = URL.createObjectURL(obj.audio);
      const entry = {title:name, audioUrl, lyrics:'', lrcEntries:[], meta:{}};
      playlist.push(entry);
      if(obj.lrc){
        obj.lrc.text().then(text=>{
          entry.lyrics = text;
          entry.lrcEntries = parseLRC(text);
          entry.meta = parseMetadata(text);
          if(currentIndex===playlist.indexOf(entry)) { entries = entry.lrcEntries; renderLyrics(); }
        });
      }
      const li = document.createElement('li');
      li.textContent = name;
      li.addEventListener('click', ()=> playSong(playlist.indexOf(entry)));
      playlistEl.appendChild(li);
    }
  }
}

function playSong(index){
  const song = playlist[index];
  if(!song) return;
  currentIndex = index;
  [...playlistEl.children].forEach((li,i)=> li.classList.toggle("active", i===index));
  audio.src = song.audioUrl;
  audio.load();
  audio.play();
  songName.textContent = song.title;
  entries = song.lrcEntries;
  renderLyrics();
}

function playNext(){
  if(playlist.length === 0) return;
  let nextIndex = (currentIndex + 1) % playlist.length;
  playSong(nextIndex);
}

function playPrev(){
  if(playlist.length === 0) return;
  let prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  playSong(prevIndex);
}

// Export LRC
btnExportLrc.addEventListener('click', ()=>{
  if(currentIndex<0 || !playlist[currentIndex].lrcEntries.length) return;
  const song = playlist[currentIndex];
  const header = ['[ti:'+song.title+']'];
  const body = song.lrcEntries.map(e=>{
    const m = Math.floor(e.time/60);
    const s = Math.floor(e.time%60).toString().padStart(2,'0');
    const ms = Math.floor((e.time%1)*100).toString().padStart(2,'0');
    return `[${m}:${s}.${ms}] ${e.text}`;
  });
  const blob = new Blob([header.concat(body).join('\n')], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = song.title+'.lrc';
  a.click();
});

// Smart Search
function filterPlaylist(query){
  query = query.toLowerCase().trim();
  const items = playlistEl.children;

  for(let i=0;i<playlist.length;i++){
    const entry = playlist[i];
    const li = items[i];
    let show = true;

    if(query){
      if(query.startsWith("artist:")){
        const val = query.replace("artist:","").trim();
        show = entry.meta.ar && entry.meta.ar.toLowerCase().includes(val);
      } else if(query.startsWith("album:")){
        const val = query.replace("album:","").trim();
        show = entry.meta.al && entry.meta.al.toLowerCase().includes(val);
      } else if(query.startsWith("title:")){
        const val = query.replace("title:","").trim();
        show = entry.title.toLowerCase().includes(val);
      } else {
        show =
          entry.title.toLowerCase().includes(query) ||
          (entry.meta.ar && entry.meta.ar.toLowerCase().includes(query)) ||
          (entry.meta.al && entry.meta.al.toLowerCase().includes(query));
      }
    }

    li.style.display = show ? "block" : "none";
  }
}

searchBox.addEventListener("input", e=>{
  filterPlaylist(e.target.value);
});

// Keyboard helpers
window.addEventListener('keydown', (e)=>{
  if(e.code==='Space'){ e.preventDefault(); if(audio.paused) audio.play(); else audio.pause(); }
  if(e.code==='ArrowRight'){ audio.currentTime = Math.min((audio.currentTime||0)+5, audio.duration||0); }
  if(e.code==='ArrowLeft'){ audio.currentTime = Math.max((audio.currentTime||0)-5, 0); }
});
