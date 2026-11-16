/*
 * Little by Little — optional Firebase sync layer.
 * Local app remains usable if this is not configured or the service is offline.
 * Cloud data is divided into month documents to avoid a lifetime-sized single document.
 * Same-month edits from multiple active devices are last-write-wins: avoid concurrent editing.
 * Do not use Firebase service-account credentials in client-side code.
 */
import {firebaseConfig} from './firebase-config.js';

const appUI = window.LittleByLittle;
const SDK = '13.3.0'; // Firebase web SDK version in official CDN documentation at build time
const SYNC_PENDING = 'lbl-cloud-unsynced-uid-v1';
const ACTIVE_ACCOUNT = 'lbl-cloud-last-account-v1';
const $ = (s) => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const clone = v => JSON.parse(JSON.stringify(v));
const same = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validMonth = k => /^\d{4}-(0[1-9]|1[0-2])$/.test(k);
const actualBudget = d => appUI?.hasBudget?.(d);
const state = {mode:'starting',user:null,busy:false,message:'',error:'',authMode:'signin',savedAt:null};
let auth,db,firebase,watchers=[],lastSynced=null,cloudData=null,saveTimer=null,saving=false,needsSave=false;
let observedProfile=null,observedMonths=null,profileReady=false,monthsReady=false;

