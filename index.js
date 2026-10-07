const express=require("express"),cors=require("cors"),cheerio=require("cheerio");
const app=express(),PORT=process.env.PORT||3000;
app.use(cors()); app.use(express.json());

const STORES=[
{id:"auchan",name:"Auchan",officialUrl:"https://www.auchan.fr/courses",search:q=>`https://www.auchan.fr/recherche?text=${encodeURIComponent(q)}`},
{id:"intermarche",name:"Intermarché",officialUrl:"https://www.intermarche.com/",search:q=>`https://www.intermarche.com/recherche?text=${encodeURIComponent(q)}`},
{id:"superu",name:"Super U",officialUrl:"https://www.coursesu.com/drive-france",search:q=>`https://www.coursesu.com/recherche?q=${encodeURIComponent(q)}&lang=fr_FR`},
{id:"aldi",name:"ALDI",officialUrl:"https://www.aldi.fr/liste-de-courses.html",search:q=>`https://www.aldi.fr/liste-de-courses.html?search=${encodeURIComponent(q)}`},
{id:"lidl",name:"Lidl",officialUrl:"https://www.lidl.fr/online",search:q=>`https://www.lidl.fr/q/query/${encodeURIComponent(q)}`},
{id:"carrefour",name:"Carrefour",officialUrl:"https://www.carrefour.fr/services/drive",search:q=>`https://www.carrefour.fr/s?q=${encodeURIComponent(q)}`},
{id:"leclerc",name:"E.Leclerc",officialUrl:"https://www.leclercdrive.fr/",search:q=>`https://www.leclercdrive.fr/recherche.aspx?search=${encodeURIComponent(q)}`}
];
const CATEGORIES=["Fruits & légumes","Viandes & poissons","Crèmerie","Charcuterie & traiteur","Surgelés","Bébé","Épicerie salée","Épicerie sucrée","Boissons","Pains & pâtisseries","Bio & écologie","Entretien","Maison","Animalerie"];
const cache=new Map(),CACHE_MS=300000;
const store=id=>STORES.find(x=>x.id===id);
const clean=x=>String(x||"").replace(/\s+/g," ").trim();
function price(s){const m=clean(s).replace(",",".").match(/(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?)\s*€/);if(!m)return null;const n=Number(m[1].replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:null}
function add(out,p,url){if(!p.name||p.price==null||!Number.isFinite(p.price))return;const name=clean(p.name),key=name.toLowerCase()+"|"+p.price;if(out.some(x=>x.key===key))return;out.push({id:Buffer.from(url+"|"+name).toString("base64url").slice(0,40),name,brand:p.brand||null,category:p.category||"Non classé",packSize:p.packSize||null,price:p.price,unitPrice:null,currency:"EUR",promotion:null,available:null,sourceUrl:url,updatedAt:new Date().toISOString(),key})}
function jsonld($,out,url){$('script[type="application/ld+json"]').each((_,e)=>{try{const d=JSON.parse($(e).text());for(const x of (Array.isArray(d)?d:[d])){for(const i of (x?.itemListElement||[])){const p=i.item||i,o=Number(p?.offers?.price??p?.price);if(p?.name&&Number.isFinite(o))add(out,{name:p.name,price:o,brand:p.brand?.name},url)}if(x?.["@type"]==="Product"&&x.name){const o=Number(x?.offers?.price);if(Number.isFinite(o))add(out,{name:x.name,price:o,brand:x.brand?.name},url)}}}catch{}})}
function parse($,out,url){jsonld($,out,url);$("article,li,[class*='product'],[data-testid*='product']").each((_,e)=>{const t=clean($(e).text()),p=price(t);if(p==null)return;const n=clean($(e).find("h2,h3,h4,[class*='name'],[class*='title']").first().text());if(n)add(out,{name:n,price:p},url)})}
function normalizeName(s){return clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
async function fetchOfficial(s,q){
 if(s.id==="aldi"){
  const n=clean(q).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  let pages;

  if(/lait|beurre|creme|yaourt|fromage|oeuf/.test(n))
   pages=["https://www.aldi.fr/produits/produits-laitiers/creme-beurre.html"];
  else if(/pate|riz|huile|sauce|conserve|epice|sel|farine/.test(n))
   pages=["https://www.aldi.fr/produits/epicerie-salee.html"];
  else if(/surgele|glace|frites/.test(n))
   pages=["https://www.aldi.fr/produits/surgeles/fruit-legume.html"];
  else if(/sandwich|lasagne|pizza|plat|burger|wrap/.test(n))
   pages=["https://www.aldi.fr/produits/charcuterie/sandwich-plat-prepare.html"];
  else
   pages=["https://www.aldi.fr/offres-et-bons-plans.html"];

  const all=[];

  for(const url of pages){
   const r=await fetch(url,{
    headers:{
     "user-agent":"BudgetCoursesOfficialSource/2.1",
     "accept":"text/html,application/xhtml+xml"
    }
   });

   if(!r.ok) throw Error("HTTP "+r.status);

   const $=cheerio.load(await r.text());
   const out=[];
   parse($,out,url);
   all.push(...out);
  }

  const products=all
   .filter(p=>normalizeName(p.name).includes(n))
   .slice(0,100)
   .map(({key,...x})=>x);

  return {
   verified:products.length>0,
   sourceUrl:pages[0],
   updatedAt:new Date().toISOString(),
   products,
   message:products.length
    ?"Prix extraits des pages officielles ALDI France."
    :"Aucun produit correspondant trouvé sur la source officielle ALDI."
  };
 }

 const url=s.search(q),hit=cache.get(url);

 if(hit&&Date.now()-hit.t<CACHE_MS)
  return hit.data;

 const c=new AbortController();
 const tm=setTimeout(()=>c.abort(),12000);

 try{
  const r=await fetch(url,{
   headers:{
    "user-agent":"BudgetCoursesOfficialSource/2.0",
    "accept":"text/html,application/xhtml+xml"
   },
   signal:c.signal
  });

  if(!r.ok) throw Error("HTTP "+r.status);

  const $=cheerio.load(await r.text());
  const out=[];
  parse($,out,url);

  const data={
   verified:out.length>0,
   sourceUrl:url,
   updatedAt:new Date().toISOString(),
   products:out.slice(0,100).map(({key,...x})=>x),
   message:out.length
    ?"Données extraites depuis une page officielle."
    :"La page officielle ne fournit pas de prix exploitables sans contexte magasin/session."
  };

  cache.set(url,{t:Date.now(),data});
  return data;
 }finally{
  clearTimeout(tm);
 }
}app.get("/api/health",(_,r)=>r.json({ok:true,service:"budget-courses-server",version:"2.0.0",sources:"official-only",time:new Date().toISOString()}));
app.get("/api/stores",(_,r)=>r.json(STORES.map(({id,name,officialUrl})=>({id,name,officialUrl}))));
app.get("/api/stores/:store/locations",(q,r)=>{const s=store(q.params.store);if(!s)return r.status(404).json({error:"store_not_found"});r.json([{id:s.id+"-official",storeId:s.id,name:s.name+" — recherche officielle",postalCode:clean(q.query.postalCode),city:clean(q.query.city),verified:false,sourceUrl:s.officialUrl,message:"Le prix local dépend du magasin/Drive sélectionné sur le site officiel."}])});
app.get("/api/stores/:store/locations/:locationId/categories",(q,r)=>store(q.params.store)?r.json(CATEGORIES):r.status(404).json({error:"store_not_found"}));
app.get("/api/stores/:store/locations/:locationId/products",async(q,r)=>{const s=store(q.params.store);if(!s)return r.status(404).json({error:"store_not_found"});const term=clean(q.query.q)||"lait";try{const d=await fetchOfficial(s,term);r.json({store:s.id,locationId:q.params.locationId,query:term,...d})}catch(e){r.status(502).json({error:"official_source_unavailable",store:s.id,message:"La source officielle est indisponible ou nécessite une session/magasin.",sourceUrl:s.search(term)})}});
app.listen(PORT,()=>console.log("Budget Courses server v2 listening on "+PORT));
