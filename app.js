(() => {
  const D = window.GATHER_DATA, foods = window.GATHER_FOODS || [], availableNutrients=new Set(window.GATHER_FOOD_NUTRIENTS||[]);
  const $ = s => document.querySelector(s);
  const inputs = { age:$('#age'), sex:$('#dri-sex'), stage:$('#life-stage'), detail:$('#stage-detail') };
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const blankDay=()=>({breakfast:[],lunch:[],dinner:[]});
  const state = { profile:{}, plans:{}, day:new Date() };
  let category='All', visibleCount=60;
  const foodIds=new Set(foods.map(f=>String(f.id)));
  const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dayKey(new Date(`${s}T12:00:00`))===s;
  const newItemId=()=>`item-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  function cleanEntries(value){
    if(!Array.isArray(value))return[];
    return value.filter(x=>x&&typeof x==='object'&&foodIds.has(String(x.id))).map(x=>{
      const amount=Number(x.qty),qty=Number.isFinite(amount)?Math.max(1,Math.min(20,Math.floor(amount))):1;
      const itemId=typeof x.itemId==='string'&&/^[\w-]{1,80}$/.test(x.itemId)?x.itemId:newItemId();
      return{id:String(x.id),itemId,qty};
    });
  }
  function cleanProfile(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return{};
    const age=Number(value.age),sex=['female','male'].includes(value.sex)?value.sex:'';
    const stage=sex==='female'&&['pregnancy','lactation'].includes(value.stage)?value.stage:'';
    const details=stage==='pregnancy'?['early','late']:stage==='lactation'?['first-year','second-half']:[];
    return{age:Number.isInteger(age)&&age>=19&&age<=120?String(age):'',sex,stage,detail:details.includes(value.detail)?value.detail:''};
  }
  function cleanDay(value){
    if(Array.isArray(value))return{breakfast:cleanEntries(value),lunch:[],dinner:[]};
    if(!value||typeof value!=='object')return blankDay();
    return{breakfast:cleanEntries(value.breakfast),lunch:cleanEntries(value.lunch),dinner:cleanEntries(value.dinner)};
  }
  try {
    const saved=JSON.parse(localStorage.getItem('gather-planner')||'{}');
    state.profile=cleanProfile(saved.profile); state.day=validDay(saved.day)?new Date(`${saved.day}T12:00:00`):saved.day?new Date(saved.day):new Date();
    if(Number.isNaN(state.day.getTime()))state.day=new Date();
    // Migrate the original single-day plan once, preserving its foods on the saved date.
    if(saved.plans&&typeof saved.plans==='object'&&!Array.isArray(saved.plans))for(const [date,value] of Object.entries(saved.plans))if(validDay(date))state.plans[date]=cleanDay(value);
    if(saved.plan?.length&&!Object.keys(state.plans).length)state.plans[dayKey(state.day)]={breakfast:cleanEntries(saved.plan),lunch:[],dinner:[]};
  } catch (_) { /* Unavailable or invalid local storage starts fresh. */ }
  const plan=()=>state.plans[dayKey(state.day)]||(state.plans[dayKey(state.day)]=blankDay());
  function save(){try{localStorage.setItem('gather-planner',JSON.stringify({profile:state.profile,plans:state.plans,day:dayKey(state.day)}));}catch(_){}}
  function safe(s){const e=document.createElement('span');e.textContent=String(s??'');return e.innerHTML;}
  function foodGroup(f){const g=(f.group||'').toLowerCase(), n=f.name.toLowerCase();if(/vegetable|fruit|juice/.test(g))return'Produce';if(/grain|bread|cereal|pasta|rice/.test(g))return'Grains';if(/milk|dairy|yogurt|cheese/.test(g))return'Dairy';if(/meat|poultry|seafood|fish|egg|legume|bean|nut|seed/.test(g)||/meat|chicken|fish|egg|beans/.test(n))return'Protein';return'Other';}
  const categories=['All','Produce','Grains','Protein','Dairy','Other'];
  function renderCategories(){ $('#categories').innerHTML=categories.map(c=>`<button class="category-chip ${c===category?'active':''}" data-category="${c}" type="button" aria-pressed="${c===category}">${c}</button>`).join('');$('#categories').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;visibleCount=60;renderCategories();renderFoods();})); }
  function serving(f){return f.grams||100;}
  function amount(f,key){return ((f.values||{})[key]||0)*serving(f)/100;}
  function renderFoods(){
    const q=$('#food-search').value.trim().toLocaleLowerCase();
    const filtered=foods.filter(f=>(category==='All'||foodGroup(f)===category)&&(!q||f.name.toLocaleLowerCase().includes(q)||f.group.toLocaleLowerCase().includes(q)));
    $('#food-count').textContent=`${filtered.length.toLocaleString()} foods`;
    const shown=filtered.slice(0,visibleCount);
    $('#food-list').innerHTML=shown.length?shown.map(f=>{
      const kcal=Math.round(amount(f,'kcal'));
      const detail=['protein','carbohydrate','fat','saturatedFat','monounsaturatedFat','polyunsaturatedFat','fiber','calcium','iron','vitaminC','sodium'].filter(k=>f.values[k]!==undefined).map(k=>`${k.replace(/[A-Z]/g,m=>' '+m.toLowerCase())}: ${amount(f,k).toFixed(1)} ${k==='calcium'||k==='iron'||k==='vitaminC'||k==='sodium'?'mg':'g'}`).join(' · ')+(f.values.fat!==undefined?' · trans fat: unavailable':'');
      return `<article class="food-card"><span class="food-emoji" aria-hidden="true">${foodGroup(f)==='Produce'?'🥬':foodGroup(f)==='Grains'?'🌾':foodGroup(f)==='Dairy'?'🥛':foodGroup(f)==='Protein'?'🫘':'🍽️'}</span><div class="food-meta"><strong>${safe(f.name)}</strong><span>${safe(f.portion)} <i>·</i> ${safe(foodGroup(f))}</span><details class="food-details"><summary>Nutrition per portion</summary><small>${safe(detail||'Nutrient values unavailable')}<br>USDA FNDDS 2021–2023 · portions may vary</small></details></div><span class="food-kcal">${kcal}<small> kcal</small></span><button class="add-button" data-food="${safe(f.id)}" type="button" aria-label="Add ${safe(f.name)}">+</button></article>`;
    }).join(''):'<div class="list-empty">No foods found. Try another search or group.</div>';
    const more=filtered.length>shown.length?`<button id="show-more-foods" class="show-more" type="button">Show more (${(filtered.length-shown.length).toLocaleString()} remaining)</button>`:'';
    $('#food-list').insertAdjacentHTML('beforeend',more);
    $('#show-more-foods')?.addEventListener('click',()=>{visibleCount+=100;renderFoods();});
    $('#food-list').querySelectorAll('.add-button').forEach(b=>b.addEventListener('click',()=>{const f=foods.find(x=>String(x.id)===b.dataset.food);if(!f)return;pendingFood=f;$('#dialog-food-name').textContent=f.name;$('#meal-choice').value='breakfast';$('#meal-dialog').showModal();}));
  }
  let pendingFood=null;
  function totals(){const sum={};for(const entries of Object.values(plan()))for(const p of entries){const f=foods.find(x=>String(x.id)===String(p.id));if(!f)continue;for(const [k,v] of Object.entries(f.values||{}))sum[k]=(sum[k]||0)+v*(f.grams||100)/100*p.qty;}sum.unsaturatedFat=(sum.monounsaturatedFat||0)+(sum.polyunsaturatedFat||0);return sum;}
  function reference(n){const p=state.profile,age=Number(p.age);if(!age||!p.sex||age<19||age>50)return null;const band=age<=30?'younger':'older';if(p.stage)return n.ageBands?.[p.stage]?.[band]??n[p.stage];if(n.ageBands)return n.ageBands[band][p.sex];return n[p.sex];}
  function statusFor(n,goal,v){if(n.type==='Food data')return['Food estimate','neutral'];if(v<=0)return['Nothing added yet','neutral'];if(n.type==='AMDR')return['Share of energy shown','neutral'];if(typeof goal!=='number')return['Context reference','neutral'];return v>=goal?['Reference reached','good']:v>=goal*.7?['Getting there','mid']:['Below reference so far','low'];}
  function renderSummary(){
    const sum=totals(),energy=sum.kcal||0;
    const rows=new Map();
    D.nutrients.forEach(n=>{
      const available=n.key==='unsaturatedFat'?availableNutrients.has('monounsaturatedFat')&&availableNutrients.has('polyunsaturatedFat'):availableNutrients.has(n.key), v=sum[n.key]||0,goal=reference(n),pct=energy&&n.type==='AMDR'?v*9/energy*100:null;
      const [rawStatus,rawTone]=statusFor(n,goal,v), status=available?rawStatus:'Food values unavailable',tone=available?rawTone:'neutral';
      const age=Number(state.profile.age),targetText=n.type==='Food data'?'No DRI target':typeof goal==='number'?`${goal} ${n.unit} ${n.type}`:typeof goal==='string'?`${goal} ${n.type}`:n.type==='AMDR'?'20–35% of energy':age&& (age<19||age>50)?'Reference snapshot covers ages 19–50':'Select age and DRI reference category';
      const widthClass=`w${Math.max(0,Math.min(100,Math.round((typeof goal==='number'?v/goal*100:pct!==null?pct/35*100:0)/5)*5))}`;
      const bar=typeof goal==='number'?`<div class="progress-track"><span class="progress-fill ${tone} ${widthClass}"></span></div>`:pct!==null?`<div class="progress-track"><span class="progress-fill neutral ${widthClass}"></span></div>`:'';
      const ulAmount=sum[n.ulKey||n.key]||0;
      const ul=n.ul?`<details class="nutrient-more"><summary>UL ${n.ul.toLocaleString()} ${n.ulUnit||n.unit}${!n.ulNote&&ulAmount>n.ul?' · above in estimate':''}</summary><small>Upper limit, not a goal. ${safe(n.ulNote||'Usual total intake from food and supplements.')}</small></details>`:'';
      const cdrr=n.cdrr?`<details class="nutrient-more"><summary>CDRR ${n.cdrr.toLocaleString()} ${n.unit}</summary><small>Reduce usual intake if above this level; it is not a UL.</small></details>`:'';
      const displayUnit=n.key==='vitaminA'?'µg RAE':n.key==='folate'?'µg DFE':n.key==='niacin'?'mg NE':n.key==='vitaminD'||n.key==='vitaminK'||n.key==='chromium'||n.key==='iodine'||n.key==='molybdenum'||n.key==='selenium'||n.key==='vitaminB12'||n.key==='biotin'?'µg':n.key==='vitaminE'||n.key==='calcium'||n.key==='sodium'||n.key==='potassium'||n.key==='phosphorus'||n.key==='magnesium'||n.key==='choline'?'mg':'g';
      const displayed=!available?'Unavailable':n.key==='fat'&&energy?`${(v*9/energy*100).toFixed(0)}%`:`${Number(v.toFixed(2)).toLocaleString()} ${displayUnit}`;
      rows.set(n.key,`<article class="nutrient-row"><div class="nutrient-top"><strong>${safe(n.label)} <span class="nutrient-type">${safe(n.type)}</span></strong><span class="nutrient-amount">${displayed}</span></div><div class="nutrient-bottom"><span class="status ${tone}">${safe(status)}</span><span>${safe(targetText)}</span></div>${bar}${ul}${cdrr}${n.detail?`<details class="nutrient-more"><summary>About</summary><small>${safe(n.detail)}</small></details>`:''}</article>`);
    });
    const groups=[['macros','Macronutrients & fats'],['fatVitamins','Fat-soluble vitamins'],['bVitamins','B vitamins'],['otherWater','Other water-soluble nutrients'],['majorMinerals','Major minerals'],['traceMinerals','Trace minerals'],['otherTrace','Additional trace minerals']];
    $('#nutrient-summary').innerHTML=groups.map(([key,label])=>{const entries=D.nutrients.filter(n=>n.group===key);return `<section class="nutrient-group"><h3>${label}<span>${entries.length}</span></h3>${entries.map(n=>rows.get(n.key)).join('')}</section>`;}).join('');
  }
  function renderPlan(){const p=plan(),all=Object.values(p).flat(),any=all.length>0;$('#plan-total').classList.toggle('hidden',!any);
    for(const meal of ['breakfast','lunch','dinner']){
      const entries=p[meal],container=$(`#meal-${meal}`),section=document.querySelector(`[data-meal="${meal}"]`);
      section.querySelector('.meal-empty').classList.toggle('hidden',entries.length>0);
      section.querySelector(`[data-meal-count="${meal}"]`).textContent=entries.length?`${entries.reduce((a,x)=>a+x.qty,0)} servings`:'';
      container.innerHTML=entries.map((x,index)=>{const f=foods.find(y=>String(y.id)===String(x.id));if(!f)return'';if(!x.itemId)x.itemId=`${meal}-${f.id}-${index}`;return `<article class="plan-item" draggable="true" data-item-id="${safe(x.itemId)}"><span class="drag-handle" aria-hidden="true">⠿</span><span class="plan-food-name">${safe(f.name)} <small>${safe(f.portion)}</small></span><label class="sr-only" for="move-${safe(x.itemId)}">Move ${safe(f.name)} to a meal</label><select class="move-select" id="move-${safe(x.itemId)}" data-move="${safe(x.itemId)}"><option value="breakfast" ${meal==='breakfast'?'selected':''}>Breakfast</option><option value="lunch" ${meal==='lunch'?'selected':''}>Lunch</option><option value="dinner" ${meal==='dinner'?'selected':''}>Dinner</option></select><div class="quantity"><button data-change="-1" data-item="${safe(x.itemId)}" aria-label="Remove one serving" type="button">−</button><span>${safe(x.qty)}</span><button data-change="1" data-item="${safe(x.itemId)}" aria-label="Add one serving" type="button">+</button></div><button class="remove-item" data-remove="${safe(x.itemId)}" aria-label="Remove food" type="button">×</button></article>`;}).join('');
    }
    document.querySelectorAll('.plan-item[draggable="true"]').forEach(item=>item.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',item.dataset.itemId);e.dataTransfer.effectAllowed='move';}));
    document.querySelectorAll('[data-change]').forEach(b=>b.addEventListener('click',()=>{const x=findItem(b.dataset.item);if(!x)return;x.item.qty+=Number(b.dataset.change);if(x.item.qty<=0)plan()[x.meal]=plan()[x.meal].filter(a=>a!==x.item);save();renderPlan();}));
    document.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{const x=findItem(b.dataset.remove);if(x)plan()[x.meal]=plan()[x.meal].filter(a=>a!==x.item);save();renderPlan();}));
    document.querySelectorAll('[data-move]').forEach(s=>s.addEventListener('change',()=>moveItem(s.dataset.move,s.value)));
    const t=totals();$('#plan-total').innerHTML=`<div><span>Estimated energy</span><b>${Math.round(t.kcal||0).toLocaleString()} <small>kcal</small></b></div><p>Energy varies widely; this estimate is not a calorie goal.</p>`;renderSummary();renderCalendar();
  }
  function findItem(itemId){for(const meal of ['breakfast','lunch','dinner']){const item=plan()[meal].find(x=>x.itemId===itemId);if(item)return{meal,item};}return null;}
  function moveItem(itemId,destination){const found=findItem(itemId);if(!found||!['breakfast','lunch','dinner'].includes(destination)||found.meal===destination)return;plan()[found.meal]=plan()[found.meal].filter(x=>x!==found.item);plan()[destination].push(found.item);save();renderPlan();}
  function startWeek(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const shift=(x.getDay()+6)%7;x.setDate(x.getDate()-shift);return x;}
  function renderCalendar(){const start=startWeek(state.day);const end=new Date(start);end.setDate(start.getDate()+6);$('#week-label').textContent=`${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;$('#week-days').innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const key=dayKey(d),day=state.plans[key]||blankDay(),count=Object.values(day).flat().reduce((n,p)=>n+p.qty,0),selected=key===dayKey(state.day),today=key===dayKey(new Date());return `<button class="calendar-day ${selected?'selected':''} ${today?'today':''}" data-date="${key}" type="button" aria-pressed="${selected}"><span>${d.toLocaleDateString(undefined,{weekday:'short'})}</span><b>${d.getDate()}</b><small>${count?`${count} serving${count===1?'':'s'}`:'—'}</small></button>`;}).join('');$('#week-days').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.day=new Date(`${b.dataset.date}T12:00:00`);updateSelectedDate();save();renderPlan();}));}
  function updateSelectedDate(){const heading=$('#selected-date-title');heading.textContent=state.day.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});}
  function shiftWeek(delta){state.day.setDate(state.day.getDate()+delta*7);save();updateSelectedDate();renderPlan();}
  document.querySelectorAll('.meal-section').forEach(section=>{section.addEventListener('dragover',e=>{e.preventDefault();section.classList.add('drag-over');});section.addEventListener('dragleave',()=>section.classList.remove('drag-over'));section.addEventListener('drop',e=>{e.preventDefault();section.classList.remove('drag-over');moveItem(e.dataTransfer.getData('text/plain'),section.dataset.meal);});});
  function syncStage(){const female=inputs.sex.value==='female';$('#life-stage-wrap').classList.toggle('hidden',!female);if(!female){inputs.stage.value='';inputs.detail.value='';state.profile.stage='';state.profile.detail='';}$('#stage-detail-wrap').classList.toggle('hidden',!female||!inputs.stage.value);$('#stage-detail-label').textContent=inputs.stage.value==='pregnancy'?'Pregnancy stage':'Lactation stage';inputs.detail.innerHTML=inputs.stage.value==='pregnancy'?'<option value="">Choose a stage</option><option value="early">First half (0–19 weeks)</option><option value="late">Second half (20+ weeks)</option>':'<option value="">Choose a stage</option><option value="first-year">First 6 months</option><option value="second-half">6–12 months</option>';if(state.profile.detail)inputs.detail.value=state.profile.detail;}
  function readProfile(e){if(e?.currentTarget===inputs.stage){inputs.detail.value='';state.profile.detail='';}state.profile={age:inputs.age.value,sex:inputs.sex.value,stage:inputs.stage.value,detail:inputs.detail.value};syncStage();save();renderSummary();}
  Object.values(inputs).forEach(input=>input.addEventListener('change',readProfile));
  $('#food-search').addEventListener('input',()=>{visibleCount=60;renderFoods();});
  $('#meal-form').addEventListener('submit',e=>{e.preventDefault();if(!pendingFood)return;const meal=$('#meal-choice').value,entries=plan()[meal],existing=entries.find(x=>String(x.id)===String(pendingFood.id));if(existing)existing.qty=Math.min(20,existing.qty+1);else entries.push({id:pendingFood.id,itemId:`item-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,qty:1});$('#meal-dialog').close();pendingFood=null;save();renderPlan();});
  $('#cancel-meal').addEventListener('click',()=>{pendingFood=null;$('#meal-dialog').close();});
  $('#profile-form').addEventListener('submit',e=>{e.preventDefault();readProfile();$('#planner').scrollIntoView({behavior:'smooth'});});
  $('#clear-plan').addEventListener('click',()=>{state.plans[dayKey(state.day)]=blankDay();save();renderPlan();});
  $('#prev-week').addEventListener('click',()=>shiftWeek(-1));$('#next-week').addEventListener('click',()=>shiftWeek(1));
  $('#reset-button').addEventListener('click',()=>{state.profile={};state.plans={};state.day=new Date();try{localStorage.removeItem('gather-planner');}catch(_){}$('#profile-form').reset();syncStage();updateSelectedDate();renderPlan();});
  inputs.age.value=state.profile.age||'';inputs.sex.value=state.profile.sex||'';inputs.stage.value=state.profile.stage||'';syncStage();
  updateSelectedDate();renderCategories();renderFoods();renderPlan();
})();