function status(){
 const el=$('#sync-status');if(!el)return;
 const labels={setup:'☁ Cloud setup needed',starting:'☁ Checking cloud…',signedout:'☁ Not signed in',loading:'☁ Loading your budget…',choose:'☁ Choose your starting data',ready:'☁ Connected & synced',saving:'☁ Saving your changes…',offline:'☁ Offline — saved on device',error:'☁ Sync needs attention'};
 el.textContent=labels[state.mode]||'☁ Cloud unavailable';
 el.className='sync-status '+(state.mode==='ready'?'good':(['error','offline','choose'].includes(state.mode)?'warn':''));
}
function note(msg,cls=''){return `<div class="cloud-message ${cls}">${esc(msg)}</div>`}
function renderCloud(){
 status(); const panel=$('#cloud-panel'); if(!panel)return;
 const local=appUI?.getData?.();
 let html='';
 if(state.mode==='setup'){
   html=note('The cloud app code is ready, but it has not been connected to your free Firebase project yet.')+
    '<p>Follow <strong>START_HERE.md</strong> in your downloaded folder: create a free Firebase project, turn on Email/Password login and Firestore, then paste your Firebase web configuration into <code>public/firebase-config.js</code>. After publishing, return here to sign in.</p>'+
    '<p class="hint">You can keep using the monthly planner in this browser while you set up syncing.</p>';
 }else if(state.mode==='starting'||state.mode==='loading'){
   html=note('Connecting to your budget. Your local copy is still on this device.');
 }else if(state.mode==='signedout'){
   const signup=state.authMode==='signup';
   html=`<p>Your budget can follow you between Chrome, Edge, your laptop, and your phone. Sign in with the same account on each device.</p>
      <form class="cloud-form" id="cloud-auth-form">
        <div><label for="cloud-email">Email</label><input id="cloud-email" autocomplete="email" type="email" required placeholder="you@example.com"></div>
        <div><label for="cloud-password">Password</label><input id="cloud-password" autocomplete="${signup?'new-password':'current-password'}" type="password" minlength="8" required placeholder="8+ characters"></div>
        ${signup?'<div><label for="cloud-confirm">Confirm password</label><input id="cloud-confirm" type="password" autocomplete="new-password" minlength="8" required></div>':''}
        <button class="btn primary" type="submit" ${state.busy?'disabled':''}>${state.busy?'Working…':signup?'Create my account':'Sign in'}</button>
      </form>
      <div class="actions" style="margin-top:13px"><button class="btn small" type="button" data-cloud-action="toggle-auth">${signup?'I already have an account':'Create an account'}</button><button class="btn small ghost" type="button" data-cloud-action="forgot">Forgot password?</button></div>
      <p class="hint">Use a strong, unique password. Little by Little never needs your bank password or banking login.</p>`;
 }else if(state.mode==='choose'){
   const r=cloudData||{};
   const cloudCount=(r.transactions||[]).length;
   const localCount=(local?.transactions||[]).length;
   html=`${note(state.message||'Both this browser and your cloud account have budget information. Pick which copy to start with.')}
     <div class="cloud-choice">
       <div><strong>☁ Use my cloud budget</strong><p>${cloudCount} logged transactions online. This is usually best if you already use Little by Little on another device.</p><button class="btn primary" data-cloud-action="use-cloud">Use cloud copy</button></div>
       <div><strong>💻 Use this device's budget</strong><p>${localCount} logged transactions on this device. This will replace the online copy after you confirm.</p><button class="btn" data-cloud-action="use-local">Upload device copy</button></div>
     </div><p class="hint">Before replacing either copy, download a JSON backup from Help & backup.</p>`;
 }else if(state.mode==='ready'||state.mode==='saving'){
   html=`${note(state.mode==='saving'?'Your latest changes are being uploaded.':'Your private budget is connected and saved in the cloud.','ok')}
       <div class="splitline"><span>Signed in as</span><b>${esc(state.user?.email||'Your account')}</b></div>
       <div class="splitline"><span>Last confirmed cloud save</span><b>${state.savedAt?esc(new Date(state.savedAt).toLocaleString()):'Connected'}</b></div>
       <p class="hint">The app also saves a local copy on this device. When you make a change, check the Cloud status before closing. Avoid editing the same month on two devices simultaneously.</p>
       <div class="actions" style="margin-top:16px"><button class="btn sage" data-cloud-action="sync-now">Sync now</button><button class="btn" data-nav="settings">Download backup</button><button class="btn ghost" data-cloud-action="sign-out">Sign out</button></div>`;
 }else if(state.mode==='offline'||state.mode==='error'){
   html=note(state.error||'Unable to reach your cloud budget. Your edits stay on this device until sync succeeds. Save a backup for safety.','error')+
   `<p class="hint">${state.user?'Signed in as '+esc(state.user.email):'Not signed in'} · Internet access is needed for syncing, not for your local budget.</p>`+
   `<div class="actions"><button class="btn primary" data-cloud-action="retry">Try again</button><button class="btn" data-nav="settings">Download backup</button>${state.user?'<button class="btn ghost" data-cloud-action="sign-out">Sign out</button>':''}</div>`;
 }else html=note('Cloud tools could not load. You can continue using the local app.','error');
 if(state.message&&state.mode==='ready')html+=note(state.message,'ok');
 panel.innerHTML=html;
}
function setMode(mode, msg='', error=''){state.mode=mode;state.message=msg;state.error=error;renderCloud();}
function profilePart(d){return {version:1,createdAt:d.createdAt||new Date().toISOString(),firstMonth:d.firstMonth||new Date().toISOString().slice(0,7),goals:d.goals||{},customCategories:d.customCategories||[],categoryVisibility:d.categoryVisibility||{},pots:d.pots||[],potPayments:d.potPayments||[],payday:d.payday||{amount:0,referenceDate:''},chequing:d.chequing||{openingBalance:null,openingDate:'',budgetMonth:'',usableOpening:0}}}
function parts(d){
 const profile=profilePart(d);const months={};
 for(const [key,budget] of Object.entries(d.months||{}))if(validMonth(key))months[key]={budget:clone(budget),transactions:[],incomeEntries:[]};
 for(const t of d.transactions||[]){const key=String(t.date||'').slice(0,7);if(!validMonth(key))continue;
   if(!months[key])months[key]={budget:{income:0,planned:{},roll:{},review:{tfsa:0,fhsa:0,emergency:0,next:0},reviewed:false,notes:''},transactions:[],incomeEntries:[]};
   months[key].transactions.push(clone(t));
 }
 for(const t of d.incomeEntries||[]){const key=String(t.date||'').slice(0,7);if(!validMonth(key))continue;
   if(!months[key])months[key]={budget:{income:0,planned:{},roll:{},review:{tfsa:0,fhsa:0,emergency:0,next:0},reviewed:false,notes:''},transactions:[],incomeEntries:[]};
   months[key].incomeEntries.push(clone(t));
 }
 for(const m of Object.values(months)){m.incomeEntries.sort((a,b)=>String(a.id).localeCompare(String(b.id)));}
 for(const m of Object.values(months))m.transactions.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 return {profile,months};
}
function fromParts(profile,months){
 const p=profile||{};
 const out={version:1,createdAt:p.createdAt||new Date().toISOString(),firstMonth:p.firstMonth||new Date().toISOString().slice(0,7),goals:p.goals||{},customCategories:p.customCategories||[],categoryVisibility:p.categoryVisibility||{},pots:p.pots||[],potPayments:p.potPayments||[],payday:p.payday||{amount:0,referenceDate:''},chequing:p.chequing||{openingBalance:null,openingDate:'',budgetMonth:'',usableOpening:0},months:{},transactions:[],incomeEntries:[]};
 for(const [k,m] of Object.entries(months||{})){if(!validMonth(k))continue;out.months[k]=clone(m.budget||{});for(const t of m.transactions||[])out.transactions.push(clone(t));for(const t of m.incomeEntries||[])out.incomeEntries.push(clone(t));}
 out.transactions.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
 out.incomeEntries.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
 return out;
}
function getObservedData(){if(!profileReady||!monthsReady)return null;return fromParts(observedProfile,observedMonths)}
function stopWatch(){for(const fn of watchers){try{fn()}catch(e){}}watchers=[];profileReady=false;monthsReady=false;observedProfile=null;observedMonths=null;}
function resetSaveState(){clearTimeout(saveTimer);saveTimer=null;needsSave=false;saving=false;lastSynced=null;stopWatch();}
function storeRefs(uid){return {profile:firebase.doc(db,'users',uid,'settings','main'),months:firebase.collection(db,'users',uid,'months')}}
async function readCloud(uid){
 const r=storeRefs(uid),[p,m]=await Promise.all([firebase.getDoc(r.profile),firebase.getDocs(r.months)]);
 const months={};m.forEach(doc=>{months[doc.id]=doc.data()});
 return {exists:p.exists()||!m.empty,data:fromParts(p.exists()?p.data():null,months),part:{profile:p.exists()?p.data():null,months}};
}
function attachWatch(uid){
 stopWatch();const refs=storeRefs(uid);
 const fail=e=>{state.error='Sync interrupted: '+(e?.message||'unknown error')+'. Your local copy is still saved.';state.mode='error';renderCloud();};
 watchers.push(firebase.onSnapshot(refs.profile,s=>{observedProfile=s.exists()?s.data():null;profileReady=true;remoteUpdated();},fail));
 watchers.push(firebase.onSnapshot(refs.months,s=>{const m={};s.forEach(doc=>m[doc.id]=doc.data());observedMonths=m;monthsReady=true;remoteUpdated();},fail));
}
function remoteUpdated(){
 if(state.mode!=='ready'||saving||needsSave||localStorage.getItem(SYNC_PENDING)===state.user?.uid)return;
 const incoming=getObservedData();if(!incoming)return;
 const incomingParts=parts(incoming);
 const local=appUI.getData();
 if(!same(parts(local),incomingParts)){
   appUI.replaceData(incoming);lastSynced=incomingParts;
   state.savedAt=new Date().toISOString();renderCloud();
 }
}
function markDirty(){
 if(!state.user)return;
 try{localStorage.setItem(SYNC_PENDING,state.user.uid)}catch(e){}
 if(state.mode==='ready'||state.mode==='saving')scheduleSave();
 else if(state.mode==='offline')renderCloud();
}
function scheduleSave(){
 needsSave=true;
 if(state.mode==='ready')setMode('saving');
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),600);
}
async function flush(){
 if(!state.user||saving||!needsSave||!['ready','saving'].includes(state.mode))return;
 saving=true;const uid=state.user.uid;
 try{
   while(needsSave){
     needsSave=false;
     const target=parts(appUI.getData());
     const old=lastSynced||{profile:null,months:{}};
     let changes=[];
     const pRef=storeRefs(uid).profile;
     if(!same(target.profile,old.profile))changes.push({ref:pRef,data:target.profile});
     const names=new Set([...Object.keys(old.months||{}),...Object.keys(target.months||{})]);
     for(const k of names){const oldM=old.months?.[k],newM=target.months?.[k];
       if(same(oldM,newM))continue;
       changes.push({ref:firebase.doc(db,'users',uid,'months',k),data:newM??null});
     }
     // Firestore permits up to 500 writes per batch. Use a conservative batch size.
     for(let i=0;i<changes.length;i+=400){
       const batch=firebase.writeBatch(db);
       for(const op of changes.slice(i,i+400)){
         if(op.data===null)batch.delete(op.ref);
         else batch.set(op.ref,{...op.data,updatedAt:firebase.serverTimestamp()});
       }
       await batch.commit();
     }
     lastSynced=target;
     state.savedAt=new Date().toISOString();
   }
   if(!needsSave){try{localStorage.removeItem(SYNC_PENDING)}catch(e){};setMode('ready');}
 }catch(e){
   needsSave=true;
   setMode('error','',`Couldn't sync to Firebase: ${e?.message||e}. Your data is still saved in this browser. Download a backup and try again.`);
 }finally{saving=false;}
}
function connectedFromCloud(d){
 appUI.replaceData(d);lastSynced=parts(d);
 try{localStorage.setItem(ACTIVE_ACCOUNT,state.user.uid);localStorage.removeItem(SYNC_PENDING)}catch(e){}
 state.savedAt=new Date().toISOString();setMode('ready');attachWatch(state.user.uid);
}
function uploadFromBrowser(replace=false){
 if(!state.user)return;
 if(replace && !confirm('Replace the CLOUD budget (including its monthly history) with this device\'s budget? Download a backup of your cloud data first if you may want it later.'))return;
 lastSynced=parts(cloudData||fromParts(null,{}));
 try{localStorage.setItem(ACTIVE_ACCOUNT,state.user.uid)}catch(e){}
 setMode('ready');attachWatch(state.user.uid);markDirty();
}
async function loadAccount(u){
 resetSaveState();state.user=u;setMode('loading');
 try{
   const remote=await readCloud(u.uid);cloudData=remote.data;
   const local=appUI.getData();
   const hasLocal=!!actualBudget(local);
   const hadPending=localStorage.getItem(SYNC_PENDING)===u.uid;
   const remembered=localStorage.getItem(ACTIVE_ACCOUNT)===u.uid;
   if(!remote.exists){
     if(hasLocal && (!remembered||hadPending)){
       setMode('choose','There is no cloud budget yet. You can upload the budget on this device, or use the empty cloud budget.');
     }else if(hadPending&&hasLocal){
       setMode('choose','This device has unsynced changes. Choose which version to keep.');
     }else if(remembered){
       // Other device might have cleared cloud: never silently resurrect old data.
       connectedFromCloud(remote.data);
     }else{uploadFromBrowser(false);}
   }else if(hadPending){setMode('choose','This device has changes that may not have reached the cloud. Choose which copy to keep.');}
   else if(hasLocal&&!remembered&&!same(parts(local),parts(remote.data))){
     setMode('choose','Both your device and cloud account contain a budget. Choose which copy you want to use.');
   }else connectedFromCloud(remote.data);
 }catch(e){
   setMode('offline','',`Cloud could not be loaded: ${e?.message||e}. You can still use your local budget. Check your internet connection and Firebase setup.`);
 }
}
async function connect(){
 const cfg=firebaseConfig||{};
 if(!cfg.apiKey||!cfg.projectId||!cfg.appId||String(cfg.apiKey).includes('PASTE_')||String(cfg.projectId).includes('YOUR_PROJECT')){
   setMode('setup');return;
 }
 try{
   const [appMod,authMod,dbMod]=await Promise.all([
     import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
     import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
     import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`)
   ]);
   firebase={...appMod,...authMod,...dbMod};
   const app=firebase.initializeApp(cfg);
   auth=firebase.getAuth(app);db=firebase.getFirestore(app);
   firebase.onAuthStateChanged(auth,u=>{
     if(!u){resetSaveState();state.user=null;setMode('signedout');return;}
     void loadAccount(u);
   },e=>setMode('error','',`Login error: ${e.message}`));
 }catch(e){setMode('error','',`Firebase libraries could not load: ${e.message}. Your local budget still works.`);}
}
window.addEventListener('lbl:local-change',markDirty);
window.addEventListener('lbl:render',renderCloud);
window.addEventListener('online',()=>{if(state.user&&['offline','error'].includes(state.mode))void loadAccount(state.user)});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='cloud-auth-form')return;
 e.preventDefault();if(!auth||state.busy)return;
 const email=$('#cloud-email')?.value.trim(),password=$('#cloud-password')?.value,confirmPass=$('#cloud-confirm')?.value;
 if(state.authMode==='signup'&&password!==confirmPass){alert('Passwords do not match.');return;}
 state.busy=true;renderCloud();
 try{
   if(state.authMode==='signup')await firebase.createUserWithEmailAndPassword(auth,email,password);
   else await firebase.signInWithEmailAndPassword(auth,email,password);
 }catch(e){setMode('signedout');alert(`Could not ${state.authMode==='signup'?'create an account':'sign in'}: ${e.message}`);}
 finally{state.busy=false;renderCloud();}
});
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-cloud-action]');if(!btn)return;
 const a=btn.dataset.cloudAction;
 if(a==='toggle-auth'){state.authMode=state.authMode==='signin'?'signup':'signin';renderCloud();return;}
 if(a==='forgot'){
   if(!auth)return;
   const email=prompt('Enter the email address for your Little by Little account.');
   if(!email)return;
   try{await firebase.sendPasswordResetEmail(auth,email.trim());alert('If the address is registered, a password reset email will be sent.');}
   catch(err){alert('Could not request password reset: '+err.message);}return;
 }
 if(a==='use-cloud'){connectedFromCloud(cloudData);return;}
 if(a==='use-local'){uploadFromBrowser(true);return;}
 if(a==='sync-now'){
   if(!state.user)return;markDirty();await flush();return;
 }
 if(a==='retry'){if(state.user)await loadAccount(state.user);else await connect();return;}
 if(a==='sign-out'){
   if(!auth)return;
   const pending=localStorage.getItem(SYNC_PENDING)===state.user?.uid||needsSave;
   if(pending&&!confirm('Some changes may not have synced. Download a backup before signing out. Continue anyway?'))return;
   try{
     clearTimeout(saveTimer);if(!pending&&needsSave)await flush();
     await firebase.signOut(auth);
     try{localStorage.removeItem(ACTIVE_ACCOUNT);localStorage.removeItem(SYNC_PENDING)}catch(e){}
     appUI.clearLocal();
     setMode('signedout','Signed out. The budget on this device was cleared; your online copy is kept.');
   }catch(err){alert('Sign-out error: '+err.message);}
 }
});

if('serviceWorker' in navigator&&location.protocol==='https:'){
 window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline shell not installed',e))});
}
connect();
