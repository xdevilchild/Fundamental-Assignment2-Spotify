const $ = (sel, root=document) => root.querySelector(sel);
const fmt = (t)=>{ if(!isFinite(t)||t<0) t=0; const m=Math.floor(t/60),s=Math.floor(t%60); return `${m}:${s.toString().padStart(2,'0')}`; };

/* ---------- MUSIC REFERENCES ---------- */
const audio = $('#audioMusic');
const btnPlay = $('#btnPlay');
const btnPause = $('#btnPause');
const btnStop = $('#btnStop');
const btnNext = $('#btnNext');
const btnPrev = $('#btnPrev');
const seek = $('#seek');
const cur = $('#cur');
const dur = $('#dur');
const lyricsEl = $('#lyrics');
const songName = $('#songName');
const folderInput = $('#folderInput');
const playlistEl = $('#playlist');
const btnExportLrc = $('#btnExportLrc');
const searchBox = $('#searchBox');

/* ---------- PODCAST REFERENCES ---------- */
const audioPodcast = $('#audioPodcast');
const podcastFolder = $('#podcastFolder');
const podcastList = $('#podcastList');
const btnPodcastPlay = $('#btnPodcastPlay');
const btnPodcastPause = $('#btnPodcastPause');
const btnPodcastStop = $('#btnPodcastStop');
const btnPodcastNext = $('#btnPodcastNext');
const btnPodcastPrev = $('#btnPodcastPrev');
const podcastName = $('#podcastName');
const podSeek = $('#podSeek');
const podCur = $('#podCur');
const podDur = $('#podDur');

/* ---------- STATE ---------- */
let playlist = [], currentIndex = -1, entries = [], activeIndex = -1;
let podcasts = [], currentPodcastIndex = -1;

/* ---------- MUSIC FUNCTIONS ---------- */
folderInput.addEventListener("change", e => loadMusic([...e.target.files]));

function loadMusic(files){
  playlist = [];
  playlistEl.innerHTML = '';

  const audioFiles = files.filter(f => f.type.startsWith("audio/"));
  const lrcFiles = files.filter(f => f.name.toLowerCase().endsWith(".lrc"));

  if(audioFiles.length === 0){
    playlistEl.innerHTML = "<li class='hint'>No music loaded</li>";
    return;
  }

  audioFiles.forEach(f=>{
    const url = URL.createObjectURL(f);
    const entry = { title: f.name.replace(/\.[^.]+$/,''), audioUrl: url, lrcText: null };

    const match = lrcFiles.find(l => l.name.replace(/\.[^.]+$/,'') === entry.title);
    if(match){ match.text().then(text => entry.lrcText = text); }

    playlist.push(entry);

    const li = document.createElement('li');
    li.textContent = entry.title;
    li.addEventListener('click', ()=> playSong(playlist.indexOf(entry)));
    playlistEl.appendChild(li);
  });
}

function playSong(index){
  if(playlist.length === 0) return;
  currentIndex = index;
  [...playlistEl.children].forEach((li,i)=> li.classList.toggle("active", i===index));

  const song = playlist[index];
  audio.src = song.audioUrl;
  audio.load();
  audio.play();
  songName.textContent = song.title;

  if(song.lrcText){
    loadLyrics(song.lrcText);
    btnExportLrc.disabled = false;
  } else {
    lyricsEl.innerHTML = "<div class='hint'>No lyrics available</div>";
    entries = [];
    btnExportLrc.disabled = true;
  }
}

function playNext(){ if(playlist.length) playSong((currentIndex + 1) % playlist.length); }
function playPrev(){ if(playlist.length) playSong((currentIndex - 1 + playlist.length) % playlist.length); }

/* ---------- MUSIC CONTROLS ---------- */
btnPlay.addEventListener('click', ()=> audio.play());
btnPause.addEventListener('click', ()=> audio.pause());
btnStop.addEventListener('click', ()=>{ audio.pause(); audio.currentTime = 0; });
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

document.querySelectorAll("button").forEach(btn => {
  if(btn.id !== "btnPlay" && btn.id !== "btnPodcastPlay"){
    btn.addEventListener("click", () => {
      btn.classList.add("clicked");
      setTimeout(() => btn.classList.remove("clicked"), 200);
    });
  }
});

/* ---------- MUSIC TIMEBAR ---------- */
audio.addEventListener('timeupdate', ()=>{
  cur.textContent = fmt(audio.currentTime);
  if(audio.duration){ seek.value = (audio.currentTime / audio.duration) * 100; }
  updateActive(audio.currentTime + 0.02);
});
audio.addEventListener('loadedmetadata', ()=> { dur.textContent = fmt(audio.duration || 0); });
audio.addEventListener('ended', ()=> playNext());

seek.addEventListener('input', ()=>{ if(audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });

/* ---------- LYRICS FUNCTIONS ---------- */
function loadLyrics(text){
  entries = parseLRC(text);
  renderLyrics();
}

function parseLRC(text){
  const lines = text.split(/\r?\n/); const out = [];
  for(const raw of lines){
    if(!raw.trim()) continue;
    const tagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let match; let lyric = raw.replace(tagRe, '').trim();
    while((match = tagRe.exec(raw))){
      const min = parseInt(match[1]), sec = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3,'0')) : 0;
      const t = min*60 + sec + ms/1000;
      out.push({time:t, text:lyric});
    }
  }
  return out.sort((a,b)=>a.time-b.time);
}

function renderLyrics(){
  lyricsEl.innerHTML = '';
  entries.forEach((e,i)=>{
    const row = document.createElement('div');
    row.className = 'line'; row.dataset.index = i;
    row.innerHTML = `<div class="line-row"><span class="stamp">[${fmt(e.time)}]</span><span>${e.text}</span></div>`;
    row.addEventListener('click', ()=>{ audio.currentTime = e.time + 0.01; });
    lyricsEl.appendChild(row);
  });
  activeIndex = -1;
}

function updateActive(time){
  if(entries.length===0) return;
  let i = activeIndex;
  if(i<0 || i>=entries.length || time < entries[i].time || (i+1<entries.length && time >= entries[i+1].time)){
    let lo=0, hi=entries.length-1, ans=0;
    while(lo<=hi){ const mid=(lo+hi>>1); if(entries[mid].time<=time){ ans=mid; lo=mid+1; } else hi=mid-1; }
    i = ans;
  }
  if(i!==activeIndex){
    const prev = lyricsEl.querySelector('.line.active'); if(prev) prev.classList.remove('active');
    const next = lyricsEl.querySelector(`.line[data-index="${i}"]`);
    if(next){ next.classList.add('active'); next.scrollIntoView({block:'center'}); }
    activeIndex = i;
  }
}

/* ---------- EXPORT LRC ---------- */
btnExportLrc.addEventListener('click', ()=>{
  if(!entries.length) return;
  const header = ['[ti:'+ (playlist[currentIndex]?.title || 'Unknown') +']'];
  const body = entries.map(e=>{
    const m = Math.floor(e.time/60), s = Math.floor(e.time%60).toString().padStart(2,'0');
    const ms = Math.floor((e.time%1)*100).toString().padStart(2,'0');
    return `[${m}:${s}.${ms}] ${e.text}`.trim();
  });
  const blob = new Blob([header.concat(body).join('\n')], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (playlist[currentIndex]?.title || 'lyrics')+'.lrc'; a.click();
});

/* ---------- SEARCH ---------- */
function filterPlaylist(query){
  query = query.toLowerCase().trim(); const items = playlistEl.children;
  for(let i=0;i<playlist.length;i++){
    const entry = playlist[i]; const li = items[i]; let show = true;
    if(query){ show = entry.title.toLowerCase().includes(query); }
    li.style.display = show ? "block" : "none";
  }
}
searchBox.addEventListener("input", e=> filterPlaylist(e.target.value));

/* ---------- PODCAST ---------- */
podcastFolder.addEventListener("change", e => loadPodcasts([...e.target.files]));

function loadPodcasts(files){
  podcasts = []; podcastList.innerHTML = '';
  const audioFiles = files.filter(f=>f.type.startsWith("audio/"));
  if(audioFiles.length === 0){
    podcastList.innerHTML = "<li class='hint'>No podcasts loaded</li>";
    return;
  }
  audioFiles.forEach(f=>{
    const url = URL.createObjectURL(f);
    const entry = {title:f.name.replace(/\.[^.]+$/,''), audioUrl:url};
    podcasts.push(entry);
    const li = document.createElement('li'); li.textContent = entry.title;
    li.addEventListener('click', ()=> playPodcast(podcasts.indexOf(entry)));
    podcastList.appendChild(li);
  });
}

function playPodcast(index){
  if(podcasts.length === 0) return;
  currentPodcastIndex = index;
  [...podcastList.children].forEach((li,i)=> li.classList.toggle("active", i===index));
  audioPodcast.src = podcasts[index].audioUrl;
  audioPodcast.load(); audioPodcast.play();
  podcastName.textContent = podcasts[index].title;
}

function playNextPodcast(){ if(podcasts.length) playPodcast((currentPodcastIndex + 1) % podcasts.length); }
function playPrevPodcast(){ if(podcasts.length) playPodcast((currentPodcastIndex - 1 + podcasts.length) % podcasts.length); }

btnPodcastPlay.addEventListener('click', ()=> audioPodcast.play());
btnPodcastPause.addEventListener('click', ()=> audioPodcast.pause());
btnPodcastStop.addEventListener('click', ()=>{ audioPodcast.pause(); audioPodcast.currentTime = 0; });
btnPodcastNext.addEventListener('click', playNextPodcast);
btnPodcastPrev.addEventListener('click', playPrevPodcast);

audioPodcast.addEventListener('timeupdate', ()=>{
  podCur.textContent = fmt(audioPodcast.currentTime);
  if(audioPodcast.duration) podSeek.value = (audioPodcast.currentTime / audioPodcast.duration) * 100;
});
audioPodcast.addEventListener('loadedmetadata', ()=> { podDur.textContent = fmt(audioPodcast.duration || 0); });
audioPodcast.addEventListener('ended', ()=> playNextPodcast());

podSeek.addEventListener('input', ()=>{ if(audioPodcast.duration) audioPodcast.currentTime = (podSeek.value / 100) * audioPodcast.duration; });

/* ---------- THEME TOGGLE ---------- */
const themeBtn = document.getElementById("themeToggle");
if(localStorage.getItem("theme") === "day"){
  document.documentElement.setAttribute("data-theme", "day");
  themeBtn.textContent = "☀️";
}
themeBtn.addEventListener("click", ()=>{
  const root = document.documentElement;
  if(root.getAttribute("data-theme") === "day"){
    root.removeAttribute("data-theme"); themeBtn.textContent = "🌙"; localStorage.setItem("theme","night");
  } else {
    root.setAttribute("data-theme", "day"); themeBtn.textContent = "☀️"; localStorage.setItem("theme","day");
  }
});

/* ---------- KEYBOARD SHORTCUTS ---------- */
window.addEventListener("keydown", e=>{
  if(e.target.tagName === "INPUT") return;
  if(e.code === "Space"){ e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  if(e.code === "ArrowRight"){ audio.currentTime += 5; }
  if(e.code === "ArrowLeft"){ audio.currentTime -= 5; }
  if(e.code === "ArrowUp"){ audio.volume = Math.min(1, audio.volume + 0.1); }
  if(e.code === "ArrowDown"){ audio.volume = Math.max(0, audio.volume - 0.1); }
});
